import { DurableObject } from "cloudflare:workers";

type GameSlug = "hub" | "snake" | "tetris";
type SnakePhase = "lobby" | "playing" | "finished";

type ClientState = {
  id: string;
  name: string;
  page: string;
  game: GameSlug;
  session: string | null;
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

type TetrisPhase = "menu" | "playing" | "paused" | "game_over";
type TetrisRoomPhase = "lobby" | "playing" | "finished";
type TetrisCell = string | null;
type TetrisBoard = TetrisCell[][];

type TetrisSnapshot = {
  id: string;
  name: string;
  phase: TetrisPhase;
  score: number;
  lines: number;
  level: number;
  board: TetrisBoard;
  next: string | null;
  updatedAt: number;
};

type TetrisPlayer = {
  id: string;
  name: string;
  ready: boolean;
  spectator: boolean;
  active: boolean;
  done: boolean;
  score: number;
  connected: boolean;
};

type IncomingMessage =
  | { type: "hello"; name: string; session?: string }
  | { type: "page"; page: string }
  | { type: "ready"; value: boolean }
  | { type: "tetris_ready"; value: boolean }
  | { type: "direction"; dir: string }
  | {
      type: "tetris_snapshot";
      phase: string;
      score: number;
      lines: number;
      level: number;
      board: unknown;
      next: string | null;
    };

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
  private sessionToClientId = new Map<string, string>();
  private tetrisPlayers = new Map<string, TetrisPlayer>();
  private tetrisScreens = new Map<string, TetrisSnapshot>();
  private tetrisDisconnectTimers = new Map<string, number>();
  private tetrisPhase: TetrisRoomPhase = "lobby";
  private tetrisRound = 0;
  private tetrisWinnerId: string | null = null;
  private tetrisFinishTimeout: number | null = null;
  private phase: SnakePhase = "lobby";
  private round = 0;
  private winnerId: string | null = null;
  private food: Cell = { row: 0, col: 0 };
  private tickTimer: number | null = null;
  private finishTimeout: number | null = null;

  private readonly rows = 18;
  private readonly cols = 24;
  private readonly tetrisDisconnectGraceMs = 10000;

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
    this.clients.set(ws, { id, name: "Guest", page: "/", game: "hub", session: null });
    this.ensurePlayer(id, "Guest");
    const guestName = this.getUniqueName("Guest", id);
    const clientState = this.clients.get(ws);
    if (clientState) clientState.name = guestName;
    const player = this.players.get(id);
    if (player) player.name = guestName;
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
    this.broadcastTetrisState();
  }

  private handleMessage(ws: WebSocket, msg: unknown) {
    const c = this.clients.get(ws);
    if (!c || !msg || typeof msg !== "object") return;
    const data = msg as Partial<IncomingMessage> & { type?: string };

    if (data.type === "hello" && typeof data.name === "string") {
      if (typeof data.session === "string") {
        const session = data.session.trim().slice(0, 120);
        if (session) {
          this.rebindClientSession(ws, session);
        }
      }

      const current = this.clients.get(ws);
      if (!current) return;
      const requestedName = data.name.trim().slice(0, 24) || "Guest";
      const name = this.getUniqueName(requestedName, current.id);
      current.name = name;
      const p = this.players.get(current.id);
      if (p) p.name = name;
      const tp = this.tetrisPlayers.get(current.id);
      if (tp) tp.name = name;
      const screen = this.tetrisScreens.get(current.id);
      if (screen) screen.name = name;
      this.send(ws, { type: "name_ack", name, adjusted: name !== requestedName });
      this.broadcastPresence();
      this.broadcastSnakeState();
      this.broadcastTetrisState();
      return;
    }

    if (data.type === "page" && typeof data.page === "string") {
      const page = data.page;
      c.page = page;
      c.game = this.toGame(page);
      this.syncPlayerPresence(c.id);
      this.syncTetrisPresence(c.id);
      this.broadcastPresence();
      this.broadcastSnakeState();
      this.broadcastTetrisState();
      return;
    }

    if (data.type === "ready" && typeof data.value === "boolean") {
      this.setReady(c.id, data.value);
      return;
    }

    if (data.type === "tetris_ready" && typeof data.value === "boolean") {
      this.setTetrisReady(c.id, data.value);
      return;
    }

    if (data.type === "direction" && typeof data.dir === "string") {
      this.setDirection(c.id, data.dir);
      return;
    }

    if (
      data.type === "tetris_snapshot" &&
      typeof data.phase === "string" &&
      typeof data.score === "number" &&
      typeof data.lines === "number" &&
      typeof data.level === "number"
    ) {
      this.setTetrisSnapshot(c.id, {
        phase: data.phase,
        score: data.score,
        lines: data.lines,
        level: data.level,
        board: data.board,
        next: typeof data.next === "string" ? data.next : null,
      });
      return;
    }
  }

  private removeClient(ws: WebSocket) {
    const c = this.clients.get(ws);
    if (!c) return;
    this.clients.delete(ws);
    this.players.delete(c.id);
    const tp = this.tetrisPlayers.get(c.id);
    if (tp) {
      tp.connected = false;
      if (this.tetrisPhase === "playing" && tp.active && !tp.done) {
        this.clearTetrisDisconnectTimer(c.id);
        const timer = setTimeout(() => {
          const latest = this.tetrisPlayers.get(c.id);
          if (!latest) return;
          if (!latest.connected && this.tetrisPhase === "playing" && latest.active && !latest.done) {
            latest.done = true;
            latest.active = false;
            latest.spectator = true;
            this.broadcastTetrisState();
            this.tryFinishTetrisRound();
          }
          this.tetrisDisconnectTimers.delete(c.id);
        }, this.tetrisDisconnectGraceMs) as unknown as number;
        this.tetrisDisconnectTimers.set(c.id, timer);
      } else {
        this.tetrisPlayers.delete(c.id);
        this.tetrisScreens.delete(c.id);
      }
    } else {
      this.tetrisScreens.delete(c.id);
    }
    this.syncAfterLeave();
    this.syncTetrisAfterLeave();
    this.broadcastPresence();
    this.broadcastSnakeState();
    this.broadcastTetrisState();
  }

  private toGame(path: string): GameSlug {
    if (path.startsWith("/games/snake")) return "snake";
    if (path.startsWith("/games/tetris")) return "tetris";
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

  private normalizeName(name: string) {
    return name.trim().toLowerCase();
  }

  private isNameTaken(name: string, exceptId: string) {
    const target = this.normalizeName(name);
    for (const c of this.clients.values()) {
      if (c.id === exceptId) continue;
      if (this.normalizeName(c.name) === target) return true;
    }
    return false;
  }

  private getUniqueName(input: string, id: string) {
    const cleaned = input.trim().slice(0, 24) || "Guest";
    if (!this.isNameTaken(cleaned, id)) return cleaned;

    const safeBase = cleaned.replace(/-\d+$/, "").slice(0, 20) || "Guest";
    let suffix = 2;
    while (suffix < 9999) {
      const candidate = `${safeBase}-${suffix}`.slice(0, 24);
      if (!this.isNameTaken(candidate, id)) return candidate;
      suffix += 1;
    }
    return `${safeBase}-${Date.now().toString().slice(-4)}`.slice(0, 24);
  }

  private snakePageUserIds() {
    const ids = new Set<string>();
    for (const c of this.clients.values()) {
      if (c.game === "snake") ids.add(c.id);
    }
    return ids;
  }

  private tetrisPageUserIds() {
    const ids = new Set<string>();
    for (const c of this.clients.values()) {
      if (c.game === "tetris") ids.add(c.id);
    }
    return ids;
  }

  private ensureTetrisPlayer(id: string, name: string) {
    if (this.tetrisPlayers.has(id)) return;
    this.tetrisPlayers.set(id, {
      id,
      name,
      ready: false,
      spectator: false,
      active: false,
      done: false,
      score: 0,
      connected: true,
    });
  }

  private clearTetrisDisconnectTimer(id: string) {
    const timer = this.tetrisDisconnectTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.tetrisDisconnectTimers.delete(id);
    }
  }

  private rebindClientSession(ws: WebSocket, session: string) {
    const current = this.clients.get(ws);
    if (!current) return;

    const existingId = this.sessionToClientId.get(session);
    if (!existingId || existingId === current.id) {
      current.session = session;
      this.sessionToClientId.set(session, current.id);
      return;
    }

    for (const [otherWs, other] of this.clients) {
      if (otherWs !== ws && other.id === existingId) {
        try {
          otherWs.close();
        } catch {
          // ignore close failures
        }
      }
    }

    // Remove placeholder identity from newly opened socket.
    this.players.delete(current.id);
    this.tetrisPlayers.delete(current.id);
    this.tetrisScreens.delete(current.id);

    current.id = existingId;
    current.session = session;
    this.sessionToClientId.set(session, existingId);

    const tp = this.tetrisPlayers.get(existingId);
    if (tp) {
      tp.connected = true;
      this.clearTetrisDisconnectTimer(existingId);
    }
  }

  private sanitizeTetrisPhase(input: string): TetrisPhase {
    if (input === "playing") return "playing";
    if (input === "paused") return "paused";
    if (input === "game_over") return "game_over";
    return "menu";
  }

  private sanitizeTetrisBoard(input: unknown): TetrisBoard {
    if (!Array.isArray(input)) {
      return Array.from({ length: 22 }, () => Array<TetrisCell>(10).fill(null));
    }
    const rows = 22;
    const cols = 10;
    const safe: TetrisBoard = [];
    for (let r = 0; r < rows; r++) {
      const srcRow = Array.isArray(input[r]) ? input[r] : [];
      const row: TetrisCell[] = [];
      for (let c = 0; c < cols; c++) {
        const raw = srcRow[c];
        row.push(typeof raw === "string" ? raw.slice(0, 1) : null);
      }
      safe.push(row);
    }
    return safe;
  }

  private syncTetrisPresence(id: string) {
    const inTetris = this.tetrisPageUserIds().has(id);
    if (!inTetris) {
      this.tetrisPlayers.delete(id);
      this.tetrisScreens.delete(id);
      return;
    }

    const c = [...this.clients.values()].find((x) => x.id === id);
    if (!c) return;
    this.ensureTetrisPlayer(id, c.name);
    const tp = this.tetrisPlayers.get(id);
    if (!tp) return;
    tp.name = c.name;
    tp.connected = true;
    this.clearTetrisDisconnectTimer(id);

    if (this.tetrisPhase === "playing" && !tp.active) {
      tp.spectator = true;
    }
  }

  private syncTetrisAfterLeave() {
    const tetrisUsers = this.tetrisPageUserIds();
    for (const id of this.tetrisPlayers.keys()) {
      if (!tetrisUsers.has(id)) {
        const p = this.tetrisPlayers.get(id);
        if (!p) continue;
        if (this.tetrisPhase === "playing" && p.active) continue;
        this.clearTetrisDisconnectTimer(id);
        this.tetrisPlayers.delete(id);
        this.tetrisScreens.delete(id);
      }
    }
    for (const id of this.tetrisScreens.keys()) {
      const p = this.tetrisPlayers.get(id);
      if (!tetrisUsers.has(id) && !p?.active) this.tetrisScreens.delete(id);
    }
    if (this.tetrisPhase === "playing") {
      this.tryFinishTetrisRound();
    }
  }

  private setTetrisReady(id: string, value: boolean) {
    const inTetris = this.tetrisPageUserIds().has(id);
    if (!inTetris) return;
    const c = [...this.clients.values()].find((x) => x.id === id);
    if (!c) return;
    this.ensureTetrisPlayer(id, c.name);
    const tp = this.tetrisPlayers.get(id);
    if (!tp) return;
    tp.connected = true;
    if (this.tetrisPhase === "playing") return;
    if (tp.spectator) return;
    tp.ready = value;
    this.broadcastTetrisState();
    this.tryStartTetrisRound();
  }

  private tryStartTetrisRound() {
    if (this.tetrisPhase === "playing") return;
    const tetrisUsers = this.tetrisPageUserIds();
    const candidates = [...this.tetrisPlayers.values()].filter(
      (p) => tetrisUsers.has(p.id) && !p.spectator
    );
    if (candidates.length < 1) return;
    if (!candidates.every((p) => p.ready)) return;
    this.startTetrisRound(candidates);
  }

  private startTetrisRound(active: TetrisPlayer[]) {
    this.tetrisPhase = "playing";
    this.tetrisRound += 1;
    this.tetrisWinnerId = null;
    if (this.tetrisFinishTimeout !== null) {
      clearTimeout(this.tetrisFinishTimeout);
      this.tetrisFinishTimeout = null;
    }

    const tetrisUsers = this.tetrisPageUserIds();
    for (const p of this.tetrisPlayers.values()) {
      this.clearTetrisDisconnectTimer(p.id);
      p.ready = false;
      p.done = false;
      p.connected = tetrisUsers.has(p.id);
      if (tetrisUsers.has(p.id) && active.some((a) => a.id === p.id)) {
        p.spectator = false;
        p.active = true;
        p.score = 0;
      } else if (tetrisUsers.has(p.id)) {
        p.spectator = true;
        p.active = false;
      } else {
        p.active = false;
      }
    }

    this.tetrisScreens.clear();
    this.broadcastTetrisState();
  }

  private tryFinishTetrisRound() {
    if (this.tetrisPhase !== "playing") return;
    const active = [...this.tetrisPlayers.values()].filter((p) => p.active);
    if (active.length === 0) {
      this.finishTetrisRound(null);
      return;
    }
    const survivors = active.filter((p) => !p.done);
    if (survivors.length <= 1) {
      this.finishTetrisRound(survivors[0]?.id ?? null);
    }
  }

  private finishTetrisRound(winnerId: string | null) {
    if (this.tetrisPhase !== "playing") return;
    for (const id of this.tetrisDisconnectTimers.keys()) {
      this.clearTetrisDisconnectTimer(id);
    }
    this.tetrisPhase = "finished";
    this.tetrisWinnerId = winnerId;
    this.broadcastTetrisState();

    this.tetrisFinishTimeout = setTimeout(() => {
      const tetrisUsers = this.tetrisPageUserIds();
      for (const p of this.tetrisPlayers.values()) {
        p.ready = false;
        p.done = false;
        p.active = false;
        p.score = 0;
        if (tetrisUsers.has(p.id)) {
          p.spectator = false;
        }
      }
      this.tetrisPhase = "lobby";
      this.tetrisWinnerId = null;
      this.broadcastTetrisState();
    }, 2200) as unknown as number;
  }

  private setTetrisSnapshot(
    id: string,
    payload: {
      phase: string;
      score: number;
      lines: number;
      level: number;
      board: unknown;
      next: string | null;
    }
  ) {
    const inTetris = this.tetrisPageUserIds().has(id);
    if (!inTetris) return;
    const c = [...this.clients.values()].find((x) => x.id === id);
    if (!c) return;
    this.ensureTetrisPlayer(id, c.name);
    const tp = this.tetrisPlayers.get(id);
    if (!tp) return;
    tp.name = c.name;
    tp.connected = true;
    this.clearTetrisDisconnectTimer(id);
    if (this.tetrisPhase === "playing" && (!tp.active || tp.spectator)) return;

    this.tetrisScreens.set(id, {
      id,
      name: c.name,
      phase: this.sanitizeTetrisPhase(payload.phase),
      score: Math.max(0, Math.floor(payload.score)),
      lines: Math.max(0, Math.floor(payload.lines)),
      level: Math.max(1, Math.floor(payload.level)),
      board: this.sanitizeTetrisBoard(payload.board),
      next: payload.next ? payload.next.slice(0, 1) : null,
      updatedAt: Date.now(),
    });

    tp.score = Math.max(0, Math.floor(payload.score));
    tp.done = this.sanitizeTetrisPhase(payload.phase) === "game_over";

    this.broadcastTetrisState();
    this.tryFinishTetrisRound();
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

  private broadcastTetrisState() {
    const tetrisUsers = this.tetrisPageUserIds();
    const roster = [...this.tetrisPlayers.values()]
      .filter((p) => tetrisUsers.has(p.id) || p.active)
      .map((p) => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
        spectator: p.spectator,
        active: p.active,
        done: p.done,
        score: p.score,
      }));
    const players = [...this.tetrisScreens.values()]
      .filter((screen) => tetrisUsers.has(screen.id) || this.tetrisPlayers.get(screen.id)?.active)
      .sort((a, b) => a.name.localeCompare(b.name));
    this.broadcast({
      type: "tetris_state",
      phase: this.tetrisPhase,
      round: this.tetrisRound,
      winnerId: this.tetrisWinnerId,
      rows: 22,
      cols: 10,
      roster,
      players,
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
