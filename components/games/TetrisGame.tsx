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
  const {
    selfId,
    tetrisState,
    sendTetrisSnapshot,
    sendTetrisReady,
    connected,
    users,
  } = useRealtime();
  const boardRef = useRef<TetrisCell[][]>(emptyBoard());
  const activeRef = useRef<Active | null>(null);
  const nextRef = useRef<string>("T");
  const bagRef = useRef<string[]>([]);
  const dropRef = useRef(800);
  const stateRef = useRef<GameState>("menu");
  const prevPlayingRef = useRef(false);
  const lastSnapshotMsRef = useRef(0);
  const startedRoundRef = useRef<number>(-1);
  const hiddenTickLastMsRef = useRef<number>(0);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const [showLosePopup, setShowLosePopup] = useState(false);
  const [watchAfterLose, setWatchAfterLose] = useState(false);
  const [winnerPopupText, setWinnerPopupText] = useState("");
  const queueGameState = useCallback((next: GameState) => {
    queueMicrotask(() => setGameState(next));
  }, []);
  const queueWinnerPopup = useCallback((message: string) => {
    queueMicrotask(() => {
      setWinnerPopupText(message);
      setShowWinnerPopup(true);
    });
  }, []);
  const prevRoomPhaseRef = useRef<string>("");
  const prevDoneRef = useRef(false);

  const myRoomState = useMemo(
    () => (tetrisState?.roster ?? []).find((p) => p.id === selfId) ?? null,
    [selfId, tetrisState]
  );
  const canPlayThisRound = !!myRoomState?.active && !myRoomState?.spectator;
  const isSpectatorMode = !!myRoomState?.spectator && tetrisState?.phase === "playing";
  const lostWhileRoundPlaying =
    tetrisState?.phase === "playing" && !!myRoomState?.active && !!myRoomState?.done;
  const shouldShowSpectatorView = isSpectatorMode || (lostWhileRoundPlaying && watchAfterLose);

  const otherPlayingBoards = useMemo(() => {
    return (tetrisState?.players ?? []).filter(
      (p) => p.id !== selfId && (p.phase === "playing" || p.phase === "paused")
    );
  }, [tetrisState, selfId]);

  const waitingReadyCount = useMemo(() => {
    if (!tetrisState) return 0;
    return (tetrisState.roster ?? []).filter((p) => !p.spectator && !p.ready).length;
  }, [tetrisState]);
  const roomRoster = useMemo(() => {
    return [...(tetrisState?.roster ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [tetrisState]);

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
      if (!tetrisState) return;
      if (tetrisState.phase === "playing" && !canPlayThisRound) return;
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
    [canPlayThisRound, level, lines, score, sendTetrisSnapshot, tetrisState]
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
        if (tetrisState?.phase === "lobby" && myRoomState && !myRoomState.spectator) {
          sendTetrisReady(!myRoomState.ready);
        }
        return;
      }
      if (!canPlayThisRound || tetrisState?.phase !== "playing") return;
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

  const tickGame = useCallback(
    (deltaMs: number, shouldRedraw: boolean) => {
      const playing = stateRef.current === "playing";
      if (playing) {
        dropRef.current -= deltaMs;
        const interval = Math.max(50, 800 - (level - 1) * 70);
        while (dropRef.current <= 0 && stateRef.current === "playing") {
          dropRef.current += interval;
          softDropOne();
        }
      } else if (prevPlayingRef.current) {
        dropRef.current = Math.max(50, 800 - (level - 1) * 70);
      }
      prevPlayingRef.current = playing;
      if (shouldRedraw) redraw();
      pushSnapshot();
    },
    [level, pushSnapshot, redraw, softDropOne]
  );

  useRafTicker({
    running: true,
    onFrame: (deltaMs) => {
      if (typeof document !== "undefined" && document.hidden) return;
      tickGame(deltaMs, true);
    },
    maxDeltaMs: 120000,
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        hiddenTickLastMsRef.current = 0;
        return;
      }
      const now = performance.now();
      if (hiddenTickLastMsRef.current === 0) {
        hiddenTickLastMsRef.current = now;
        return;
      }
      const delta = Math.max(1, now - hiddenTickLastMsRef.current);
      hiddenTickLastMsRef.current = now;
      tickGame(delta, false);
    }, 200);

    const onVisibility = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        hiddenTickLastMsRef.current = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tickGame]);

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

  useEffect(() => {
    if (!tetrisState) return;

    if (
      tetrisState.phase === "playing" &&
      canPlayThisRound &&
      startedRoundRef.current !== tetrisState.round
    ) {
      startedRoundRef.current = tetrisState.round;
      boardRef.current = emptyBoard();
      refill();
      nextRef.current = drawPiece();
      setScore(0);
      setLines(0);
      setLevel(1);
      if (spawn()) {
        stateRef.current = "playing";
        queueGameState("playing");
      } else {
        stateRef.current = "game_over";
        queueGameState("game_over");
      }
      dropRef.current = 800;
      redraw();
      pushSnapshot(true);
      return;
    }

    if (tetrisState.phase === "playing" && !canPlayThisRound) {
      stateRef.current = "menu";
      queueGameState("menu");
      boardRef.current = emptyBoard();
      activeRef.current = null;
      redraw();
      return;
    }

    if (tetrisState.phase !== "playing") {
      startedRoundRef.current = -1;
      stateRef.current = "menu";
      queueGameState("menu");
      boardRef.current = emptyBoard();
      activeRef.current = null;
      redraw();
      pushSnapshot(true);
    }
  }, [canPlayThisRound, drawPiece, pushSnapshot, queueGameState, redraw, refill, spawn, tetrisState]);

  useEffect(() => {
    if (!tetrisState) return;
    if (lostWhileRoundPlaying && !prevDoneRef.current) {
      queueMicrotask(() => setShowLosePopup(true));
    }
    if (
      tetrisState.phase === "finished" &&
      prevRoomPhaseRef.current !== "finished" &&
      tetrisState.winnerId === selfId
    ) {
      queueWinnerPopup("Kamu menang ronde ini!");
    }
    if (
      tetrisState.phase === "finished" &&
      prevRoomPhaseRef.current !== "finished" &&
      tetrisState.winnerId !== selfId &&
      !!myRoomState &&
      myRoomState.active &&
      myRoomState.done &&
      !watchAfterLose
    ) {
      queueMicrotask(() => setShowLosePopup(true));
    }
    prevDoneRef.current = !!myRoomState?.done;
    prevRoomPhaseRef.current = tetrisState.phase;
  }, [lostWhileRoundPlaying, myRoomState, queueWinnerPopup, selfId, tetrisState, watchAfterLose]);

  useEffect(() => {
    if (!tetrisState || tetrisState.phase !== "playing") {
      queueMicrotask(() => setWatchAfterLose(false));
      prevDoneRef.current = false;
    }
  }, [tetrisState]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,#2a2746_0%,#121423_56%,#0b0d12_100%)] p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#eef3ff]">Tetris Multiplayer</h1>
        <p className="mt-2 text-sm text-[#9aa7c4]">
          Setiap pemain punya board sendiri. User yang masuk saat ronde berjalan akan jadi spectator
          sampai ronde selesai. Kontrol: <span className="text-[#e8ecff]">WASD + Q + Spasi</span>.
        </p>
        <p className="mt-3 text-xs text-[#8a95b2]">
          Realtime {connected ? "terhubung" : "terputus"} · user di room tetris: {onlineTetrisUsers} ·
          round {tetrisState?.round ?? 0} · fase {tetrisState?.phase ?? "lobby"}
        </p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {!shouldShowSpectatorView ? (
          <section className="rounded-2xl border border-white/10 bg-[#111726] p-4">
            <canvas
              ref={canvasRef}
              width={CW}
              height={CH}
              className="max-w-full rounded-lg border border-[#2a3142]"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-[#8f96ac]">
                {statusText} · Skor {score} · Baris {lines} · Level {level}
              </p>
              {tetrisState?.phase === "lobby" && (
                <p className="text-xs text-[#9aa7c4]">Menunggu ready: {waitingReadyCount}</p>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-white/10 bg-[#111726] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#e9ecf4]">Spectate pemain aktif</h2>
              <span className="text-xs text-[#8f96ac]">{otherPlayingBoards.length} board aktif</span>
            </div>
            <p className="mb-3 text-xs text-[#ffdc78]">
              {isSpectatorMode
                ? "Kamu join saat ronde sedang berjalan, jadi spectate dulu sampai ronde selesai."
                : "Kamu sudah kalah di ronde ini. Sekarang spectate sampai ronde selesai."}
            </p>
            {otherPlayingBoards.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/15 bg-[#0d1220] px-3 py-4 text-sm text-[#8f96ac]">
                Belum ada board aktif untuk ditonton.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {otherPlayingBoards.map((player) => (
                  <SpectatorBoard key={player.id} player={player} />
                ))}
              </div>
            )}
          </section>
        )}

        <aside className="rounded-2xl border border-white/10 bg-[#111726] p-4">
          <h2 className="text-sm font-semibold text-[#e9ecf4]">Room Tetris</h2>
          <p className="mt-2 text-xs text-[#9aa7c4]">
            Fase: <span className="text-[#e8ecff]">{tetrisState?.phase ?? "lobby"}</span> ·
            Menunggu ready: <span className="text-[#e8ecff]">{waitingReadyCount}</span>
          </p>

          {tetrisState?.phase === "lobby" && myRoomState && !myRoomState.spectator && (
            <button
              type="button"
              onClick={() => sendTetrisReady(!myRoomState.ready)}
              className="mt-3 w-full rounded-lg bg-[#3d4860] px-4 py-2 text-sm text-white hover:bg-[#4d5a78]"
            >
              {myRoomState.ready ? "Batal Ready" : "Ready"}
            </button>
          )}

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#8f96ac]">
            User di room
          </h3>
          <ul className="mt-2 space-y-1.5 text-xs text-[#9aa7c4]">
            {roomRoster.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-md border border-white/10 bg-[#0f1420] px-2.5 py-2"
              >
                <span className="truncate text-[#e8ecff]">
                  {p.name}
                  {p.id === selfId ? " (kamu)" : ""}
                </span>
                <span className="text-[#8f96ac]">
                  {p.spectator ? "spectator" : p.done ? "kalah" : p.ready ? "ready" : "idle"}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {showWinnerPopup && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-sm rounded-xl border border-[#3a4660] bg-[#111725] p-5">
            <h3 className="text-lg font-semibold text-[#e8ecff]">Winner</h3>
            <p className="mt-2 text-sm text-[#9db0d0]">{winnerPopupText}</p>
            <button
              type="button"
              onClick={() => setShowWinnerPopup(false)}
              className="mt-4 w-full rounded-lg bg-[#3d4860] px-4 py-2 text-sm text-white hover:bg-[#4d5a78]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showLosePopup && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-sm rounded-xl border border-[#5b3841] bg-[#1a1116] p-5">
            <h3 className="text-lg font-semibold text-[#ffd9df]">Kamu kalah</h3>
            <p className="mt-2 text-sm text-[#e3b7c1]">
              Ronde ini selesai untukmu. Setelah popup ditutup, kamu akan spectate sampai ronde selesai.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowLosePopup(false);
                setWatchAfterLose(true);
              }}
              className="mt-4 w-full rounded-lg bg-[#6e3a48] px-4 py-2 text-sm text-white hover:bg-[#844656]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
