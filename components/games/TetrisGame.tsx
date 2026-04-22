"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GamePageHeroTitle } from "@/components/game-ui/GamePageHeroTitle";
import { PrismGameHeader } from "@/components/game-ui/PrismGameHeader";
import { MobileTetrisControls } from "@/components/games/MobileTetrisControls";
import { useKeyboardState } from "@/lib/game/useKeyboardState";
import {
  useRealtimeActions,
  useRealtimeHub,
  useTetrisGameState,
} from "@/components/realtime/RealtimeProvider";
import { useMobileGameUi } from "@/lib/hooks/useMobileGameUi";
import type { TetrisBoard, TetrisPlayerScreen } from "@/lib/realtime/types";

const COLS = 10;
const ROWS = 22;
const CELL = 28;
const BOARD_W = COLS * CELL;
const BOARD_H = (ROWS - 2) * CELL;
const COLORS: Record<string, string> = {
  I: "#00f0f0",
  O: "#f0f000",
  T: "#a000f0",
  S: "#00f000",
  Z: "#f00000",
  J: "#0000f0",
  L: "#f0a000",
};

/** Relative cell positions for next-piece preview (spawn orientation). */
const PREVIEW_BLOCKS: Record<string, { r: number; c: number }[]> = {
  I: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ].map(([r, c]) => ({ r, c })),
  O: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ].map(([r, c]) => ({ r, c })),
  T: [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, 2],
  ].map(([r, c]) => ({ r, c })),
  S: [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
  ].map(([r, c]) => ({ r, c })),
  Z: [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
  ].map(([r, c]) => ({ r, c })),
  J: [
    [0, 0],
    [1, 0],
    [1, 1],
    [1, 2],
  ].map(([r, c]) => ({ r, c })),
  L: [
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
  ].map(([r, c]) => ({ r, c })),
};

