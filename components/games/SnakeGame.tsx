"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { MobileDpad } from "@/components/games/MobileDpad";
import { useMobileGameUi } from "@/lib/hooks/useMobileGameUi";
import type { SnakePlayerState } from "@/lib/realtime/types";

const CELL = 22;
const STATUS_H = 44;
const COLOR_BG = "#0d1322";
const COLOR_GRID = "#141f34";
const COLOR_UI = "#d6e2ff";
const SNAKE_COLORS = [
  "#8fff8f",
  "#5ecf7a",
  "#58d68d",
  "#7fffd4",
  "#ffdc78",
  "#c792ea",
  "#ff8fab",
  "#7aa2ff",
  "#f59e0b",
  "#4ade80",
  "#22d3ee",
  "#f472b6",
];

function hashKey(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function playerColor(playerId: string) {
  const idx = hashKey(playerId) % SNAKE_COLORS.length;
  return SNAKE_COLORS[idx];
}

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    snakeState,
    users,
    selfId,
    sendSnakeReady,
    sendSnakeDirection,
    connected,
  } = useRealtime();
  const mobileUi = useMobileGameUi();

  const rows = snakeState?.rows ?? 18;
  const cols = snakeState?.cols ?? 24;
  const width = cols * CELL;
  const height = rows * CELL;
  const totalHeight = height + STATUS_H;
  const [showEliminatedPopup, setShowEliminatedPopup] = useState(false);
  const [showFinishedPopup, setShowFinishedPopup] = useState(false);
  const [finishedResult, setFinishedResult] = useState<{
    winnerName: string | null;
    didIWin: boolean;
  } | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevEliminatedRef = useRef(false);

  const me = useMemo(
    () => snakeState?.players.find((p) => p.id === selfId) ?? null,
    [snakeState, selfId]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!snakeState || snakeState.phase !== "playing") return;
      if (!me || me.spectator || !me.alive) return;
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") sendSnakeDirection("up");
      else if (k === "s" || k === "arrowdown") sendSnakeDirection("down");
      else if (k === "a" || k === "arrowleft") sendSnakeDirection("left");
      else if (k === "d" || k === "arrowright") sendSnakeDirection("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [snakeState, me, sendSnakeDirection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snakeState) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, width, totalHeight);
    ctx.fillStyle = "#0a111e";
    ctx.fillRect(0, height, width, STATUS_H);
    ctx.fillStyle = COLOR_UI;
    ctx.font = "10px Segoe UI";
    ctx.textAlign = "left";
    ctx.fillText(
      `Room Snake Online: ${users.filter((u) => u.game === "snake").length}   Round: ${snakeState.round}   Phase: ${snakeState.phase}`,
      12,
      height + 24
    );

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = COLOR_GRID;
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        ctx.strokeStyle = COLOR_BG;
        ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
      }
    }

    if (snakeState.food) {
      const fx = snakeState.food.col * CELL;
      const fy = snakeState.food.row * CELL;
      ctx.fillStyle = "#e04040";
      ctx.beginPath();
      ctx.arc(fx + CELL / 2, fy + CELL / 2, CELL / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ff8080";
      ctx.stroke();
    }

    snakeState.players.forEach((p) => {
      const segs = snakeState.snakes[p.id] ?? [];
      const color = playerColor(p.id);
      segs.forEach((s, i) => {
        const x = s.col * CELL;
        const y = s.row * CELL;
        const pad = i === 0 ? 1 : 2;
        ctx.fillStyle = i === 0 ? color : `${color}cc`;
        ctx.fillRect(x + pad, y + pad, CELL - pad * 2, CELL - pad * 2);
        if (i === 0) {
          ctx.strokeStyle = "#ffffff66";
          ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
        }
      });

      if (segs.length > 0) {
        const head = segs[0];
        ctx.fillStyle = color;
        ctx.font = "10px Segoe UI";
        ctx.textAlign = "left";
        ctx.fillText(
          p.name.slice(0, 10),
          head.col * CELL + 2,
          Math.max(10, head.row * CELL - 4)
        );
      }
    });
  }, [snakeState, users, rows, cols, width, height, totalHeight]);

  const onlineSnakePlayers = (snakeState?.players ?? []).filter((p) =>
    users.some((u) => u.id === p.id && u.game === "snake")
  );

  /** Hanya relevan di lobby — saat playing server meng-set ready=false sehingga hitungan akan salah. */
  const waitingReadyCount =
    snakeState?.phase === "lobby"
      ? onlineSnakePlayers.filter((p) => !p.spectator && !p.ready).length
      : 0;
  const onlineCount = users.filter((u) => u.game === "snake").length;

  useEffect(() => {
    if (!snakeState) {
      prevPhaseRef.current = null;
      prevEliminatedRef.current = false;
      return;
    }

    const currentlyEliminated =
      snakeState.phase === "playing" && !!me && !me.spectator && !me.alive;
    if (currentlyEliminated && !prevEliminatedRef.current) {
      setShowEliminatedPopup(true);
    }
    prevEliminatedRef.current = currentlyEliminated;

    if (snakeState.phase === "finished" && prevPhaseRef.current !== "finished") {
      const currentWinnerName =
        snakeState.winnerId &&
        snakeState.players.find((p) => p.id === snakeState.winnerId)?.name;
      setFinishedResult({
        winnerName: currentWinnerName ?? null,
        didIWin: !!me && !!snakeState.winnerId && snakeState.winnerId === me.id,
      });
      setShowFinishedPopup(true);
    }

    prevPhaseRef.current = snakeState.phase;
  }, [snakeState, me]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,#253252_0%,#101524_58%,#0b0d12_100%)] p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-[#8fa3cb]">Multiplayer Snake</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#eef3ff] sm:text-3xl">
          Arena real-time tanpa akun
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[#9ca8c2]">
          Ready bareng, bertahan paling lama, dan lihat hasil ronde secara langsung.
        </p>
        {mobileUi && (
          <p className="mt-2 text-xs text-[#7d8ba8]">
            Di HP/tablet: gunakan kontrol sentuh di bawah arena saat ronde berjalan (panah). Atau tetap
            pakai WASD/arrow di keyboard.
          </p>
        )}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-3xl border border-white/10 bg-[#0f1525]/90 p-4 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.95)]">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[#cbd8f7]">
              Round {snakeState?.round ?? 0}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[#cbd8f7]">
              Fase {snakeState?.phase ?? "lobby"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[#cbd8f7]">
              {onlineCount} online
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={width}
            height={totalHeight}
            className="w-full max-w-full rounded-2xl border border-white/10 bg-[#0b1120]"
          />
          {mobileUi && snakeState?.phase === "playing" && (
            <MobileDpad
              className="mt-4"
              disabled={!me || me.spectator || !me.alive}
              onDirection={(dir) => sendSnakeDirection(dir)}
            />
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#11192c] p-4">
            <h2 className="text-sm font-semibold text-[#e9ecf4]">Status Match</h2>
            <p className="mt-2 text-sm text-[#9db0d0]">
              Realtime:{" "}
              <span className={connected ? "text-[#67e8a1]" : "text-[#fb7185]"}>
                {connected ? "terhubung" : "terputus"}
              </span>
            </p>
            {snakeState?.phase === "lobby" && (
              <p className="mt-1 text-sm text-[#9db0d0]">
                Menunggu ready: <span className="text-[#e9ecf4]">{waitingReadyCount}</span>
              </p>
            )}
            {snakeState?.phase === "playing" && (
              <p className="mt-1 text-sm text-[#9db0d0]">Ronde sedang berlangsung.</p>
            )}
            {snakeState?.phase === "finished" && (
              <p className="mt-1 text-sm text-[#9db0d0]">Ronde selesai.</p>
            )}
            {me?.spectator && snakeState?.phase === "playing" && (
              <p className="mt-2 text-xs text-[#ffdc78]">
                Kamu join saat ronde berjalan, jadi spectate dulu sampai ronde selesai.
              </p>
            )}
            <div className="mt-4">
              <button
                type="button"
                disabled={snakeState?.phase === "playing"}
                onClick={() => sendSnakeReady(!(me?.ready ?? false))}
                className="w-full rounded-xl bg-[#2f6df4] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3f7df8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {me?.ready ? "Batal Ready" : "Ready untuk ronde berikutnya"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#11192c] p-4">
            <h2 className="text-sm font-semibold text-[#e9ecf4]">Pemain di room</h2>
            <ul className="mt-3 space-y-2">
              {(snakeState?.players ?? []).map((p: SnakePlayerState) => {
                const isOnline = users.some((u) => u.id === p.id);
                const stateText = p.spectator
                  ? "Spectator"
                  : p.alive
                    ? "Alive"
                    : p.ready
                      ? "Ready"
                      : "Idle";
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2 text-xs text-[#aeb8d0]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#e8ecff]">
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                          style={{ backgroundColor: playerColor(p.id) }}
                        />
                        {p.name}
                        {p.id === selfId ? " (kamu)" : ""}
                        {!isOnline ? " (offline)" : ""}
                      </p>
                      <p className="mt-0.5 text-[#8593b1]">{stateText}</p>
                    </div>
                    <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-[#d4ddf6]">
                      {p.score} pts
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>

      {(showEliminatedPopup || showFinishedPopup) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#05070d]/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#101728] p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,1)]">
            {showFinishedPopup ? (
              <>
                <h3 className="text-lg font-semibold text-[#eef3ff]">
                  {finishedResult?.didIWin ? "Kamu menang!" : "Round selesai"}
                </h3>
                <p className="mt-2 text-sm text-[#a8b5d3]">
                  {finishedResult?.winnerName
                    ? `Pemenang ronde: ${finishedResult.winnerName}`
                    : "Tidak ada pemenang ronde ini."}
                </p>
                <button
                  type="button"
                  onClick={() => setShowFinishedPopup(false)}
                  className="mt-5 w-full rounded-xl bg-[#2f6df4] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3f7df8]"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-[#ffe2a6]">Kamu keluar ronde ini</h3>
                <p className="mt-2 text-sm text-[#a8b5d3]">
                  Snake kamu tereliminasi. Kamu bisa spectate dulu sambil menunggu ronde selesai.
                </p>
                <button
                  type="button"
                  onClick={() => setShowEliminatedPopup(false)}
                  className="mt-5 w-full rounded-xl bg-[#2f6df4] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3f7df8]"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
