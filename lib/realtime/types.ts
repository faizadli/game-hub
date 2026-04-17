export type GameSlug = "hub" | "snake" | "tetris";
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
