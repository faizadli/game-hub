"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MobileTetrisControls } from "@/components/games/MobileTetrisControls";
import { useKeyboardState } from "@/lib/game/useKeyboardState";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { useMobileGameUi } from "@/lib/hooks/useMobileGameUi";
import type { TetrisBoard, TetrisPlayerScreen } from "@/lib/realtime/types";

const COLS = 10;
const ROWS = 22;
const CELL = 28;
const PANEL_W = 160;
const CW = COLS * CELL + PANEL_W;
const CH = (ROWS - 2) * CELL;
const SIDEBAR_X = COLS * CELL + 12;
const COLORS: Record<string, string> = {
  I: "#00f0f0",
  O: "#f0f000",
  T: "#a000f0",
  S: "#00f000",
  Z: "#f00000",
  J: "#0000f0",
  L: "#f0a000",
};

function emptyBoard(): TetrisBoard {
  return Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));
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
  const { selfId, tetrisState, sendTetrisReady, sendTetrisInput, connected, users } = useRealtime();
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
  const roomRoster = useMemo(() => {
    return [...(tetrisState?.roster ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [tetrisState]);

  const onlineTetrisUsers = useMemo(
    () => users.filter((u) => u.game === "tetris").length,
    [users]
  );

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

  const paint = useCallback((ctx: CanvasRenderingContext2D, board: TetrisBoard, screen: TetrisPlayerScreen | null) => {
    ctx.fillStyle = "#1a1d28";
    ctx.fillRect(0, 0, CW, CH);

    for (let r = 2; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        const y = (r - 2) * CELL;
        const x = c * CELL;
        const color = cell ? COLORS[cell] ?? "#666" : "#252830";
        drawCell(ctx, x, y, color);
      }
    }
    ctx.fillStyle = "#c8d0e0";
    ctx.font = "14px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Skor", SIDEBAR_X, 16);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 20px Segoe UI";
    ctx.fillText(String(screen?.score ?? 0), SIDEBAR_X, 38);
    ctx.fillStyle = "#c8d0e0";
    ctx.font = "14px Segoe UI";
    ctx.fillText("Baris", SIDEBAR_X, 86);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 20px Segoe UI";
    ctx.fillText(String(screen?.lines ?? 0), SIDEBAR_X, 108);
    ctx.fillStyle = "#c8d0e0";
    ctx.font = "14px Segoe UI";
    ctx.fillText("Level", SIDEBAR_X, 156);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 20px Segoe UI";
    ctx.fillText(String(screen?.level ?? 1), SIDEBAR_X, 178);

    ctx.fillStyle = "#c8d0e0";
    ctx.font = "14px Segoe UI";
    ctx.fillText("Berikut", SIDEBAR_X, 234);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 28px Segoe UI";
    ctx.fillText(screen?.next ?? "-", SIDEBAR_X + 20, 274);

    const help = [
      "A / D : geser",
      "W : putar kanan",
      "S : turun",
      "Q : putar kiri",
      "Spasi : hard drop",
      "P : kirim pause",
      "ENTER : ready",
    ];
    ctx.fillStyle = "#8890a8";
    ctx.font = "12px Segoe UI";
    let hy = CH - 120;
    for (const line of help) {
      ctx.fillText(line, SIDEBAR_X, hy);
      hy += 16;
    }

    if (screen?.phase === "paused" || screen?.phase === "game_over") {
      ctx.fillStyle = "#181c28";
      ctx.fillRect(8, 8, COLS * CELL - 16, CH - 16);
      ctx.strokeStyle = "#405070";
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 8, COLS * CELL - 16, CH - 16);
      ctx.fillStyle = screen.phase === "paused" ? "#f0e080" : "#f08080";
      ctx.font = "700 18px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(
        screen.phase === "paused" ? "Jeda" : "Game Over",
        (COLS * CELL) / 2,
        CH / 2
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

  useKeyboardState({
    active: true,
    onKeyDown: (key, event) => {
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
      else if (key === "q") sendTetrisInput("rotate_ccw");
      else if (key === "p") sendTetrisInput("toggle_pause");
      else if (key === " ") {
        event.preventDefault();
        sendTetrisInput("hard_drop");
      }
    },
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
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,#2a2746_0%,#121423_56%,#0b0d12_100%)] p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#eef3ff]">Tetris Multiplayer</h1>
        <p className="mt-2 text-sm text-[#9aa7c4]">
          Setiap pemain punya board sendiri — bisa solo (satu orang ready) atau versus. User yang masuk saat
          ronde berjalan jadi spectator sampai ronde selesai. Kontrol:{" "}
          <span className="text-[#e8ecff]">WASD + Q + Spasi</span>
          {mobileUi ? (
            <>
              {" "}
              — di layar sentuh gunakan <span className="text-[#e8ecff]">tombol di bawah board</span>.
            </>
          ) : (
            "."
          )}
        </p>
        <p className="mt-3 text-xs text-[#8a95b2]">
          Realtime {connected ? "terhubung" : "terputus"} · user di room tetris: {onlineTetrisUsers} ·
          round {tetrisState?.round ?? 0} · fase {tetrisState?.phase ?? "lobby"}
        </p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {!shouldShowSpectatorView ? (
          <section className="rounded-2xl border border-white/10 bg-[#111726] p-4">
            <div className="-mx-1 overflow-x-auto pb-1">
              <canvas
                ref={canvasRef}
                width={CW}
                height={CH}
                className="rounded-lg border border-[#2a3142]"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-[#8f96ac]">
                {statusText} · Skor {myScreen?.score ?? 0} · Baris {myScreen?.lines ?? 0} · Level{" "}
                {myScreen?.level ?? 1}
              </p>
              {tetrisState?.phase === "lobby" && (
                <p className="text-xs text-[#9aa7c4]">Menunggu ready: {waitingReadyCount}</p>
              )}
            </div>
            {mobileUi &&
              tetrisState?.phase === "playing" &&
              canPlayThisRound && (
                <MobileTetrisControls
                  className="mt-4"
                  disabled={!canPlayThisRound}
                  onAction={(action) => sendTetrisInput(action)}
                />
              )}
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
            Fase: <span className="text-[#e8ecff]">{tetrisState?.phase ?? "lobby"}</span>
            {(tetrisState?.phase === "lobby" || tetrisState?.phase === "finished") && (
              <>
                {" "}
                · Menunggu ready: <span className="text-[#e8ecff]">{waitingReadyCount}</span>
              </>
            )}
            {tetrisState?.phase === "playing" && (
              <>
                {" "}
                · <span className="text-[#e8ecff]">Ronde berlangsung</span>
              </>
            )}
          </p>

          {(tetrisState?.phase === "lobby" || tetrisState?.phase === "finished") &&
            myRoomState &&
            !myRoomState.spectator && (
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
