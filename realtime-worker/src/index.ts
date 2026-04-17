import { DurableObject } from "cloudflare:workers";

type GameSlug = "hub" | "snake" | "tetris" | "typing" | "minecraft";
type SnakePhase = "lobby" | "playing" | "finished";

type ClientState = {
  id: string;
  name: string;
  page: string;
  game: GameSlug;
};

type Vec = { dr: number; dc: number };
type Cell = { row: number; col: number };

type SnakePlayer = {
  id: string;
  name: string;
  ready: boolean;
  spectator: boolean;
  alive: boolean;
  score: number;
  dir: Vec;
  pending: Vec;
  segments: Cell[];
};

type SnakeStart = {
  segments: Cell[];
  dir: Vec;
};

type IncomingMessage =
  | { type: "hello"; name: string }
  | { type: "page"; page: string }
  | { type: "ready"; value: boolean }
  | { type: "direction"; dir: string };

export interface Env {
  LOBBY_ROOM: DurableObjectNamespace<LobbyRoom>;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const worker = {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const roomId = env.LOBBY_ROOM.idFromName("global");
    const room = env.LOBBY_ROOM.get(roomId);

    if (url.pathname === "/health") {
      return json({ ok: true });
    }
    if (url.pathname === "/ws") {
      return room.fetch(request);
    }
    return json({ ok: false, message: "Use /ws for websocket." }, 404);
  },
};
export default worker;

export class LobbyRoom extends DurableObject {
  private clients = new Map<WebSocket, ClientState>();
  private players = new Map<string, SnakePlayer>();
  private phase: SnakePhase = "lobby";
  private round = 0;
  private winnerId: string | null = null;
  private food: Cell = { row: 0, col: 0 };
  private tickTimer: number | null = null;
  private finishTimeout: number | null = null;

