export type GameSlug = "hub" | "snake" | "tetris" | "typing" | "minecraft";
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
  typing: number;
  minecraft: number;
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
