export type GameSlug = "hub" | "snake" | "tetris" | "bomberman" | "flappy";
export type SnakePhase = "lobby" | "playing" | "finished";

export type PresenceUser = {
  id: string;
  name: string;
  page: string;
  game: GameSlug;
};

export type GameCounts = {
  total: number;
  hub: number;
  snake: number;
  tetris: number;
  bomberman: number;
  flappy: number;
};

export type SnakePlayerState = {
  id: string;
  name: string;
  ready: boolean;
  spectator: boolean;
  alive: boolean;
  score: number;
};

export type SnakeBoardCell = { row: number; col: number };

export type SnakeRealtimeState = {
  phase: SnakePhase;
  players: SnakePlayerState[];
  snakes: Record<string, SnakeBoardCell[]>;
  food: SnakeBoardCell | null;
  winnerId: string | null;
  round: number;
  rows: number;
  cols: number;
};

export type TetrisPhase = "menu" | "playing" | "paused" | "game_over";

export type TetrisCell = string | null;

export type TetrisBoard = TetrisCell[][];

export type TetrisPlayerScreen = {
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

export type TetrisRoomPhase = "lobby" | "playing" | "finished";
export type TetrisInputAction =
  | "left"
  | "right"
  | "soft_drop"
  | "rotate_cw"
  | "rotate_ccw"
  | "hard_drop"
  | "toggle_pause";

export type TetrisPlayerState = {
  id: string;
  name: string;
  ready: boolean;
  spectator: boolean;
  active: boolean;
  done: boolean;
  score: number;
};

export type TetrisRealtimeState = {
  phase: TetrisRoomPhase;
  round: number;
  winnerId: string | null;
  rows: number;
  cols: number;
  roster: TetrisPlayerState[];
  players: TetrisPlayerScreen[];
};

export type BomberPhase = "lobby" | "playing" | "finished";

/** 0 empty, 1 hard wall, 2 soft block */
export type BomberCell = 0 | 1 | 2;

export type BomberBombState = {
  id: string;
  row: number;
  col: number;
  ticks: number;
  range: number;
  ownerId: string;
};

export type BomberExplosionCell = { row: number; col: number; ttl: number };

export type BomberPowerupKind = "range" | "bomb";

export type BomberPowerupCell = { row: number; col: number; kind: BomberPowerupKind };

export type BomberPlayerState = {
  id: string;
  name: string;
  ready: boolean;
  spectator: boolean;
  alive: boolean;
  score: number;
  row: number;
  col: number;
  bombRange: number;
  maxBombs: number;
};

export type BomberRealtimeState = {
  phase: BomberPhase;
  round: number;
  winnerId: string | null;
  rows: number;
  cols: number;
  grid: BomberCell[][];
  players: BomberPlayerState[];
  bombs: BomberBombState[];
  explosions: BomberExplosionCell[];
  powerups: BomberPowerupCell[];
};
