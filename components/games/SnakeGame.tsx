"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GamePageHeroTitle } from "@/components/game-ui/GamePageHeroTitle";
import { PrismGameHeader } from "@/components/game-ui/PrismGameHeader";
import {
  useRealtimeActions,
  useRealtimeHub,
  useSnakeGameState,
} from "@/components/realtime/RealtimeProvider";
import { MobileDpad } from "@/components/games/MobileDpad";
import { useMobileGameUi } from "@/lib/hooks/useMobileGameUi";
import type { SnakePlayerState } from "@/lib/realtime/types";

const CELL = 22;
const STATUS_H = 44;
const COLOR_BG = "#eef1f3";
const COLOR_GRID = "#ffffff";
const COLOR_UI = "#2c2f31";
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
  const { users, selfId, connected } = useRealtimeHub();
  const snakeState = useSnakeGameState();
  const { sendSnakeReady, sendSnakeDirection } = useRealtimeActions();
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
    ctx.fillStyle = "#dfe3e6";
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
        ctx.strokeStyle = "rgba(171,173,175,0.35)";
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
          ctx.strokeStyle = "rgba(0,0,0,0.2)";
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
    <div className="relative min-h-screen overflow-x-hidden bg-surface text-on-surface">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-secondary/5 blur-[120px]" />
      </div>

      <PrismGameHeader variant="snake" connected={connected} />

      <main className="relative mx-auto max-w-[1400px] px-4 pb-12 pt-32 sm:px-8">
        <GamePageHeroTitle
          title="Snake"
          subtitle={
            <>
              Arena klasik — <span className="font-semibold text-primary">Multiplayer Realtime</span>
            </>
          }
        />
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <section className="glass-panel relative w-full max-w-[800px] flex-1 overflow-hidden rounded-[2rem] p-4 shadow-luxe sm:p-8 lg:min-h-[min(700px,85vh)]">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-outline-variant/15 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">
              Round {snakeState?.round ?? 0}
            </span>
            <span className="rounded-full border border-outline-variant/15 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">
              Fase {snakeState?.phase ?? "lobby"}
            </span>
            <span className="rounded-full border border-outline-variant/15 bg-surface-container-low px-2.5 py-1 text-on-surface-variant">
              {onlineCount} online
            </span>
          </div>
          <div className="snake-grid relative overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low">
            <canvas
              ref={canvasRef}
              width={width}
              height={totalHeight}
              className="block h-auto w-full max-w-full bg-transparent"
            />
          </div>
          {mobileUi && snakeState?.phase === "playing" && (
            <MobileDpad
              className="mt-4"
              disabled={!me || me.spectator || !me.alive}
              onDirection={(dir) => sendSnakeDirection(dir)}
            />
          )}
        </section>

        <aside className="w-full space-y-6 lg:w-[380px]">
          <div className="glass-panel relative overflow-hidden rounded-[2rem] p-6 shadow-luxe sm:p-8">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-secondary/5 blur-2xl" />
            <h2 className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
              <span className="h-4 w-1 rounded-full bg-secondary" />
              Match Status
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Realtime:{" "}
              <span className={connected ? "font-semibold text-tertiary" : "font-semibold text-error"}>
                {connected ? "terhubung" : "terputus"}
              </span>
            </p>
            {snakeState?.phase === "lobby" && (
              <p className="mt-1 text-sm text-on-surface-variant">
                Menunggu ready: <span className="font-semibold text-on-surface">{waitingReadyCount}</span>
              </p>
            )}
            {snakeState?.phase === "playing" && (
              <p className="mt-1 text-sm text-on-surface-variant">Ronde sedang berlangsung.</p>
            )}
            {snakeState?.phase === "finished" && (
              <p className="mt-1 text-sm text-on-surface-variant">Ronde selesai.</p>
            )}
            {me?.spectator && snakeState?.phase === "playing" && (
              <p className="mt-2 text-xs text-secondary">
                Kamu join saat ronde berjalan, jadi spectate dulu sampai ronde selesai.
              </p>
            )}
            {mobileUi && (
              <p className="mt-3 text-xs text-on-surface-variant">
                Di HP: kontrol sentuh di bawah arena. Keyboard WASD / panah tetap didukung.
              </p>
            )}
            <div className="mt-4">
              <button
                type="button"
                disabled={snakeState?.phase === "playing"}
                onClick={() => sendSnakeReady(!(me?.ready ?? false))}
                className="w-full rounded-2xl px-4 py-3 text-sm font-bold text-white gradient-primary transition-shadow hover:shadow-[0_0_20px_rgba(70,71,211,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {me?.ready ? "Batal Ready" : "Ready untuk ronde berikutnya"}
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-6 shadow-luxe">
            <h2 className="text-sm font-bold text-on-surface">Pemain di room</h2>
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
                    className="flex items-center justify-between gap-2 rounded-2xl border border-outline-variant/10 bg-surface-container-low px-2.5 py-2 text-xs text-on-surface-variant"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-on-surface">
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                          style={{ backgroundColor: playerColor(p.id) }}
                        />
                        {p.name}
                        {p.id === selfId ? " (kamu)" : ""}
                        {!isOnline ? " (offline)" : ""}
                      </p>
                      <p className="mt-0.5 text-on-surface-variant/80">{stateText}</p>
                    </div>
                    <span className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest px-2 py-1 text-[11px] text-on-surface">
                      {p.score} pts
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
        </div>
      </main>

      {(showEliminatedPopup || showFinishedPopup) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-on-surface/25 px-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-luxe">
            {showFinishedPopup ? (
              <>
                <h3 className="font-headline text-lg font-bold text-on-surface">
                  {finishedResult?.didIWin ? "Kamu menang!" : "Round selesai"}
                </h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {finishedResult?.winnerName
                    ? `Pemenang ronde: ${finishedResult.winnerName}`
                    : "Tidak ada pemenang ronde ini."}
                </p>
                <button
                  type="button"
                  onClick={() => setShowFinishedPopup(false)}
                  className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white gradient-primary"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <h3 className="font-headline text-lg font-bold text-secondary">Kamu keluar ronde ini</h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Snake kamu tereliminasi. Kamu bisa spectate dulu sambil menunggu ronde selesai.
                </p>
                <button
                  type="button"
                  onClick={() => setShowEliminatedPopup(false)}
                  className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white gradient-primary"
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
