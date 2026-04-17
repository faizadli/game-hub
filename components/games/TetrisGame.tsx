"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboardState } from "@/lib/game/useKeyboardState";
import { useRafTicker } from "@/lib/game/useRafTicker";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import type { TetrisBoard, TetrisCell, TetrisPlayerScreen } from "@/lib/realtime/types";

const COLS = 10;
const ROWS = 22;
const CELL = 28;
const PANEL_W = 160;
const CW = COLS * CELL + PANEL_W;
const CH = (ROWS - 2) * CELL;
const SIDEBAR_X = COLS * CELL + 12;

type GameState = "menu" | "playing" | "paused" | "game_over";
type Active = { kind: string; r: number; c: number; rot: number };
const COLORS: Record<string, string> = {
  I: "#00f0f0",
  O: "#f0f000",
  T: "#a000f0",
  S: "#00f000",
  Z: "#f00000",
  J: "#0000f0",
  L: "#f0a000",
};

const SHAPES: Record<string, [number, number][][]> = {
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

const ORDER = ["I", "O", "T", "S", "Z", "J", "L"] as const;

function emptyBoard(): TetrisCell[][] {
  return Array.from({ length: ROWS }, () => Array<TetrisCell>(COLS).fill(null));
}

function composeBoardSnapshot(
  board: TetrisCell[][],
  active: Active | null
): TetrisBoard {
  const snapshot = board.map((row) => row.slice());
  if (!active) return snapshot;
  const cells = SHAPES[active.kind][active.rot % SHAPES[active.kind].length];
  for (const [dr, dc] of cells) {
    const rr = active.r + dr;
    const cc = active.c + dc;
    if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
      snapshot[rr][cc] = active.kind;
    }
  }
  return snapshot;
}

