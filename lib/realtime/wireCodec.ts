import type {
  BomberRealtimeState,
  MazeRealtimeState,
  SnakeBoardCell,
  SnakeRealtimeState,
  TetrisBoard,
  TetrisCell,
  TetrisPlayerScreen,
  TetrisRealtimeState,
} from "./types";

/** Paket posisi ular: `row * cols + col` per segmen (lebih ringan dari `{row,col}`). */
export function packSnakeCell(row: number, col: number, cols: number): number {
  return row * cols + col;
}

export function unpackSnakeCells(cols: number, packed: number[]): SnakeBoardCell[] {
  return packed.map((v) => ({ row: Math.floor(v / cols), col: v % cols }));
}

export function buildSnakeWirePayload(args: {
  phase: SnakeRealtimeState["phase"];
  players: SnakeRealtimeState["players"];
  snakes: Record<string, SnakeBoardCell[]>;
  food: SnakeBoardCell | null;
  winnerId: string | null;
  round: number;
  rows: number;
  cols: number;
}) {
  const { rows, cols } = args;
  const snakesP: Record<string, number[]> = {};
  for (const [id, segs] of Object.entries(args.snakes)) {
    snakesP[id] = segs.map((s) => packSnakeCell(s.row, s.col, cols));
  }
  const foodP = args.food == null ? -1 : packSnakeCell(args.food.row, args.food.col, cols);
  return {
    type: "snake_state" as const,
    phase: args.phase,
    players: args.players,
    snakesP,
    foodP,
    winnerId: args.winnerId,
    round: args.round,
    rows,
    cols,
  };
}

export function decodeSnakeWire(msg: Record<string, unknown>): SnakeRealtimeState {
  const rows = Number(msg.rows) || 18;
  const cols = Number(msg.cols) || 24;
  if (msg.snakesP && typeof msg.snakesP === "object" && !Array.isArray(msg.snakesP)) {
    const snakes: Record<string, SnakeBoardCell[]> = {};
    for (const [id, arr] of Object.entries(msg.snakesP as Record<string, unknown>)) {
      if (!Array.isArray(arr)) continue;
      const nums = arr.filter((x): x is number => typeof x === "number");
      snakes[id] = unpackSnakeCells(cols, nums);
    }
    const fp = msg.foodP;
    const food =
      typeof fp === "number" && fp >= 0 ? { row: Math.floor(fp / cols), col: fp % cols } : null;
    return {
      phase: msg.phase as SnakeRealtimeState["phase"],
      players: (msg.players as SnakeRealtimeState["players"]) ?? [],
      snakes,
      food,
      winnerId: (msg.winnerId as string | null) ?? null,
      round: Number(msg.round) || 0,
      rows,
      cols,
    };
  }
  return msg as unknown as SnakeRealtimeState;
}

/** Satu baris per baris papan Tetris: `.` = kosong, satu char = jenis blok. */
export function encodeTetrisBoard(board: TetrisCell[][], rows: number, cols: number): string {
  let s = "";
  for (let r = 0; r < rows; r++) {
    const row = board[r];
    for (let c = 0; c < cols; c++) {
      const cell = row?.[c] ?? null;
      s += cell == null ? "." : cell;
    }
  }
  return s;
}

export function decodeTetrisBoard(s: string, rows: number, cols: number): TetrisBoard {
  const out: TetrisBoard = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const row: TetrisCell[] = [];
    for (let c = 0; c < cols; c++) {
      const ch = s[i++] ?? ".";
      row.push(ch === "." ? null : ch);
    }
    out.push(row);
  }
  return out;
}

export function decodeTetrisWire(msg: Record<string, unknown>): TetrisRealtimeState {
  const rows = Number(msg.rows) || 22;
  const cols = Number(msg.cols) || 10;
  const raw = (msg.players as Array<Record<string, unknown>> | undefined) ?? [];
  const players: TetrisPlayerScreen[] = raw.map((p) => {
    if (typeof p.boardS === "string") {
      const { boardS, ...rest } = p;
      return {
        ...(rest as Omit<TetrisPlayerScreen, "board">),
        board: decodeTetrisBoard(boardS, rows, cols),
      };
    }
    return p as unknown as TetrisPlayerScreen;
  });
  return {
    ...(msg as unknown as TetrisRealtimeState),
    players,
  };
}

export function encodeBomberGrid(grid: (0 | 1 | 2)[][]): string {
  let s = "";
  for (const row of grid) {
    for (const v of row) s += String(v);
  }
  return s;
}