function formatScore(n: number): string {
  const s = String(Math.max(0, Math.floor(n))).padStart(6, "0");
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function NextPiecePreview({ piece }: { piece: string | null | undefined }) {
  const key = (piece?.trim() ?? "").charAt(0).toUpperCase();
  const blocks = PREVIEW_BLOCKS[key];
  if (!blocks?.length) {
    return (
      <div className="flex h-24 items-center justify-center">
        <span className="font-headline text-2xl font-black text-on-surface-variant">—</span>
      </div>
    );
  }
  const rows = 4;
  const cols = 4;
  const minR = Math.min(...blocks.map((b) => b.r));
  const minC = Math.min(...blocks.map((b) => b.c));
  const grid = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  for (const b of blocks) {
    const r = b.r - minR;
    const c = b.c - minC;
    if (r >= 0 && r < rows && c >= 0 && c < cols) grid[r][c] = true;
  }
  const color = COLORS[key] ?? "#666";
  return (
    <div className="flex h-24 items-center justify-center">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {grid.flatMap((row, r) =>
          row.map((on, c) => (
            <div
              key={`${r}-${c}`}
              className="h-5 w-5 rounded-sm"
              style={
                on
                  ? {
                      backgroundColor: color,
                      boxShadow: `0 0 12px ${color}`,
                    }
                  : { visibility: "hidden" }
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function emptyBoard(): TetrisBoard {
  return Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));
}

function SpectatorBoard({ player }: { player: TetrisPlayerScreen }) {
  const visible = player.board.slice(2);
  return (
    <article className="glass-panel rounded-3xl p-4 shadow-luxe">
      <div className="mb-2 flex items-center justify-between">
        <p className="truncate text-sm font-medium text-on-surface">{player.name}</p>
        <span className="rounded-md border border-outline-variant/20 px-2 py-0.5 text-[11px] text-on-surface-variant">
          {player.phase}
        </span>
      </div>
      <div
        className="grid gap-px rounded-md bg-white p-1 shadow-inner"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {visible.flatMap((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${player.id}-${r}-${c}`}
              className="aspect-square rounded-[2px]"
              style={{
                backgroundColor: cell ? COLORS[cell] ?? "#6b7280" : "#f1f5f9",
              }}
            />
          ))
        )}
      </div>
      <p className="mt-2 text-xs text-on-surface-variant">
        Skor {player.score} · Baris {player.lines} · Level {player.level}
      </p>
    </article>
  );
}

export function TetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { selfId, connected, users } = useRealtimeHub();
  const tetrisState = useTetrisGameState();
  const { sendTetrisReady, sendTetrisInput } = useRealtimeActions();
  const mobileUi = useMobileGameUi();
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const [showLosePopup, setShowLosePopup] = useState(false);
  const [watchAfterLose, setWatchAfterLose] = useState(false);
  const [winnerPopupText, setWinnerPopupText] = useState("");
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
  const canPlayThisRound = !!myRoomState?.active && !myRoomState?.spectator && !myRoomState?.done;
  const isSpectatorMode = !!myRoomState?.spectator && tetrisState?.phase === "playing";
  const lostWhileRoundPlaying =
    tetrisState?.phase === "playing" && !!myRoomState?.active && !!myRoomState?.done;
  const shouldShowSpectatorView = isSpectatorMode || (lostWhileRoundPlaying && watchAfterLose);

  const myScreen = useMemo(
    () => (tetrisState?.players ?? []).find((p) => p.id === selfId) ?? null,
    [selfId, tetrisState]
  );
  const myBoard = myScreen?.board ?? emptyBoard();

  const otherPlayingBoards = useMemo(() => {
    return (tetrisState?.players ?? []).filter(
      (p) => p.id !== selfId && (p.phase === "playing" || p.phase === "paused")
    );
  }, [tetrisState, selfId]);

  const waitingReadyCount = useMemo(() => {
    if (!tetrisState) return 0;
    if (tetrisState.phase === "playing") return 0;
    return (tetrisState.roster ?? []).filter((p) => !p.spectator && !p.ready).length;
  }, [tetrisState]);
  const rankedRoomPlayers = useMemo(() => {
    const roster = tetrisState?.roster ?? [];
    const screens = new Map((tetrisState?.players ?? []).map((p) => [p.id, p]));
    return [...roster]
      .map((r) => {
        const sc = screens.get(r.id);
        return {
          ...r,
          score: sc?.score ?? r.score ?? 0,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [tetrisState]);

  const onlineTetrisUsers = useMemo(
    () => users.filter((u) => u.game === "tetris").length,
    [users]
  );

  const tetrisHeaderUsers = useMemo(
    () => users.filter((u) => u.game === "tetris").map((u) => ({ id: u.id, name: u.name })),
    [users]
  );

  const drawCell = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      color: string,
      outline = "#e2e8f0"
    ) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, CELL, CELL);
      ctx.strokeStyle = outline;
      ctx.strokeRect(x, y, CELL, CELL);
    },
    []
  );

  const paint = useCallback((ctx: CanvasRenderingContext2D, board: TetrisBoard, screen: TetrisPlayerScreen | null) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    for (let r = 2; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        const y = (r - 2) * CELL;
        const x = c * CELL;
        const color = cell ? COLORS[cell] ?? "#666" : "#f1f5f9";
        drawCell(ctx, x, y, color);
      }
    }

    if (screen?.phase === "paused" || screen?.phase === "game_over") {
      ctx.fillStyle = "rgba(245,247,249,0.92)";
      ctx.fillRect(8, 8, BOARD_W - 16, BOARD_H - 16);
      ctx.strokeStyle = "#abadaf";
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, BOARD_W - 16, BOARD_H - 16);
      ctx.fillStyle = screen.phase === "paused" ? "#f0e080" : "#f08080";
      ctx.font = "700 18px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(
        screen.phase === "paused" ? "Jeda" : "Game Over",
        BOARD_W / 2,
        BOARD_H / 2
      );
      ctx.textAlign = "left";
    }
  }, [drawCell]);

  const redraw = useCallback((board: TetrisBoard, screen: TetrisPlayerScreen | null) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    paint(ctx, board, screen);
  }, [paint]);

  const onTetrisKeyDown = useCallback(
    (key: string, event: KeyboardEvent) => {
      if (["w", "a", "s", "d", " "].includes(key)) {
        event.preventDefault();
      }
      if (key === "enter") {
        if (tetrisState?.phase === "lobby" && myRoomState && !myRoomState.spectator) {
          sendTetrisReady(!myRoomState.ready);
        }
        return;
      }
      if (!canPlayThisRound || tetrisState?.phase !== "playing") return;
      if (key === "a") sendTetrisInput("left");
      else if (key === "d") sendTetrisInput("right");
      else if (key === "s") sendTetrisInput("soft_drop");
      else if (key === "w") sendTetrisInput("rotate_cw");
      else if (key === "p") sendTetrisInput("toggle_pause");
      else if (key === " ") {
        event.preventDefault();
        sendTetrisInput("hard_drop");
      }
    },
    [
      canPlayThisRound,
      myRoomState,
      sendTetrisInput,
      sendTetrisReady,
      tetrisState?.phase,
    ]
  );

  useKeyboardState({
    active: true,
    onKeyDown: onTetrisKeyDown,
  });

  const statusText = useMemo(() => {
    if (tetrisState?.phase === "lobby") return "ENTER untuk ready";
    if (myScreen?.phase === "game_over") return "Game over";
    return myScreen?.phase ?? "menu";
  }, [myScreen, tetrisState]);

  useEffect(() => {
    redraw(myBoard, myScreen);
  }, [myBoard, myScreen, redraw]);

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
    <div className="relative min-h-screen bg-surface text-on-surface">
      <PrismGameHeader
        variant="tetris"
        connected={connected}
        tetrisOnlineUsers={tetrisHeaderUsers}
      />

      <div
        className="pointer-events-none fixed top-[-10%] right-[-5%] -z-10 h-[40%] w-[40%] rounded-full bg-primary/5 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed bottom-[-5%] left-[-5%] -z-10 h-[30%] w-[30%] rounded-full bg-secondary/5 blur-[100px]"
        aria-hidden
      />

      <main className="mx-auto max-w-7xl px-4 pb-12 pt-32 sm:px-8">
        <GamePageHeroTitle
          title="Tetris Multiplayer"
          subtitle={
            <>
              Balok & strategi — <span className="font-semibold text-primary">Multiplayer Realtime</span>
            </>
          }
        />
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <aside className="order-2 flex w-full flex-col gap-6 md:order-1 md:w-64">
          {!shouldShowSpectatorView ? (
            <>
              <div className="glass-panel rounded-3xl p-6 shadow-[0px_24px_48px_rgba(44,47,49,0.06)]">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Score
                </p>
                <h2 className="font-headline text-3xl font-black tracking-tight text-primary">
                  {formatScore(myScreen?.score ?? 0)}
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel rounded-3xl p-5">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Lines
                  </p>
                  <p className="text-xl font-bold text-on-surface">{myScreen?.lines ?? 0}</p>
                </div>
                <div className="glass-panel rounded-3xl p-5">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Level
                  </p>
                  <p className="text-xl font-bold text-secondary">
                    {String(myScreen?.level ?? 1).padStart(2, "0")}
                  </p>
                </div>
              </div>
              <div className="glass-panel rounded-3xl p-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Next Piece
                </p>
                <NextPiecePreview piece={myScreen?.next} />
              </div>
            </>
          ) : (
            <div className="glass-panel rounded-3xl p-6 shadow-[0px_24px_48px_rgba(44,47,49,0.06)]">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Mode</p>
              <p className="font-headline text-lg font-bold text-on-surface">Spectating</p>
              <p className="mt-2 text-sm text-on-surface-variant">
                {isSpectatorMode
                  ? "Kamu join saat ronde berjalan — tonton sampai ronde selesai."
                  : "Kamu sudah kalah di ronde ini — tonton hingga selesai."}
              </p>
            </div>
          )}
        </aside>

        <section className="order-1 flex w-full flex-1 flex-col items-center md:order-2">
          {!shouldShowSpectatorView ? (
            <>
              <div className="relative w-full">
                <div className="mx-auto w-fit">
                  <div className="glass-panel rounded-[2rem] border-4 border-surface-container-lowest p-4 shadow-[0px_32px_64px_rgba(70,71,211,0.08)]">
                    <div
                      className="tetris-grid relative overflow-hidden rounded-xl bg-white"
                      style={{ width: BOARD_W, height: BOARD_H }}
                    >
                      <canvas
                        ref={canvasRef}
                        width={BOARD_W}
                        height={BOARD_H}
                        className="absolute inset-0 block h-full w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 w-full max-w-[min(100%,28rem)] px-1 text-center">
                <p className="text-[11px] leading-relaxed text-on-surface-variant">
                  <span className="font-semibold text-on-surface">Kontrol keyboard:</span> A/D geser · S turun · W putar ·
                  Spasi hard drop · P jeda · ENTER ready
                </p>
                <p className="mt-1.5 text-[10px] text-on-surface-variant/85">
                  Realtime {connected ? "terhubung" : "terputus"} · ronde {tetrisState?.round ?? 0} · {onlineTetrisUsers}{" "}
                  online
                  {mobileUi ? " · kontrol sentuh di bawah saat bermain" : ""}
                </p>
              </div>

              <p className="mt-3 text-center text-sm text-on-surface-variant md:hidden">{statusText}</p>
              {tetrisState?.phase === "lobby" && (
                <p className="mt-2 text-center text-xs text-on-surface-variant">
                  Menunggu ready: {waitingReadyCount}
                </p>
              )}
              {mobileUi &&
                tetrisState?.phase === "playing" &&
                canPlayThisRound && (
                  <MobileTetrisControls
                    className="mt-4 w-full max-w-md"
                    disabled={!canPlayThisRound}
                    onAction={(action) => sendTetrisInput(action)}
                  />
                )}
            </>
          ) : (
            <div className="glass-panel w-full max-w-4xl rounded-[2rem] p-4 shadow-luxe sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-on-surface">Spectate pemain aktif</h2>
                <span className="text-xs text-on-surface-variant">{otherPlayingBoards.length} board aktif</span>
              </div>
              <p className="mb-3 text-xs text-secondary">
                {isSpectatorMode
                  ? "Kamu join saat ronde sedang berjalan, jadi spectate dulu sampai ronde selesai."
                  : "Kamu sudah kalah di ronde ini. Sekarang spectate sampai ronde selesai."}
              </p>
              {otherPlayingBoards.length === 0 ? (
                <p className="rounded-lg border border-dashed border-outline-variant/30 bg-surface-container-low px-3 py-4 text-sm text-on-surface-variant">
                  Belum ada board aktif untuk ditonton.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {otherPlayingBoards.map((player) => (
                    <SpectatorBoard key={player.id} player={player} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="order-3 flex w-full flex-col gap-6 md:w-72">
          <div className="glass-panel flex max-h-[632px] min-h-0 flex-col overflow-hidden rounded-3xl p-6 shadow-luxe">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-headline text-lg font-bold tracking-tight text-on-surface">Room Players</h3>
              <span className="h-2 w-2 animate-pulse rounded-full bg-tertiary" aria-hidden />
            </div>

            <p className="mb-3 text-[11px] text-on-surface-variant">
              Fase <span className="font-medium text-on-surface">{tetrisState?.phase ?? "lobby"}</span>
              {tetrisState?.phase === "playing" ? " · ronde berlangsung" : null}
              {(tetrisState?.phase === "lobby" || tetrisState?.phase === "finished") && (
                <> · tunggu ready: {waitingReadyCount}</>
              )}
            </p>

            {(tetrisState?.phase === "lobby" || tetrisState?.phase === "finished") &&
              myRoomState &&
              !myRoomState.spectator && (
                <button
                  type="button"
                  onClick={() => sendTetrisReady(!myRoomState.ready)}
                  className="mb-4 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white gradient-primary transition-shadow hover:shadow-[0_0_20px_rgba(70,71,211,0.25)]"
                >
                  {myRoomState.ready ? "Batal Ready" : "Ready"}
                </button>
              )}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {rankedRoomPlayers.map((p, idx) => {
                const rank = idx + 1;
                const isSelf = p.id === selfId;
                const rowClass = isSelf
                  ? "flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-3"
                  : "flex items-center gap-3 rounded-2xl p-3 transition-colors duration-200 hover:bg-surface-container-low";
                return (
                  <div key={p.id} className={rowClass}>
                    <div className="relative shrink-0">
                      <div
                        className={`grid h-10 w-10 place-items-center rounded-full border-2 bg-secondary-container text-[11px] font-bold text-secondary ${
                          isSelf ? "border-primary" : "border-transparent"
                        }`}
                      >
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      {isSelf && (
                        <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1 text-[8px] font-bold text-white">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold leading-tight text-on-surface">{p.name}</p>
                      <p
                        className={`text-[10px] font-semibold ${
                          isSelf ? "text-primary" : "text-on-surface-variant"
                        }`}
                      >
                        {formatScore(p.score)} pts
                        {p.spectator ? " · spectator" : ""}
                        {!p.spectator && p.done ? " · out" : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-black ${
                        isSelf ? "text-primary" : "text-on-surface-variant"
                      }`}
                    >
                      #{rank}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
        </div>
      </main>

      {showWinnerPopup && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-on-surface/25 px-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 shadow-luxe">
            <h3 className="font-headline text-lg font-bold text-on-surface">Winner</h3>
            <p className="mt-2 text-sm text-on-surface-variant">{winnerPopupText}</p>
            <button
              type="button"
              onClick={() => setShowWinnerPopup(false)}
              className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white gradient-primary"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showLosePopup && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-on-surface/25 px-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 shadow-luxe">
            <h3 className="font-headline text-lg font-bold text-secondary">Kamu kalah</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Ronde ini selesai untukmu. Setelah popup ditutup, kamu akan spectate sampai ronde selesai.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowLosePopup(false);
                setWatchAfterLose(true);
              }}
              className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white gradient-primary"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
