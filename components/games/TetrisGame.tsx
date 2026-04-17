"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboardState } from "@/lib/game/useKeyboardState";
import { useRafTicker } from "@/lib/game/useRafTicker";

const COLS = 10;
const ROWS = 22;
const CELL = 28;
const PANEL_W = 160;
const CW = COLS * CELL + PANEL_W;
const CH = (ROWS - 2) * CELL;
const SIDEBAR_X = COLS * CELL + 12;

type Cell = string | null;
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

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

export function TetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<Cell[][]>(emptyBoard());
  const activeRef = useRef<Active | null>(null);
  const nextRef = useRef<string>("T");
  const bagRef = useRef<string[]>([]);
  const dropRef = useRef(800);
  const stateRef = useRef<GameState>("menu");
  const prevPlayingRef = useRef(false);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameState, setGameState] = useState<GameState>("menu");

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
      "← → : geser",
      "↑ / X : putar",
      "↓ : turun",
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
  }, [drawPiece, redraw, refill, spawn]);

  useKeyboardState({
    active: true,
    onKeyDown: (key, event) => {
      if (key === "escape") {
        if (stateRef.current === "playing") {
          stateRef.current = "menu";
          setGameState("menu");
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

      if (key === "arrowleft") tryMove(-1);
      else if (key === "arrowright") tryMove(1);
      else if (key === "arrowdown") {
        const a = activeRef.current;
        if (a && fits(a.kind, a.rot, a.r + 1, a.c)) {
          a.r += 1;
          setScore((s) => s + 1);
        }
      } else if (key === "arrowup" || key === "x") {
        tryRotate();
      } else if (key === "z") {
        for (let i = 0; i < 3; i++) tryRotate();
      } else if (key === " ") {
        event.preventDefault();
        hardDrop();
      }
      redraw();
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
  }, [gameState, redraw]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-8">
      <h1 className="text-xl font-bold text-[#e8ecff]">Tetris</h1>
      <p className="mt-2 text-center text-sm text-[#8f96ac]">
        Parity Python: panah, X/Z, Spasi, P, ESC, ENTER.
      </p>
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        className="mt-4 max-w-full rounded-lg border border-[#2a3142]"
      />
      <div className="mt-4 flex gap-3">
        {(gameState === "menu" || gameState === "game_over") && (
          <button
            type="button"
            onClick={newGame}
            className="rounded-lg bg-[#3d4860] px-4 py-2 text-sm text-white hover:bg-[#4d5a78]"
          >
            {gameState === "game_over" ? "Main lagi" : "Mulai"}
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-[#8f96ac]">
        {statusText} · Skor {score} · Baris {lines} · Level {level}
      </p>
    </div>
  );
}
