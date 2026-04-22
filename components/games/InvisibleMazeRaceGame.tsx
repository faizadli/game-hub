"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GamePageHeroTitle } from "@/components/game-ui/GamePageHeroTitle";
import { PrismGameHeader } from "@/components/game-ui/PrismGameHeader";
import { MobileDpad } from "@/components/games/MobileDpad";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { useMobileGameUi } from "@/lib/hooks/useMobileGameUi";
import type { MazePlayerState } from "@/lib/realtime/types";

const CELL = 26;
const HUD_HEIGHT = 48;
const MEMORIZE_MS = 5500;

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function playerColor(id: string, idx: number) {
  const colors = ["#60a5fa", "#f87171", "#34d399", "#fbbf24", "#a78bfa", "#fb7185"];
  return colors[(hash(id) + idx) % colors.length];
}

export function InvisibleMazeRaceGame() {
  const { mazeState, selfId, users, connected, sendMazeMove, sendMazeReady } = useRealtime();
  const mobileUi = useMobileGameUi();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tick, setTick] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [memorizeSecs, setMemorizeSecs] = useState(0);
  const prevPhaseRef = useRef<string | null>(null);
  const memorizeStartRef = useRef<number | null>(null);

  const me = useMemo(
    () => mazeState?.players.find((player) => player.id === selfId) ?? null,
    [mazeState, selfId]
  );

  const rows = mazeState?.rows ?? 17;
  const cols = mazeState?.cols ?? 25;
  const width = cols * CELL;
  const height = rows * CELL + HUD_HEIGHT;

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => (value + 1) % 10_000), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mazeState) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0f1a";
    ctx.fillRect(0, 0, width, height);

    const isPreStart = mazeState.phase === "lobby";
    const showWalls = mazeState.gridVisible;
    if (isPreStart) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, mazeState.cols * CELL, mazeState.rows * CELL);
    } else {
      for (let r = 0; r < mazeState.rows; r++) {
        for (let c = 0; c < mazeState.cols; c++) {
          const x = c * CELL;
          const y = r * CELL;
          const wall = mazeState.grid[r]?.[c] === 1;

          if (!showWalls) {
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(x, y, CELL, CELL);
            continue;
          }
          if (wall) {
            ctx.fillStyle = "#374151";
            ctx.fillRect(x, y, CELL, CELL);
          } else {
            ctx.fillStyle = (r + c) % 2 === 0 ? "#0f172a" : "#10192f";
            ctx.fillRect(x, y, CELL, CELL);
          }
        }
      }

      const start = mazeState.start;
      const goal = mazeState.goal;

      ctx.fillStyle = "#22c55e";
      ctx.fillRect(start.col * CELL + 4, start.row * CELL + 4, CELL - 8, CELL - 8);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(goal.col * CELL + 4, goal.row * CELL + 4, CELL - 8, CELL - 8);
    }

    mazeState.players.forEach((player: MazePlayerState, idx: number) => {
      if (player.spectator) return;
      const x = player.col * CELL + CELL / 2;
      const y = player.row * CELL + CELL / 2;
      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = playerColor(player.id, idx);
      ctx.fill();
      if (player.id === selfId) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    });

    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, mazeState.rows * CELL, width, HUD_HEIGHT);
    ctx.fillStyle = "#8aa3c7";
    ctx.font = "12px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `Invisible Maze Race · round ${mazeState.round} · ${mazeState.phase} · t:${tick}`,
      12,
      mazeState.rows * CELL + HUD_HEIGHT / 2
    );
    ctx.textAlign = "right";
    ctx.fillText("WASD / panah / sentuh", width - 12, mazeState.rows * CELL + HUD_HEIGHT / 2);
  }, [height, mazeState, selfId, tick, width]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!mazeState || mazeState.phase !== "racing") return;
      if (!me || me.spectator || me.finished) return;
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        e.preventDefault();
      }
      if (key === "w" || key === "arrowup") sendMazeMove("up");
      else if (key === "s" || key === "arrowdown") sendMazeMove("down");
      else if (key === "a" || key === "arrowleft") sendMazeMove("left");
      else if (key === "d" || key === "arrowright") sendMazeMove("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mazeState, me, sendMazeMove]);

  useEffect(() => {
    if (!mazeState) {
      memorizeStartRef.current = null;
      return;
    }
    if (mazeState.phase === "memorize") {
      if (prevPhaseRef.current !== "memorize") {
        memorizeStartRef.current = Date.now();
      }
    } else {
      memorizeStartRef.current = null;
    }
  }, [mazeState]);

  useEffect(() => {
    if (mazeState?.phase !== "memorize") return;
    const update = () => {
      const start = memorizeStartRef.current;
      if (start === null) {
        setMemorizeSecs(0);
        return;
      }
      setMemorizeSecs(Math.max(0, Math.ceil((start + MEMORIZE_MS - Date.now()) / 1000)));
    };
    const timeoutId = window.setTimeout(update, 0);
    const intervalId = window.setInterval(update, 250);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [mazeState?.phase]);

  useEffect(() => {
    if (!mazeState) {
      prevPhaseRef.current = null;
      return;
    }
    if (mazeState.phase === "finished" && prevPhaseRef.current !== "finished") {
      const winnerPlayer =
        mazeState.winnerId && mazeState.players.find((player) => player.id === mazeState.winnerId);
      const isWinner = !!selfId && mazeState.winnerId === selfId;
      setResultTitle(isWinner ? "Kamu Menang!" : "Kamu Kalah");
      setResultMessage(
        isWinner
          ? "Mantap! Kamu paling cepat mencapai finish di ronde ini."
          : winnerPlayer
            ? `${winnerPlayer.name} mencapai finish lebih dulu. Coba lagi di ronde berikutnya.`
            : "Ronde selesai tanpa pemenang."
      );
      setShowResult(true);
    }
    prevPhaseRef.current = mazeState.phase;
  }, [mazeState, selfId]);

  const onPagePlayers = (mazeState?.players ?? []).filter((p) =>
    users.some((u) => u.id === p.id && u.game === "maze")
  );
  const waitingReady =
    mazeState?.phase === "lobby" ? onPagePlayers.filter((p) => !p.spectator && !p.ready).length : 0;
  const winner =
    mazeState?.winnerId && mazeState.players.find((player) => player.id === mazeState.winnerId);

  const resultModalOpen = showResult && mazeState?.phase === "finished";
  const memorizeSecsShown = mazeState?.phase === "memorize" ? memorizeSecs : 0;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <PrismGameHeader variant="maze" connected={connected} />

      <main className="px-4 pb-12 pt-32 lg:px-8">
        <GamePageHeroTitle
          title="Invisible Maze Race"
          subtitle={
            <>
              Race mode — <span className="font-semibold text-primary">Multiplayer Realtime</span>
            </>
          }
        />
        <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="flex w-full flex-col gap-6 lg:w-80">
          <div className="glass-panel flex flex-col gap-6 rounded-[2rem] border border-white/40 p-6 shadow-luxe">
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">Match Details</h2>
              <p className="text-sm text-on-surface-variant">Race mode · realtime</p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-2 rounded-2xl bg-surface-container-low p-4">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-on-surface-variant">Status</span>
                  <span className="text-secondary">{mazeState?.phase ?? "lobby"}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                  <div className="h-full w-3/4 rounded-full bg-secondary" />
                </div>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant">
              Saat memorize, dinding terlihat sebentar. Lalu balapan dalam gelap menuju finish merah.
            </p>
          </div>
          <div className="rounded-[2rem] bg-surface-container-low p-6">
            <h3 className="font-headline text-sm font-bold uppercase tracking-wider text-on-surface-variant">
              How to Play
            </h3>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-on-surface-variant">
              <p className="flex gap-2">
                <span className="material-symbols-outlined text-primary text-lg">visibility_off</span>
                Labirin bisa tak terlihat — ingat jalur saat fase memorize.
              </p>
              <p className="flex gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">speed</span>
                Sampai finish lebih dulu dari lawan.
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-6 shadow-luxe">
            <h2 className="text-sm font-semibold text-on-surface">Match</h2>
            {mazeState?.phase === "lobby" && (
              <p className="mt-2 text-sm text-on-surface-variant">
                Menunggu ready: <span className="font-medium text-on-surface">{waitingReady}</span>
              </p>
            )}
            {mazeState?.phase === "memorize" && (
              <p className="mt-2 text-sm text-on-surface-variant">Hafalkan jalur secepat mungkin.</p>
            )}
            {mazeState?.phase === "racing" && (
              <p className="mt-2 text-sm text-on-surface-variant">Dinding disembunyikan. Cari finish.</p>
            )}
            {mazeState?.phase === "finished" && (
              <p className="mt-2 text-sm text-on-surface-variant">
                {winner ? `Pemenang: ${winner.name}` : "Ronde berakhir tanpa pemenang."}
              </p>
            )}
            {me?.spectator && mazeState?.phase !== "lobby" && (
              <p className="mt-2 text-xs text-secondary">Kamu spectator untuk ronde ini.</p>
            )}
            <button
              type="button"
              disabled={!mazeState || mazeState.phase === "memorize" || mazeState.phase === "racing"}
              onClick={() => sendMazeReady(!(me?.ready ?? false))}
              className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white gradient-primary transition-shadow hover:shadow-[0_0_20px_rgba(70,71,211,0.25)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {me?.ready ? "Batal ready" : "Ready"}
            </button>
          </div>

          <div className="glass-panel rounded-[2rem] p-6 shadow-luxe">
            <h2 className="text-sm font-semibold text-on-surface">Pemain</h2>
            <ul className="mt-3 space-y-2">
              {(mazeState?.players ?? []).map((player, idx) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-outline-variant/10 bg-surface-container-low px-2.5 py-2 text-xs text-on-surface-variant"
                >
                  <span className="min-w-0 truncate font-medium text-on-surface">
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full align-middle"
                      style={{ backgroundColor: playerColor(player.id, idx) }}
                    />
                    {player.name}
                    {player.id === selfId ? " (kamu)" : ""}
                  </span>
                  <span className="shrink-0">
                    {player.spectator ? "Spectator" : player.finished ? "Finish" : player.ready ? "Ready" : "Idle"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="relative min-h-[min(70vh,560px)] flex-1">
        <div className="glass-panel relative h-full min-h-[min(70vh,560px)] overflow-hidden rounded-[3rem] border border-white/20 shadow-luxe">
          <div className="absolute inset-0 bg-[#0b0f10] maze-grid-bg opacity-95" />
          <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/20 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-secondary/10 blur-[100px]" />

          <div className="relative z-10 p-4">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-white/90">
              Round {mazeState?.round ?? 0}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-white/90">
              {mazeState?.phase ?? "lobby"}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 ${
                connected
                  ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
                  : "border-rose-400/40 bg-rose-500/20 text-rose-100"
              }`}
            >
              {connected ? "Terhubung" : "Terputus"}
            </span>
          </div>
          <div className="relative overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-2">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="mx-auto block max-w-full rounded-xl"
            />
            {mazeState?.phase === "lobby" && (
              <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl bg-[#05080fcc]/90 px-4 text-center">
                <div className="max-w-md">
                  <p className="text-base font-semibold text-[#fef3c7]">
                    Bersiap! Tekan Ready untuk memulai ronde
                  </p>
                  <p className="mt-2 text-sm text-[#e5d2a9]">
                    Saat permainan dimulai, kamu hanya punya beberapa detik untuk mengingat map sebelum
                    semuanya kembali gelap.
                  </p>
                </div>
              </div>
            )}
            {mazeState?.phase === "memorize" && (
              <div className="pointer-events-none absolute inset-2 flex items-center justify-center">
                {memorizeSecsShown <= 3 && memorizeSecsShown > 0 ? (
                  <p className="select-none text-8xl font-black leading-none text-amber-200 [text-shadow:0_0_20px_rgba(0,0,0,0.9)]">
                    {memorizeSecsShown}
                  </p>
                ) : null}
              </div>
            )}
          </div>
          {mobileUi && mazeState?.phase === "racing" && (
            <MobileDpad
              className="mt-4"
              disabled={!me || me.spectator || me.finished}
              onDirection={(dir) => sendMazeMove(dir)}
            />
          )}
          </div>
        </div>
        </section>
        </div>
      </main>

      {resultModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-on-surface/25 px-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 shadow-luxe">
            <h3
              className={`font-headline text-lg font-bold ${
                resultTitle.includes("Menang") ? "text-tertiary" : "text-secondary"
              }`}
            >
              {resultTitle}
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant">{resultMessage}</p>
            <button
              type="button"
              onClick={() => setShowResult(false)}
              className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white gradient-primary"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