function SpectatorBoard({ player }: { player: TetrisPlayerScreen }) {
  const visible = player.board.slice(2);
  return (
    <article className="rounded-xl border border-white/10 bg-[#121827] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="truncate text-sm font-medium text-[#e8ecff]">{player.name}</p>
        <span className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-[#b6c2de]">
          {player.phase}
        </span>
      </div>
      <div
        className="grid gap-px rounded-md bg-[#0d1018] p-1"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {visible.flatMap((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${player.id}-${r}-${c}`}
              className="aspect-square rounded-[2px]"
              style={{
                backgroundColor: cell ? COLORS[cell] ?? "#6b7280" : "#1a2235",
              }}
            />
          ))
        )}
      </div>
      <p className="mt-2 text-xs text-[#8f9bb7]">
        Skor {player.score} · Baris {player.lines} · Level {player.level}
      </p>
    </article>
  );
}

export function TetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { selfId, tetrisState, sendTetrisSnapshot, connected, users } = useRealtime();
  const boardRef = useRef<TetrisCell[][]>(emptyBoard());
  const activeRef = useRef<Active | null>(null);
  const nextRef = useRef<string>("T");
  const bagRef = useRef<string[]>([]);
  const dropRef = useRef(800);
  const stateRef = useRef<GameState>("menu");
  const prevPlayingRef = useRef(false);
  const lastSnapshotMsRef = useRef(0);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameState, setGameState] = useState<GameState>("menu");

  const otherPlayingBoards = useMemo(() => {
    return (tetrisState?.players ?? []).filter(
      (p) => p.id !== selfId && (p.phase === "playing" || p.phase === "paused")
    );
  }, [tetrisState, selfId]);

  const onlineTetrisUsers = useMemo(
    () => users.filter((u) => u.game === "tetris").length,
    [users]
  );

  const refill = useCallback(() => {
    const b = [...ORDER].sort(() => Math.random() - 0.5);
    bagRef.current = b;
  }, []);

  const drawPiece = useCallback(() => {
    if (!bagRef.current.length) refill();
    return bagRef.current.pop()!;
  }, [refill]);

  const fits = useCallback((kind: string, rot: number, r: number, c: number) => {
    const cells = SHAPES[kind][rot % SHAPES[kind].length];
    const b = boardRef.current;
    for (const [dr, dc] of cells) {
      const rr = r + dr;
      const cc = c + dc;
      if (cc < 0 || cc >= COLS || rr >= ROWS) return false;
      if (rr >= 0 && b[rr][cc]) return false;
    }
    return true;
  }, []);

  const spawn = useCallback(() => {
    const kind = nextRef.current;
    nextRef.current = drawPiece();
    for (const sr of [0, -1, 1, -2]) {
      if (fits(kind, 0, sr, 3)) {
        activeRef.current = { kind, r: sr, c: 3, rot: 0 };
        return true;
      }
    }
    return false;
  }, [drawPiece, fits]);

  const lock = useCallback(() => {
    const a = activeRef.current;
    if (!a) return;
    const cells = SHAPES[a.kind][a.rot % SHAPES[a.kind].length];
    const b = boardRef.current;
    for (const [dr, dc] of cells) {
      const rr = a.r + dr;
      const cc = a.c + dc;
      if (rr < 0) {
        stateRef.current = "game_over";
        setGameState("game_over");
        activeRef.current = null;
        return;
      }
      if (rr >= 0 && rr < ROWS) b[rr][cc] = a.kind;
    }
    let cleared = 0;
    let y = ROWS - 1;
    while (y >= 0) {
      if (b[y].every((x) => x !== null)) {
        cleared++;
        b.splice(y, 1);
        b.unshift(Array(COLS).fill(null));
      } else y--;
    }
    if (cleared) {
      const add = [0, 100, 300, 500, 800][cleared] ?? 0;
      setScore((s) => s + add * level);
      setLines((l) => {
        const nl = l + cleared;
        setLevel(1 + Math.floor(nl / 10));
        return nl;
      });
    }
    activeRef.current = null;
    if (!spawn()) {
      stateRef.current = "game_over";
      setGameState("game_over");
      activeRef.current = null;
      return;
    }
    dropRef.current = Math.max(50, 800 - (level - 1) * 70);
  }, [level, spawn]);

  const ghostPiece = useCallback((a: Active) => {
    let g = { ...a };
    while (fits(g.kind, g.rot, g.r + 1, g.c)) {
      g = { ...g, r: g.r + 1 };
    }
    return g;
  }, [fits]);

  const drawCell = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      color: string,
      outline = "#2a3040"
    ) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, CELL, CELL);
      ctx.strokeStyle = outline;
      ctx.strokeRect(x, y, CELL, CELL);
    },
    []
  );

  const paint = useCallback((ctx: CanvasRenderingContext2D) => {
    const vis = 2;
    ctx.fillStyle = "#1a1d28";
    ctx.fillRect(0, 0, CW, CH);

    const b = boardRef.current;
    for (let r = vis; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = b[r][c];
        const y = (r - vis) * CELL;
        const x = c * CELL;
        const color = cell ? COLORS[cell] ?? "#666" : "#252830";
        drawCell(ctx, x, y, color);
      }
    }

    if (stateRef.current === "menu") {
      ctx.fillStyle = "#0c0e14";
      ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "#e8ecff";
      ctx.font = "700 18px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("TETRIS", (COLS * CELL) / 2, CH / 2 - 60);
      ctx.fillStyle = "#90c0ff";
      ctx.font = "14px Segoe UI";
      ctx.fillText("ENTER — mulai", (COLS * CELL) / 2, CH / 2 - 10);
      ctx.fillStyle = "#7080a0";
      ctx.fillText("ESC — keluar", (COLS * CELL) / 2, CH / 2 + 20);
      return;
    }

    const a = activeRef.current;
    if (a && ["playing", "paused", "game_over"].includes(stateRef.current)) {
      const g = ghostPiece(a);
      const ghostCells = SHAPES[g.kind][g.rot % SHAPES[g.kind].length];
      for (const [dr, dc] of ghostCells) {
        const rr = g.r + dr;
        const cc = g.c + dc;
        if (rr < vis) continue;
        const x = cc * CELL;
        const y = (rr - vis) * CELL;
        drawCell(ctx, x, y, "#303040");
        ctx.strokeStyle = COLORS[a.kind] ?? "#fff";
        ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
      }

      const cells = SHAPES[a.kind][a.rot % SHAPES[a.kind].length];
      for (const [dr, dc] of cells) {
        const r = a.r + dr;
        const c = a.c + dc;
        if (r < vis) continue;
        const y = (r - vis) * CELL;
        const x = c * CELL;
        drawCell(ctx, x, y, COLORS[a.kind] ?? "#fff");
      }
    }

    ctx.fillStyle = "#c8d0e0";
    ctx.font = "14px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Skor", SIDEBAR_X, 16);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 20px Segoe UI";
    ctx.fillText(String(score), SIDEBAR_X, 38);
    ctx.fillStyle = "#c8d0e0";
    ctx.font = "14px Segoe UI";
    ctx.fillText("Baris", SIDEBAR_X, 86);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 20px Segoe UI";
    ctx.fillText(String(lines), SIDEBAR_X, 108);
    ctx.fillStyle = "#c8d0e0";
    ctx.font = "14px Segoe UI";
    ctx.fillText("Level", SIDEBAR_X, 156);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 20px Segoe UI";
    ctx.fillText(String(level), SIDEBAR_X, 178);

    ctx.fillStyle = "#c8d0e0";
    ctx.font = "14px Segoe UI";
    ctx.fillText("Berikut", SIDEBAR_X, 234);
    const shape = SHAPES[nextRef.current][0];
    const minR = Math.min(...shape.map((v) => v[0]));
    const minC = Math.min(...shape.map((v) => v[1]));
    const pCell = CELL / 2;
    for (const [dr, dc] of shape) {
      const rr = dr - minR;
      const cc = dc - minC;
      const x0 = SIDEBAR_X + cc * pCell;
      const y0 = 250 + rr * pCell;
      ctx.fillStyle = COLORS[nextRef.current] ?? "#fff";
      ctx.fillRect(x0, y0, pCell, pCell);
      ctx.strokeStyle = "#3a4050";
      ctx.strokeRect(x0, y0, pCell, pCell);
    }

    const help = [
      "A / D : geser",
      "W : putar kanan",
      "S : turun",
      "Q : putar kiri",
      "Spasi : hard drop",
      "P : jeda",
      "ESC : menu",
    ];
    ctx.fillStyle = "#8890a8";
    ctx.font = "12px Segoe UI";
    let hy = CH - 120;
    for (const line of help) {
      ctx.fillText(line, SIDEBAR_X, hy);
      hy += 16;
    }

    if (stateRef.current === "paused" || stateRef.current === "game_over") {
      ctx.fillStyle = "#181c28";
      ctx.fillRect(8, 8, COLS * CELL - 16, CH - 16);
      ctx.strokeStyle = "#405070";
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, COLS * CELL - 16, CH - 16);
      ctx.fillStyle = stateRef.current === "paused" ? "#f0e080" : "#f08080";
      ctx.font = "700 18px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(
        stateRef.current === "paused"
          ? "Jeda — tekan P"
          : "Game Over — ENTER main lagi",
        (COLS * CELL) / 2,
        CH / 2
      );
      ctx.textAlign = "left";
    }
  }, [drawCell, ghostPiece, level, lines, score]);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    paint(ctx);
  }, [paint]);

  const pushSnapshot = useCallback(
    (force = false) => {
      const now = Date.now();
      if (!force && now - lastSnapshotMsRef.current < 120) return;
      lastSnapshotMsRef.current = now;
      sendTetrisSnapshot({
        phase: stateRef.current,
        score,
        lines,
        level,
        board: composeBoardSnapshot(boardRef.current, activeRef.current),
        next: nextRef.current ?? null,
      });
    },
    [level, lines, score, sendTetrisSnapshot]
  );

  const softDropOne = useCallback(() => {
    if (stateRef.current !== "playing") return;
    const a = activeRef.current;
    if (!a) return;
    if (fits(a.kind, a.rot, a.r + 1, a.c)) {
      a.r += 1;
    } else {
      lock();
    }
  }, [fits, lock]);

  const tryMove = useCallback((dcol: number) => {
    if (stateRef.current !== "playing") return;
    const a = activeRef.current;
    if (!a) return;
    if (fits(a.kind, a.rot, a.r, a.c + dcol)) {
      a.c += dcol;
    }
  }, [fits]);

  const tryRotate = useCallback(() => {
    if (stateRef.current !== "playing") return;
    const a = activeRef.current;
    if (!a) return;
    const nr = (a.rot + 1) % 4;
    for (const kick of [0, -1, 1, -2, 2]) {
      if (fits(a.kind, nr, a.r, a.c + kick)) {
        a.rot = nr;
        a.c += kick;
        return;
      }
    }
  }, [fits]);

  const hardDrop = useCallback(() => {
    if (stateRef.current !== "playing") return;
    const a = activeRef.current;
    if (!a) return;
    while (fits(a.kind, a.rot, a.r + 1, a.c)) {
      a.r += 1;
    }
    setScore((s) => s + 2);
    softDropOne();
    if (activeRef.current) {
      dropRef.current = Math.max(50, 800 - (level - 1) * 70);
    }
  }, [fits, level, softDropOne]);

  const newGame = useCallback(() => {
    boardRef.current = emptyBoard();
    refill();
    nextRef.current = drawPiece();
    setScore(0);
    setLines(0);
    setLevel(1);
    if (spawn()) {
      stateRef.current = "playing";
      setGameState("playing");
    } else {
      stateRef.current = "game_over";
      setGameState("game_over");
    }
    dropRef.current = 800;
    redraw();
    pushSnapshot(true);
  }, [drawPiece, pushSnapshot, redraw, refill, spawn]);

  useKeyboardState({
    active: true,
    onKeyDown: (key, event) => {
      if (["w", "a", "s", "d", " "].includes(key)) {
        event.preventDefault();
      }
      if (key === "escape") {
        if (stateRef.current === "playing") {
          stateRef.current = "menu";
          setGameState("menu");
          pushSnapshot(true);
        }
        return;
      }
      if (key === "p") {
        if (stateRef.current === "playing") {
          stateRef.current = "paused";
          setGameState("paused");
        } else if (stateRef.current === "paused") {
          stateRef.current = "playing";
          setGameState("playing");
        }
        pushSnapshot(true);
        return;
      }
      if (key === "enter") {
        if (stateRef.current === "menu" || stateRef.current === "game_over") {
          newGame();
        }
        return;
      }
      if (stateRef.current === "paused") return;
      if (stateRef.current !== "playing") return;

      if (key === "a") tryMove(-1);
      else if (key === "d") tryMove(1);
      else if (key === "s") {
        const a = activeRef.current;
        if (a && fits(a.kind, a.rot, a.r + 1, a.c)) {
          a.r += 1;
          setScore((s) => s + 1);
        }
      } else if (key === "w") {
        tryRotate();
      } else if (key === "q") {
        for (let i = 0; i < 3; i++) tryRotate();
      } else if (key === " ") {
        event.preventDefault();
        hardDrop();
      }
      redraw();
      pushSnapshot();
    },
  });

  useRafTicker({
    running: true,
    onFrame: (deltaMs) => {
      const playing = stateRef.current === "playing";
      if (playing) {
        dropRef.current -= deltaMs;
        if (dropRef.current <= 0) {
          dropRef.current = Math.max(50, 800 - (level - 1) * 70);
          softDropOne();
        }
      } else if (prevPlayingRef.current) {
        dropRef.current = Math.max(50, 800 - (level - 1) * 70);
      }
      prevPlayingRef.current = playing;
      redraw();
      pushSnapshot();
    },
  });

  const statusText = useMemo(() => {
    if (gameState === "menu") return "ENTER untuk mulai";
    if (gameState === "paused") return "Jeda";
    if (gameState === "game_over") return "Game over";
    return "Main";
  }, [gameState]);

  useEffect(() => {
    redraw();
    pushSnapshot(true);
  }, [gameState, pushSnapshot, redraw]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,#2a2746_0%,#121423_56%,#0b0d12_100%)] p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#eef3ff]">Tetris Multiplayer</h1>
        <p className="mt-2 text-sm text-[#9aa7c4]">
          Setiap pemain punya board sendiri. Mode spectate menampilkan semua board aktif.
          Kontrol: <span className="text-[#e8ecff]">WASD + Q + Spasi</span>.
        </p>
        <p className="mt-3 text-xs text-[#8a95b2]">
          Realtime {connected ? "terhubung" : "terputus"} · user di room tetris: {onlineTetrisUsers}
        </p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-white/10 bg-[#111726] p-4">
          <canvas
            ref={canvasRef}
            width={CW}
            height={CH}
            className="max-w-full rounded-lg border border-[#2a3142]"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {(gameState === "menu" || gameState === "game_over") && (
              <button
                type="button"
                onClick={newGame}
                className="rounded-lg bg-[#3d4860] px-4 py-2 text-sm text-white hover:bg-[#4d5a78]"
              >
                {gameState === "game_over" ? "Main lagi" : "Mulai"}
              </button>
            )}
            <p className="text-sm text-[#8f96ac]">
              {statusText} · Skor {score} · Baris {lines} · Level {level}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111726] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#e9ecf4]">Spectate pemain lain</h2>
            <span className="text-xs text-[#8f96ac]">{otherPlayingBoards.length} board aktif</span>
          </div>
          {otherPlayingBoards.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/15 bg-[#0d1220] px-3 py-4 text-sm text-[#8f96ac]">
              Belum ada pemain lain yang sedang bermain.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {otherPlayingBoards.map((player) => (
                <SpectatorBoard key={player.id} player={player} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