export function decodeBomberGrid(s: string, rows: number, cols: number): (0 | 1 | 2)[][] {
  const out: (0 | 1 | 2)[][] = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const row: (0 | 1 | 2)[] = [];
    for (let c = 0; c < cols; c++) {
      const ch = s[i++] ?? "0";
      row.push(Number(ch) as 0 | 1 | 2);
    }
    out.push(row);
  }
  return out;
}

export function decodeBomberWire(msg: Record<string, unknown>): BomberRealtimeState {
  const rows = Number(msg.rows) || 11;
  const cols = Number(msg.cols) || 13;
  let grid: BomberRealtimeState["grid"];
  if (typeof msg.gridS === "string" && msg.gridS.length === rows * cols) {
    grid = decodeBomberGrid(msg.gridS, rows, cols);
  } else if (Array.isArray(msg.grid)) {
    grid = msg.grid as BomberRealtimeState["grid"];
  } else {
    grid = Array.from({ length: rows }, () => Array(cols).fill(0) as (0 | 1 | 2)[]);
  }
  return {
    phase: msg.phase as BomberRealtimeState["phase"],
    round: Number(msg.round) || 0,
    winnerId: (msg.winnerId as string | null) ?? null,
    rows,
    cols,
    grid,
    players: (msg.players as BomberRealtimeState["players"]) ?? [],
    bombs: (msg.bombs as BomberRealtimeState["bombs"]) ?? [],
    explosions: (msg.explosions as BomberRealtimeState["explosions"]) ?? [],
    powerups: (msg.powerups as BomberRealtimeState["powerups"]) ?? [],
  };
}

export function encodeMazeGrid(grid: (0 | 1)[][]): string {
  let s = "";
  for (const row of grid) {
    for (const v of row) s += String(v);
  }
  return s;
}

export function decodeMazeGrid(s: string, rows: number, cols: number): (0 | 1)[][] {
  const out: (0 | 1)[][] = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const row: (0 | 1)[] = [];
    for (let c = 0; c < cols; c++) {
      const ch = s[i++] ?? "0";
      row.push(Number(ch) as 0 | 1);
    }
    out.push(row);
  }
  return out;
}

export function decodeMazeWire(msg: Record<string, unknown>): MazeRealtimeState {
  const rows = Number(msg.rows) || 17;
  const cols = Number(msg.cols) || 25;
  const gridVisible = !!msg.gridVisible;
  let rawGrid: MazeRealtimeState["grid"];
  if (gridVisible && typeof msg.gridS === "string" && msg.gridS.length >= rows * cols) {
    rawGrid = decodeMazeGrid(msg.gridS, rows, cols);
  } else if (Array.isArray(msg.grid)) {
    rawGrid = msg.grid as MazeRealtimeState["grid"];
  } else {
    rawGrid = Array.from({ length: rows }, () => Array(cols).fill(0 as 0 | 1));
  }
  const grid = gridVisible
    ? rawGrid
    : Array.from({ length: rows }, () => Array(cols).fill(0 as 0 | 1));
  return {
    phase: msg.phase as MazeRealtimeState["phase"],
    round: Number(msg.round) || 0,
    winnerId: (msg.winnerId as string | null) ?? null,
    rows,
    cols,
    start: (msg.start as MazeRealtimeState["start"]) ?? { row: 1, col: 1 },
    goal: (msg.goal as MazeRealtimeState["goal"]) ?? { row: rows - 2, col: cols - 2 },
    gridVisible,
    revealUntilMs: (msg.revealUntilMs as number | null) ?? null,
    grid,
    players: (msg.players as MazeRealtimeState["players"]) ?? [],
  };
}

export function toTetrisPlayerWire(
  screen: {
    id: string;
    name: string;
    phase: TetrisPlayerScreen["phase"];
    score: number;
    lines: number;
    level: number;
    board: TetrisBoard;
    next: string | null;
    updatedAt: number;
  },
  rows: number,
  cols: number
): Omit<TetrisPlayerScreen, "board"> & { boardS: string } {
  return {
    id: screen.id,
    name: screen.name,
    phase: screen.phase,
    score: screen.score,
    lines: screen.lines,
    level: screen.level,
    boardS: encodeTetrisBoard(screen.board, rows, cols),
    next: screen.next,
    updatedAt: screen.updatedAt,
  };
}
