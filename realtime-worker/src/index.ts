import { DurableObject } from "cloudflare:workers";

type GameSlug = "hub" | "snake" | "tetris" | "bomberman";
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

type TetrisActivePiece = {
  kind: string;
  r: number;
  c: number;
  rot: number;
};

type TetrisRuntime = {
  board: TetrisBoard;
  active: TetrisActivePiece | null;
  next: string;
  bag: string[];
  dropMs: number;
  lines: number;
  level: number;
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
  | { type: "bomber_ready"; value: boolean }
  | { type: "direction"; dir: string }
  | { type: "tetris_input"; action: string }
  | { type: "bomber_direction"; dir: string }
  | { type: "bomber_bomb" };

type BomberPhase = "lobby" | "playing" | "finished";
type BomberBomb = {
  id: string;
  row: number;
  col: number;
  ticks: number;
  range: number;
  ownerId: string;
};
type BomberPlayer = {
  id: string;
  name: string;
  ready: boolean;
  spectator: boolean;
  alive: boolean;
  score: number;
  row: number;
  col: number;
  pending: Vec;
  bombRange: number;
  maxBombs: number;
};
type BomberExplosion = { row: number; col: number; ttl: number };
type BomberPowerup = { row: number; col: number; kind: "range" | "bomb" };

const BOMBER_ROWS = 11;
const BOMBER_COLS = 13;
const BOMBER_TICK_MS = 200;
const BOMBER_BOMB_FUSE_TICKS = 12;
const BOMBER_EXPLO_TTL = 3;
const BOMBER_MAX_RANGE = 5;
const BOMBER_MAX_BOMBS = 3;

const TETRIS_ROWS = 22;
const TETRIS_COLS = 10;
const TETRIS_ORDER = ["I", "O", "T", "S", "Z", "J", "L"] as const;
const TETRIS_DROP_BASE_MS = 800;
const TETRIS_DROP_MIN_MS = 50;
const TETRIS_TICK_MS = 100;

const TETRIS_SHAPES: Record<string, [number, number][][]> = {
  I: [
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
  ],
  O: [
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  ],
  T: [
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  S: [
    [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  Z: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [2, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
  ],
  J: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
  ],
  L: [
    [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  ],
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
  private tetrisRuntime = new Map<string, TetrisRuntime>();
  private tetrisDisconnectTimers = new Map<string, number>();
  private tetrisTickTimer: number | null = null;
  private tetrisPhase: TetrisRoomPhase = "lobby";
  private tetrisRound = 0;
  private tetrisWinnerId: string | null = null;
  private tetrisFinishTimeout: number | null = null;
  private bomberPlayers = new Map<string, BomberPlayer>();
  private bomberPhase: BomberPhase = "lobby";
  private bomberRound = 0;
  private bomberWinnerId: string | null = null;
  private bomberGrid: number[][] = [];
  private bomberBombs: BomberBomb[] = [];
  private bomberExplosions: BomberExplosion[] = [];
  private bomberPowerups: BomberPowerup[] = [];
  private bomberTickTimer: number | null = null;
  private bomberFinishTimeout: number | null = null;
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
    this.broadcastBomberState();
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
      // After session rebind, client id may differ from the initial welcome — resync so UI/input match server.
      this.send(ws, { type: "welcome", id: current.id });
      const requestedName = data.name.trim().slice(0, 24) || "Guest";
      const name = this.getUniqueName(requestedName, current.id);
      current.name = name;
      const p = this.players.get(current.id);
      if (p) p.name = name;
      const tp = this.tetrisPlayers.get(current.id);
      if (tp) tp.name = name;
      const screen = this.tetrisScreens.get(current.id);
      if (screen) screen.name = name;
      const bp = this.bomberPlayers.get(current.id);
      if (bp) bp.name = name;
      this.send(ws, { type: "name_ack", name, adjusted: name !== requestedName });
      this.broadcastPresence();
      this.broadcastSnakeState();
      this.broadcastTetrisState();
      this.broadcastBomberState();
      return;
    }

    if (data.type === "page" && typeof data.page === "string") {
      const page = data.page;
      c.page = page;
      c.game = this.toGame(page);
      this.syncPlayerPresence(c.id);
      this.syncTetrisPresence(c.id);
      this.syncBomberPresence(c.id);
      this.broadcastPresence();
      this.broadcastSnakeState();
      this.broadcastTetrisState();
      this.broadcastBomberState();
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

    if (data.type === "tetris_input" && typeof data.action === "string") {
      this.setTetrisInput(c.id, data.action);
      return;
    }

    if (data.type === "bomber_ready" && typeof data.value === "boolean") {
      this.setBomberReady(c.id, data.value);
      return;
    }

    if (data.type === "bomber_direction" && typeof data.dir === "string") {
      this.setBomberDirection(c.id, data.dir);
      return;
    }

    if (data.type === "bomber_bomb") {
      this.tryPlaceBomberBomb(c.id);
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
        this.tetrisRuntime.delete(c.id);
      }
    } else {
      this.tetrisScreens.delete(c.id);
      this.tetrisRuntime.delete(c.id);
    }
    if (this.bomberPlayers.has(c.id)) {
      const bmp = this.bomberPlayers.get(c.id)!;
      if (this.bomberPhase === "playing" && bmp.alive && !bmp.spectator) {
        bmp.alive = false;
        bmp.spectator = true;
      }
      this.bomberPlayers.delete(c.id);
      if (this.bomberPhase === "playing") {
        this.tryFinishBomberRound();
      }
    }
    this.syncAfterLeave();
    this.syncTetrisAfterLeave();
    this.syncBomberAfterLeave();
    this.broadcastPresence();
    this.broadcastSnakeState();
    this.broadcastTetrisState();
    this.broadcastBomberState();
  }

  private toGame(path: string): GameSlug {
    if (path.startsWith("/games/snake")) return "snake";
    if (path.startsWith("/games/tetris")) return "tetris";
    if (path.startsWith("/games/bomberman")) return "bomberman";
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

  private emptyTetrisBoard(): TetrisBoard {
    return Array.from({ length: TETRIS_ROWS }, () => Array<TetrisCell>(TETRIS_COLS).fill(null));
  }

  private drawTetrisKind(runtime: TetrisRuntime): string {
    if (!runtime.bag.length) {
      runtime.bag = [...TETRIS_ORDER].sort(() => Math.random() - 0.5);
    }
    return runtime.bag.pop() ?? "T";
  }

  private tetrisDropInterval(level: number) {
    return Math.max(TETRIS_DROP_MIN_MS, TETRIS_DROP_BASE_MS - (level - 1) * 70);
  }

  private tetrisFits(board: TetrisBoard, kind: string, rot: number, r: number, c: number) {
    const cells = TETRIS_SHAPES[kind][rot % TETRIS_SHAPES[kind].length];
    for (const [dr, dc] of cells) {
      const rr = r + dr;
      const cc = c + dc;
      if (cc < 0 || cc >= TETRIS_COLS || rr >= TETRIS_ROWS) return false;
      if (rr >= 0 && board[rr][cc]) return false;
    }
    return true;
  }

  private buildTetrisBoardSnapshot(runtime: TetrisRuntime): TetrisBoard {
    const snapshot = runtime.board.map((row) => row.slice());
    const a = runtime.active;
    if (!a) return snapshot;
    const cells = TETRIS_SHAPES[a.kind][a.rot % TETRIS_SHAPES[a.kind].length];
    for (const [dr, dc] of cells) {
      const rr = a.r + dr;
      const cc = a.c + dc;
      if (rr >= 0 && rr < TETRIS_ROWS && cc >= 0 && cc < TETRIS_COLS) {
        snapshot[rr][cc] = a.kind;
      }
    }
    return snapshot;
  }

  private refreshTetrisScreen(id: string) {
    const player = this.tetrisPlayers.get(id);
    const runtime = this.tetrisRuntime.get(id);
    if (!player || !runtime) return;
    this.tetrisScreens.set(id, {
      id,
      name: player.name,
      phase: player.done ? "game_over" : player.active ? "playing" : "menu",
      score: player.score,
      lines: runtime.lines,
      level: runtime.level,
      board: this.buildTetrisBoardSnapshot(runtime),
      next: runtime.next,
      updatedAt: Date.now(),
    });
  }

  private spawnTetris(runtime: TetrisRuntime) {
    const kind = runtime.next;
    runtime.next = this.drawTetrisKind(runtime);
    for (const sr of [0, -1, 1, -2]) {
      if (this.tetrisFits(runtime.board, kind, 0, sr, 3)) {
        runtime.active = { kind, r: sr, c: 3, rot: 0 };
        return true;
      }
    }
    runtime.active = null;
    return false;
  }

  private lockTetrisPiece(id: string) {
    const player = this.tetrisPlayers.get(id);
    const runtime = this.tetrisRuntime.get(id);
    if (!player || !runtime || !runtime.active) return;
    const a = runtime.active;
    const cells = TETRIS_SHAPES[a.kind][a.rot % TETRIS_SHAPES[a.kind].length];
    for (const [dr, dc] of cells) {
      const rr = a.r + dr;
      const cc = a.c + dc;
      // Bagian mino di atas baris 0 (zona spawn) wajar saat lock — jangan langsung game over.
      if (rr < 0) continue;
      if (rr < TETRIS_ROWS && cc >= 0 && cc < TETRIS_COLS) {
        runtime.board[rr][cc] = a.kind;
      }
    }

    let cleared = 0;
    let y = TETRIS_ROWS - 1;
    while (y >= 0) {
      if (runtime.board[y].every((cell) => cell !== null)) {
        cleared += 1;
        runtime.board.splice(y, 1);
        runtime.board.unshift(Array<TetrisCell>(TETRIS_COLS).fill(null));
      } else {
        y -= 1;
      }
    }

    if (cleared > 0) {
      const add = [0, 100, 300, 500, 800][cleared] ?? 0;
      player.score += add * runtime.level;
      runtime.lines += cleared;
      runtime.level = 1 + Math.floor(runtime.lines / 10);
    }

    runtime.active = null;
    if (!this.spawnTetris(runtime)) {
      player.done = true;
      player.active = false;
    }
  }

  private stepTetris(id: string) {
    const player = this.tetrisPlayers.get(id);
    const runtime = this.tetrisRuntime.get(id);
    if (!player || !runtime || !player.active || player.done || !runtime.active) return;
    const a = runtime.active;
    if (this.tetrisFits(runtime.board, a.kind, a.rot, a.r + 1, a.c)) {
      a.r += 1;
    } else {
      this.lockTetrisPiece(id);
    }
  }

  private setTetrisInput(id: string, action: string) {
    if (this.tetrisPhase !== "playing") return;
    const player = this.tetrisPlayers.get(id);
    const runtime = this.tetrisRuntime.get(id);
    if (!player || !runtime || !player.active || player.done || !runtime.active) return;

    const a = runtime.active;
    if (!a) return;

    if (action === "left") {
      if (this.tetrisFits(runtime.board, a.kind, a.rot, a.r, a.c - 1)) a.c -= 1;
    } else if (action === "right") {
      if (this.tetrisFits(runtime.board, a.kind, a.rot, a.r, a.c + 1)) a.c += 1;
    } else if (action === "soft_drop") {
      if (this.tetrisFits(runtime.board, a.kind, a.rot, a.r + 1, a.c)) {
        a.r += 1;
        player.score += 1;
      } else {
        this.lockTetrisPiece(id);
      }
    } else if (action === "rotate_cw" || action === "rotate_ccw") {
      const dir = action === "rotate_cw" ? 1 : -1;
      const nextRot = (a.rot + dir + 4) % 4;
      for (const kick of [0, -1, 1, -2, 2]) {
        if (this.tetrisFits(runtime.board, a.kind, nextRot, a.r, a.c + kick)) {
          a.rot = nextRot;
          a.c += kick;
          break;
        }
      }
    } else if (action === "hard_drop") {
      while (runtime.active && this.tetrisFits(runtime.board, a.kind, a.rot, a.r + 1, a.c)) {
        a.r += 1;
      }
      player.score += 2;
      this.lockTetrisPiece(id);
    } else if (action === "toggle_pause") {
      // reserved: no-op for authoritative round mode
    }

    this.refreshTetrisScreen(id);
    this.broadcastTetrisState();
    this.tryFinishTetrisRound();
  }

  private startTetrisTick() {
    if (this.tetrisTickTimer !== null) return;
    this.tetrisTickTimer = setInterval(() => this.tickTetrisRound(), TETRIS_TICK_MS) as unknown as number;
  }

  private stopTetrisTick() {
    if (this.tetrisTickTimer !== null) {
      clearInterval(this.tetrisTickTimer);
      this.tetrisTickTimer = null;
    }
  }

  private tickTetrisRound() {
    if (this.tetrisPhase !== "playing") return;
    let changed = false;
    for (const [id, player] of this.tetrisPlayers) {
      if (!player.active || player.done) continue;
      const runtime = this.tetrisRuntime.get(id);
      if (!runtime) continue;
      runtime.dropMs -= TETRIS_TICK_MS;
      const interval = this.tetrisDropInterval(runtime.level);
      while (runtime.dropMs <= 0 && player.active && !player.done) {
        runtime.dropMs += interval;
        this.stepTetris(id);
        changed = true;
      }
      this.refreshTetrisScreen(id);
    }
    if (changed) {
      this.broadcastTetrisState();
      this.tryFinishTetrisRound();
    }
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
    this.tetrisRuntime.delete(current.id);
    this.bomberPlayers.delete(current.id);

    current.id = existingId;
    current.session = session;
    this.sessionToClientId.set(session, existingId);

    const tp = this.tetrisPlayers.get(existingId);
    if (tp) {
      tp.connected = true;
      this.clearTetrisDisconnectTimer(existingId);
    }
  }

  private syncTetrisPresence(id: string) {
    const inTetris = this.tetrisPageUserIds().has(id);
    if (!inTetris) {
      this.tetrisPlayers.delete(id);
      this.tetrisScreens.delete(id);
      this.tetrisRuntime.delete(id);
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

    if (this.tetrisPhase === "lobby" || this.tetrisPhase === "finished") {
      tp.spectator = false;
    } else if (this.tetrisPhase === "playing" && !tp.active) {
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
        this.tetrisRuntime.delete(id);
      }
    }
    for (const id of this.tetrisScreens.keys()) {
      const p = this.tetrisPlayers.get(id);
      if (!tetrisUsers.has(id) && !p?.active) {
        this.tetrisScreens.delete(id);
        this.tetrisRuntime.delete(id);
      }
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
    if (this.tetrisPhase === "lobby" || this.tetrisPhase === "finished") {
      tp.spectator = false;
    }
    tp.ready = value;
    this.broadcastTetrisState();
    this.tryStartTetrisRound();
  }

  private tryStartTetrisRound() {
    if (this.tetrisPhase === "playing") return;
    if (this.tetrisPhase === "finished") return;
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
        const runtime: TetrisRuntime = {
          board: this.emptyTetrisBoard(),
          active: null,
          bag: [],
          next: "T",
          dropMs: TETRIS_DROP_BASE_MS,
          lines: 0,
          level: 1,
        };
        runtime.next = this.drawTetrisKind(runtime);
        this.spawnTetris(runtime);
        this.tetrisRuntime.set(p.id, runtime);
        this.refreshTetrisScreen(p.id);
      } else if (tetrisUsers.has(p.id)) {
        p.spectator = true;
        p.active = false;
        this.tetrisRuntime.delete(p.id);
        this.tetrisScreens.delete(p.id);
      } else {
        p.active = false;
        this.tetrisRuntime.delete(p.id);
        this.tetrisScreens.delete(p.id);
      }
    }

    this.startTetrisTick();
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
    this.stopTetrisTick();
    for (const id of this.tetrisDisconnectTimers.keys()) {
      this.clearTetrisDisconnectTimer(id);
    }
    this.tetrisPhase = "finished";
    this.tetrisWinnerId = winnerId;
    {
      const tetrisUsers = this.tetrisPageUserIds();
      for (const p of this.tetrisPlayers.values()) {
        if (tetrisUsers.has(p.id)) {
          p.spectator = false;
        }
      }
    }
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
        this.tetrisRuntime.delete(p.id);
        this.tetrisScreens.delete(p.id);
      }
      this.tetrisPhase = "lobby";
      this.tetrisWinnerId = null;
      this.broadcastTetrisState();
    }, 2200) as unknown as number;
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
    if (this.phase === "lobby" || this.phase === "finished") {
      player.spectator = false;
    } else if (this.phase === "playing" && !player.alive) {
      player.spectator = true;
    }
  }

  private setReady(id: string, value: boolean) {
    const p = this.players.get(id);
    if (!p) return;
    const inSnake = this.snakePageUserIds().has(id);
    if (!inSnake) return;
    if (this.phase === "playing") return;
    if (this.phase === "lobby" || this.phase === "finished") {
      p.spectator = false;
    }
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
    if (this.phase === "finished") return;
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
    {
      const snakeUsers = this.snakePageUserIds();
      for (const p of this.players.values()) {
        if (snakeUsers.has(p.id)) {
          p.spectator = false;
        }
      }
    }
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

  private bomberPageUserIds() {
    const ids = new Set<string>();
    for (const c of this.clients.values()) {
      if (c.game === "bomberman") ids.add(c.id);
    }
    return ids;
  }

  private ensureBomberPlayer(id: string, name: string) {
    if (this.bomberPlayers.has(id)) return;
    this.bomberPlayers.set(id, {
      id,
      name,
      ready: false,
      spectator: false,
      alive: false,
      score: 0,
      row: 1,
      col: 1,
      pending: { dr: 0, dc: 0 },
      bombRange: 1,
      maxBombs: 1,
    });
  }

  private syncBomberPresence(id: string) {
    const onPage = this.bomberPageUserIds().has(id);
    if (!onPage) {
      this.bomberPlayers.delete(id);
      return;
    }
    const c = [...this.clients.values()].find((x) => x.id === id);
    if (!c) return;
    this.ensureBomberPlayer(id, c.name);
    const p = this.bomberPlayers.get(id);
    if (!p) return;
    p.name = c.name;
    if (this.bomberPhase === "lobby" || this.bomberPhase === "finished") {
      p.spectator = false;
    } else if (this.bomberPhase === "playing" && !p.alive) {
      p.spectator = true;
    }
  }

  private syncBomberAfterLeave() {
    const ids = this.bomberPageUserIds();
    for (const id of [...this.bomberPlayers.keys()]) {
      if (!ids.has(id)) this.bomberPlayers.delete(id);
    }
    if (this.bomberPhase === "playing") {
      this.tryFinishBomberRound();
    }
  }

  private isBomberSpawnSafe(r: number, c: number) {
    const zones: [number, number][] = [
      [1, 1],
      [1, 2],
      [2, 1],
      [1, BOMBER_COLS - 2],
      [1, BOMBER_COLS - 3],
      [2, BOMBER_COLS - 2],
      [BOMBER_ROWS - 2, 1],
      [BOMBER_ROWS - 2, 2],
      [BOMBER_ROWS - 3, 1],
      [BOMBER_ROWS - 2, BOMBER_COLS - 2],
      [BOMBER_ROWS - 2, BOMBER_COLS - 3],
      [BOMBER_ROWS - 3, BOMBER_COLS - 2],
    ];
    return zones.some(([rr, cc]) => rr === r && cc === c);
  }

  private createBomberGrid(): number[][] {
    const g: number[][] = [];
    for (let r = 0; r < BOMBER_ROWS; r++) {
      const row: number[] = [];
      for (let c = 0; c < BOMBER_COLS; c++) {
        if (r === 0 || c === 0 || r === BOMBER_ROWS - 1 || c === BOMBER_COLS - 1) {
          row.push(1);
        } else if (
          r % 2 === 0 &&
          c % 2 === 0 &&
          r > 0 &&
          c > 0 &&
          r < BOMBER_ROWS - 1 &&
          c < BOMBER_COLS - 1
        ) {
          // Pilar di (genap, genap) — jangan (ganjil, ganjil) agar tidak bentrok dengan spawn sudut (1,1), dll.
          row.push(1);
        } else if (this.isBomberSpawnSafe(r, c)) {
          row.push(0);
        } else {
          row.push(Math.random() < 0.52 ? 2 : 0);
        }
      }
      g.push(row);
    }
    return g;
  }

  private setBomberReady(id: string, value: boolean) {
    if (!this.bomberPageUserIds().has(id)) return;
    const c = [...this.clients.values()].find((x) => x.id === id);
    if (!c) return;
    this.ensureBomberPlayer(id, c.name);
    const p = this.bomberPlayers.get(id);
    if (!p) return;
    if (this.bomberPhase === "playing") return;
    if (this.bomberPhase === "lobby" || this.bomberPhase === "finished") {
      p.spectator = false;
    }
    p.ready = value;
    this.broadcastBomberState();
    this.tryStartBomberRound();
  }

  private tryStartBomberRound() {
    if (this.bomberPhase === "playing") return;
    if (this.bomberPhase === "finished") return;
    const users = this.bomberPageUserIds();
    const candidates = [...this.bomberPlayers.values()].filter((p) => users.has(p.id) && !p.spectator);
    if (candidates.length < 2) return;
    if (!candidates.every((p) => p.ready)) return;
    this.startBomberRound(candidates);
  }

  private startBomberRound(active: BomberPlayer[]) {
    this.bomberPhase = "playing";
    this.bomberRound += 1;
    this.bomberWinnerId = null;
    if (this.bomberFinishTimeout !== null) {
      clearTimeout(this.bomberFinishTimeout);
      this.bomberFinishTimeout = null;
    }
    this.bomberGrid = this.createBomberGrid();
    this.bomberBombs = [];
    this.bomberExplosions = [];
    this.bomberPowerups = [];

    const spawns: [number, number][] = [
      [1, 1],
      [1, BOMBER_COLS - 2],
      [BOMBER_ROWS - 2, 1],
      [BOMBER_ROWS - 2, BOMBER_COLS - 2],
    ];

    const userIds = this.bomberPageUserIds();
    for (const p of this.bomberPlayers.values()) {
      p.ready = false;
      p.alive = false;
      p.spectator = true;
      p.pending = { dr: 0, dc: 0 };
      p.bombRange = 1;
      p.maxBombs = 1;
    }

    active.forEach((p, i) => {
      const [sr, sc] = spawns[i % spawns.length];
      p.spectator = false;
      p.alive = true;
      p.row = sr;
      p.col = sc;
      p.score = 0;
    });

    for (const p of this.bomberPlayers.values()) {
      if (userIds.has(p.id) && !active.some((a) => a.id === p.id)) {
        p.spectator = true;
        p.alive = false;
      }
    }

    this.resolveBomberOverlaps();
    this.startBomberTick();
    this.broadcastBomberState();
  }

  private resolveBomberOverlaps() {
    const occupied = new Map<string, string>();
    for (const p of this.bomberPlayers.values()) {
      if (!p.alive || p.spectator) continue;
      const k = `${p.row},${p.col}`;
      if (occupied.has(k)) {
        const otherId = occupied.get(k)!;
        const other = this.bomberPlayers.get(otherId);
        if (other) {
          const dirs: Vec[] = [
            { dr: 0, dc: 1 },
            { dr: 0, dc: -1 },
            { dr: 1, dc: 0 },
            { dr: -1, dc: 0 },
          ];
          let moved = false;
          for (const d of dirs) {
            const nr = p.row + d.dr;
            const nc = p.col + d.dc;
            if (this.canBomberWalk(nr, nc, p.id)) {
              p.row = nr;
              p.col = nc;
              moved = true;
              break;
            }
          }
          if (!moved) {
            for (const d of dirs) {
              const nr = other.row + d.dr;
              const nc = other.col + d.dc;
              if (this.canBomberWalk(nr, nc, other.id)) {
                other.row = nr;
                other.col = nc;
                break;
              }
            }
          }
        }
      }
      occupied.set(`${p.row},${p.col}`, p.id);
    }
  }

  private startBomberTick() {
    if (this.bomberTickTimer !== null) return;
    this.bomberTickTimer = setInterval(() => this.tickBomber(), BOMBER_TICK_MS) as unknown as number;
  }

  private stopBomberTick() {
    if (this.bomberTickTimer !== null) {
      clearInterval(this.bomberTickTimer);
      this.bomberTickTimer = null;
    }
  }

  private canBomberWalk(r: number, c: number, selfId: string) {
    if (r < 0 || c < 0 || r >= BOMBER_ROWS || c >= BOMBER_COLS) return false;
    if (this.bomberGrid[r][c] !== 0) return false;
    if (this.bomberBombs.some((b) => b.row === r && b.col === c)) return false;
    for (const p of this.bomberPlayers.values()) {
      if (!p.alive || p.spectator || p.id === selfId) continue;
      if (p.row === r && p.col === c) return false;
    }
    return true;
  }

  private setBomberDirection(id: string, dir: string) {
    if (this.bomberPhase !== "playing") return;
    const p = this.bomberPlayers.get(id);
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
    const v = map[dir];
    if (!v) return;
    p.pending = { dr: 0, dc: 0 };
    const nr = p.row + v.dr;
    const nc = p.col + v.dc;
    if (!this.canBomberWalk(nr, nc, p.id)) {
      this.broadcastBomberState();
      return;
    }
    p.row = nr;
    p.col = nc;
    const pu = this.bomberPowerups.findIndex((x) => x.row === nr && x.col === nc);
    if (pu >= 0) {
      const k = this.bomberPowerups[pu]!.kind;
      this.bomberPowerups.splice(pu, 1);
      if (k === "range") p.bombRange = Math.min(BOMBER_MAX_RANGE, p.bombRange + 1);
      if (k === "bomb") p.maxBombs = Math.min(BOMBER_MAX_BOMBS, p.maxBombs + 1);
    }
    this.broadcastBomberState();
    this.tryFinishBomberRound();
  }

  private tryPlaceBomberBomb(id: string) {
    if (this.bomberPhase !== "playing") return;
    const p = this.bomberPlayers.get(id);
    if (!p || !p.alive || p.spectator) return;
    const owned = this.bomberBombs.filter((b) => b.ownerId === id).length;
    if (owned >= p.maxBombs) return;
    if (this.bomberBombs.some((b) => b.row === p.row && b.col === p.col)) return;
    this.bomberBombs.push({
      id: crypto.randomUUID(),
      row: p.row,
      col: p.col,
      ticks: BOMBER_BOMB_FUSE_TICKS,
      range: p.bombRange,
      ownerId: id,
    });
    this.broadcastBomberState();
  }

  private tickBomber() {
    if (this.bomberPhase !== "playing") return;

    const toExplode: BomberBomb[] = [];
    for (const b of this.bomberBombs) {
      b.ticks -= 1;
      if (b.ticks <= 0) toExplode.push(b);
    }
    if (toExplode.length > 0) {
      this.processBomberExplosionChain(toExplode);
    }

    this.bomberExplosions = this.bomberExplosions
      .map((e) => ({ ...e, ttl: e.ttl - 1 }))
      .filter((e) => e.ttl > 0);

    this.broadcastBomberState();
    this.tryFinishBomberRound();
  }

  /** One simultaneous wave: expired bombs + chain reactions. */
  private processBomberExplosionChain(seeds: BomberBomb[]) {
    const flame = new Set<string>();
    const queue: BomberBomb[] = [...seeds];
    const exploded = new Set<string>();
    const primaryOwnerId = seeds[0]?.ownerId ?? "";

    const addRayForBomb = (b: BomberBomb, dr: number, dc: number) => {
      let r = b.row;
      let c = b.col;
      for (let i = 0; i < b.range; i++) {
        r += dr;
        c += dc;
        if (r < 0 || c < 0 || r >= BOMBER_ROWS || c >= BOMBER_COLS) break;
        const cell = this.bomberGrid[r][c];
        if (cell === 1) break;
        flame.add(`${r},${c}`);
        const other = this.bomberBombs.find((bb) => bb.row === r && bb.col === c);
        if (other && !exploded.has(other.id)) {
          flame.add(`${r},${c}`);
          queue.push(other);
          break;
        }
        if (cell === 2) break;
      }
    };

    while (queue.length) {
      const b = queue.shift()!;
      if (exploded.has(b.id)) continue;
      exploded.add(b.id);
      this.bomberBombs = this.bomberBombs.filter((x) => x.id !== b.id);
      flame.add(`${b.row},${b.col}`);
      addRayForBomb(b, -1, 0);
      addRayForBomb(b, 1, 0);
      addRayForBomb(b, 0, -1);
      addRayForBomb(b, 0, 1);
    }

    for (const key of flame) {
      const [rs, cs] = key.split(",").map(Number) as [number, number];
      this.bomberExplosions.push({ row: rs, col: cs, ttl: BOMBER_EXPLO_TTL });
      if (this.bomberGrid[rs][cs] === 2) {
        this.bomberGrid[rs][cs] = 0;
        if (Math.random() < 0.34) {
          const kind: "range" | "bomb" = Math.random() < 0.5 ? "range" : "bomb";
          if (!this.bomberPowerups.some((p) => p.row === rs && p.col === cs)) {
            this.bomberPowerups.push({ row: rs, col: cs, kind });
          }
        }
      }
    }

    const killer = primaryOwnerId ? this.bomberPlayers.get(primaryOwnerId) : null;
    for (const p of this.bomberPlayers.values()) {
      if (!p.alive || p.spectator) continue;
      if (flame.has(`${p.row},${p.col}`)) {
        p.alive = false;
        p.spectator = true;
        if (killer && killer.id !== p.id && killer.alive && !killer.spectator) {
          killer.score += 100;
        }
      }
    }
  }

  private tryFinishBomberRound() {
    if (this.bomberPhase !== "playing") return;
    const alive = [...this.bomberPlayers.values()].filter((p) => p.alive && !p.spectator);
    if (alive.length <= 1) {
      this.finishBomberRound(alive[0]?.id ?? null);
    }
  }

  private finishBomberRound(winnerId: string | null) {
    if (this.bomberPhase !== "playing") return;
    this.stopBomberTick();
    this.bomberPhase = "finished";
    this.bomberWinnerId = winnerId;
    this.bomberBombs = [];
    {
      const users = this.bomberPageUserIds();
      for (const p of this.bomberPlayers.values()) {
        if (users.has(p.id)) {
          p.spectator = false;
        }
      }
    }
    this.broadcastBomberState();

    this.bomberFinishTimeout = setTimeout(() => {
      const users = this.bomberPageUserIds();
      for (const p of this.bomberPlayers.values()) {
        p.ready = false;
        p.alive = false;
        p.spectator = false;
        p.score = 0;
        if (!users.has(p.id)) this.bomberPlayers.delete(p.id);
      }
      this.bomberPhase = "lobby";
      this.bomberWinnerId = null;
      this.bomberExplosions = [];
      this.bomberPowerups = [];
      this.bomberGrid = [];
      this.broadcastBomberState();
    }, 3200) as unknown as number;
  }

  private broadcastBomberState() {
    for (const c of this.clients.values()) {
      if (c.game !== "bomberman") continue;
      this.ensureBomberPlayer(c.id, c.name);
      const bp = this.bomberPlayers.get(c.id);
      if (bp && (this.bomberPhase === "lobby" || this.bomberPhase === "finished")) {
        bp.spectator = false;
      }
    }
    const users = this.bomberPageUserIds();
    const players = [...this.bomberPlayers.values()]
      .filter((p) => users.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
        spectator: p.spectator,
        alive: p.alive,
        score: p.score,
        row: p.row,
        col: p.col,
        bombRange: p.bombRange,
        maxBombs: p.maxBombs,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const grid =
      this.bomberGrid.length > 0
        ? this.bomberGrid.map((row) => row.map((v) => v as 0 | 1 | 2))
        : Array.from({ length: BOMBER_ROWS }, () => Array<0 | 1 | 2>(BOMBER_COLS).fill(0));

    this.broadcast({
      type: "bomber_state",
      phase: this.bomberPhase,
      round: this.bomberRound,
      winnerId: this.bomberWinnerId,
      rows: BOMBER_ROWS,
      cols: BOMBER_COLS,
      grid,
      players,
      bombs: this.bomberBombs.map((b) => ({
        id: b.id,
        row: b.row,
        col: b.col,
        ticks: b.ticks,
        range: b.range,
        ownerId: b.ownerId,
      })),
      explosions: this.bomberExplosions.map((e) => ({
        row: e.row,
        col: e.col,
        ttl: e.ttl,
      })),
      powerups: this.bomberPowerups.map((p) => ({ row: p.row, col: p.col, kind: p.kind })),
    });
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
      bomberman: users.filter((u) => u.game === "bomberman").length,
    };
    this.broadcast({ type: "presence", users, counts });
  }

  private broadcastSnakeState() {
    for (const c of this.clients.values()) {
      if (c.game !== "snake") continue;
      this.ensurePlayer(c.id, c.name);
      const sp = this.players.get(c.id);
      if (sp && (this.phase === "lobby" || this.phase === "finished")) {
        sp.spectator = false;
      }
    }
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
    for (const c of this.clients.values()) {
      if (c.game !== "tetris") continue;
      this.ensureTetrisPlayer(c.id, c.name);
      const tp = this.tetrisPlayers.get(c.id);
      if (tp && (this.tetrisPhase === "lobby" || this.tetrisPhase === "finished")) {
        tp.spectator = false;
      }
    }
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
      rows: TETRIS_ROWS,
      cols: TETRIS_COLS,
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