  private readonly rows = 18;
  private readonly cols = 24;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return json({ ok: false, message: "WebSocket only." }, 426);
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.acceptSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private acceptSocket(ws: WebSocket) {
    ws.accept();
    const id = crypto.randomUUID();
    this.clients.set(ws, { id, name: "Guest", page: "/", game: "hub" });
    this.ensurePlayer(id, "Guest");
    this.send(ws, { type: "welcome", id });

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        this.handleMessage(ws, msg);
      } catch {
        this.send(ws, { type: "error", message: "Invalid JSON message." });
      }
    });
    ws.addEventListener("close", () => this.removeClient(ws));
    ws.addEventListener("error", () => this.removeClient(ws));
    this.broadcastPresence();
    this.broadcastSnakeState();
  }

  private handleMessage(ws: WebSocket, msg: unknown) {
    const c = this.clients.get(ws);
    if (!c || !msg || typeof msg !== "object") return;
    const data = msg as Partial<IncomingMessage> & { type?: string };

    if (data.type === "hello" && typeof data.name === "string") {
      const name = data.name.trim().slice(0, 24) || "Guest";
      c.name = name;
      const p = this.players.get(c.id);
      if (p) p.name = name;
      this.broadcastPresence();
      this.broadcastSnakeState();
      return;
    }

    if (data.type === "page" && typeof data.page === "string") {
      const page = data.page;
      c.page = page;
      c.game = this.toGame(page);
      this.syncPlayerPresence(c.id);
      this.broadcastPresence();
      this.broadcastSnakeState();
      return;
    }

    if (data.type === "ready" && typeof data.value === "boolean") {
      this.setReady(c.id, data.value);
      return;
    }

    if (data.type === "direction" && typeof data.dir === "string") {
      this.setDirection(c.id, data.dir);
      return;
    }
  }

  private removeClient(ws: WebSocket) {
    const c = this.clients.get(ws);
    if (!c) return;
    this.clients.delete(ws);
    this.players.delete(c.id);
    this.syncAfterLeave();
    this.broadcastPresence();
    this.broadcastSnakeState();
  }

  private toGame(path: string): GameSlug {
    if (path.startsWith("/games/snake")) return "snake";
    if (path.startsWith("/games/tetris")) return "tetris";
    if (path.startsWith("/games/typing")) return "typing";
    if (path.startsWith("/games/minecraft")) return "minecraft";
    return "hub";
  }

  private ensurePlayer(id: string, name: string) {
    if (this.players.has(id)) return;
    this.players.set(id, {
      id,
      name,
      ready: false,
      spectator: false,
      alive: false,
      score: 0,
      dir: { dr: 0, dc: 1 },
      pending: { dr: 0, dc: 1 },
      segments: [],
    });
  }

  private snakePageUserIds() {
    const ids = new Set<string>();
    for (const c of this.clients.values()) {
      if (c.game === "snake") ids.add(c.id);
    }
    return ids;
  }

  private syncPlayerPresence(id: string) {
    const player = this.players.get(id);
    if (!player) return;
    const inSnake = [...this.clients.values()].some((c) => c.id === id && c.game === "snake");

    if (!inSnake) {
      player.ready = false;
      if (this.phase !== "playing") {
        player.spectator = false;
        player.alive = false;
      }
      return;
    }
    if (this.phase === "playing" && !player.alive) {
      player.spectator = true;
    }
  }

  private setReady(id: string, value: boolean) {
    const p = this.players.get(id);
    if (!p) return;
    const inSnake = this.snakePageUserIds().has(id);
    if (!inSnake) return;
    if (this.phase === "playing") return;
    if (p.spectator) return;
    p.ready = value;
    this.broadcastSnakeState();
    this.tryStartRound();
  }

  private setDirection(id: string, dir: string) {
    if (this.phase !== "playing") return;
    const p = this.players.get(id);
    if (!p || !p.alive || p.spectator) return;
    const map: Record<string, Vec> = {
      up: { dr: -1, dc: 0 },
      down: { dr: 1, dc: 0 },
      left: { dr: 0, dc: -1 },
      right: { dr: 0, dc: 1 },
      w: { dr: -1, dc: 0 },
      s: { dr: 1, dc: 0 },
      a: { dr: 0, dc: -1 },
      d: { dr: 0, dc: 1 },
    };
    const n = map[dir];
    if (!n) return;
    if (n.dr === -p.dir.dr && n.dc === -p.dir.dc) return;
    p.pending = n;
  }

  private tryStartRound() {
    if (this.phase === "playing") return;
    const snakeUsers = this.snakePageUserIds();
    const active = [...this.players.values()].filter((p) => snakeUsers.has(p.id) && !p.spectator);
    if (active.length < 2) return;
    if (!active.every((p) => p.ready)) return;
    this.startRound(active);
  }

  private startRound(active: SnakePlayer[]) {
    this.phase = "playing";
    this.round += 1;
    this.winnerId = null;
    if (this.finishTimeout !== null) {
      clearTimeout(this.finishTimeout);
      this.finishTimeout = null;
    }

    const starts: SnakeStart[] = [
      {
        segments: [
          { row: 3, col: 3 },
          { row: 3, col: 2 },
          { row: 3, col: 1 },
        ],
        dir: { dr: 0, dc: 1 },
      },
      {
        segments: [
          { row: this.rows - 4, col: this.cols - 4 },
          { row: this.rows - 4, col: this.cols - 3 },
          { row: this.rows - 4, col: this.cols - 2 },
        ],
        dir: { dr: 0, dc: -1 },
      },
      {
        segments: [
          { row: 3, col: this.cols - 4 },
          { row: 3, col: this.cols - 3 },
          { row: 3, col: this.cols - 2 },
        ],
        dir: { dr: 0, dc: -1 },
      },
      {
        segments: [
          { row: this.rows - 4, col: 3 },
          { row: this.rows - 4, col: 2 },
          { row: this.rows - 4, col: 1 },
        ],
        dir: { dr: 0, dc: 1 },
      },
      {
        segments: [
          { row: Math.floor(this.rows / 2), col: 4 },
          { row: Math.floor(this.rows / 2), col: 3 },
          { row: Math.floor(this.rows / 2), col: 2 },
        ],
        dir: { dr: 0, dc: 1 },
      },
      {
        segments: [
          { row: Math.floor(this.rows / 2), col: this.cols - 5 },
          { row: Math.floor(this.rows / 2), col: this.cols - 4 },
          { row: Math.floor(this.rows / 2), col: this.cols - 3 },
        ],
        dir: { dr: 0, dc: -1 },
      },
    ];

    active.forEach((p, idx) => {
      const start = starts[idx % starts.length];
      const s = start.segments.map((v) => ({ ...v }));
      p.ready = false;
      p.spectator = false;
      p.alive = true;
      p.score = 0;
      p.segments = s;
      p.dir = { ...start.dir };
      p.pending = { ...start.dir };
    });

    const snakeUsers = this.snakePageUserIds();
    for (const p of this.players.values()) {
      if (snakeUsers.has(p.id) && !active.some((a) => a.id === p.id)) {
        p.spectator = true;
        p.alive = false;
      }
    }

    this.food = this.pickFood();
    this.startTick();
    this.broadcastSnakeState();
  }

  private startTick() {
    if (this.tickTimer !== null) return;
    this.tickTimer = setInterval(() => this.tick(), 140) as unknown as number;
  }

  private stopTick() {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private tick() {
    if (this.phase !== "playing") return;
    const alive = [...this.players.values()].filter((p) => p.alive && !p.spectator);
    if (alive.length <= 1) {
      this.finishRound();
      return;
    }

    const nextHeads = new Map<string, Cell>();
    for (const p of alive) {
      if (!(p.pending.dr === -p.dir.dr && p.pending.dc === -p.dir.dc)) {
        p.dir = p.pending;
      }
      const head = p.segments[0];
      nextHeads.set(p.id, {
        row: (head.row + p.dir.dr + this.rows) % this.rows,
        col: (head.col + p.dir.dc + this.cols) % this.cols,
      });
    }

    const occupied = new Map<string, string>();
    for (const p of alive) {
      for (let i = 0; i < p.segments.length; i++) {
        const seg = p.segments[i];
        const key = `${seg.row},${seg.col}`;
        if (i === p.segments.length - 1) continue;
        occupied.set(key, p.id);
      }
    }

    const dead = new Set<string>();
    const headCount = new Map<string, number>();
    for (const [id, h] of nextHeads) {
      const key = `${h.row},${h.col}`;
      headCount.set(key, (headCount.get(key) ?? 0) + 1);
      if (occupied.has(key)) dead.add(id);
    }
    for (const [id, h] of nextHeads) {
      const key = `${h.row},${h.col}`;
      if ((headCount.get(key) ?? 0) > 1) dead.add(id);
    }

    for (const p of alive) {
      if (dead.has(p.id)) {
        p.alive = false;
        continue;
      }
      const newHead = nextHeads.get(p.id)!;
      p.segments.unshift(newHead);
      if (newHead.row === this.food.row && newHead.col === this.food.col) {
        p.score += 10;
        this.food = this.pickFood();
      } else {
        p.segments.pop();
      }
    }

    const stillAlive = [...this.players.values()].filter((p) => p.alive && !p.spectator);
    if (stillAlive.length <= 1) {
      this.finishRound();
    } else {
      this.broadcastSnakeState();
    }
  }

  private finishRound() {
    this.stopTick();
    this.phase = "finished";
    const alive = [...this.players.values()].find((p) => p.alive && !p.spectator);
    this.winnerId = alive?.id ?? null;
    this.broadcastSnakeState();

    this.finishTimeout = setTimeout(() => {
      const snakeUsers = this.snakePageUserIds();
      for (const p of this.players.values()) {
        p.alive = false;
        p.ready = false;
        if (snakeUsers.has(p.id)) {
          p.spectator = false;
        }
      }
      this.phase = "lobby";
      this.winnerId = null;
      this.broadcastSnakeState();
    }, 3000) as unknown as number;
  }

  private pickFood(): Cell {
    const occupied = new Set<string>();
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      for (const s of p.segments) occupied.add(`${s.row},${s.col}`);
    }
    const free: Cell[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!occupied.has(`${r},${c}`)) free.push({ row: r, col: c });
      }
    }
    return free[Math.floor(Math.random() * free.length)] ?? { row: 0, col: 0 };
  }

  private syncAfterLeave() {
    const snakeUsers = this.snakePageUserIds();
    for (const p of this.players.values()) {
      if (!snakeUsers.has(p.id)) {
        p.ready = false;
      }
    }
    if (this.phase === "playing") {
      const alive = [...this.players.values()].filter((p) => p.alive && !p.spectator);
      if (alive.length <= 1) this.finishRound();
    }
  }

  private broadcastPresence() {
    const users = [...this.clients.values()].map((c) => ({
      id: c.id,
      name: c.name,
      page: c.page,
      game: c.game,
    }));
    const counts = {
      total: users.length,
      hub: users.filter((u) => u.game === "hub").length,
      snake: users.filter((u) => u.game === "snake").length,
      tetris: users.filter((u) => u.game === "tetris").length,
      typing: users.filter((u) => u.game === "typing").length,
      minecraft: users.filter((u) => u.game === "minecraft").length,
    };
    this.broadcast({ type: "presence", users, counts });
  }

  private broadcastSnakeState() {
    const players = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      spectator: p.spectator,
      alive: p.alive,
      score: p.score,
    }));
    const snakes = Object.fromEntries(
      [...this.players.values()].map((p) => [p.id, p.segments])
    );
    this.broadcast({
      type: "snake_state",
      phase: this.phase,
      players,
      snakes,
      food: this.food,
      winnerId: this.winnerId,
      round: this.round,
      rows: this.rows,
      cols: this.cols,
    });
  }

  private send(ws: WebSocket, payload: unknown) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      this.removeClient(ws);
    }
  }

  private broadcast(payload: unknown) {
    const data = JSON.stringify(payload);
    for (const ws of this.clients.keys()) {
      try {
        ws.send(data);
      } catch {
        this.removeClient(ws);
      }
    }
  }
}
