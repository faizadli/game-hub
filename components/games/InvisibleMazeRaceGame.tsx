"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MobileDpad } from "@/components/games/MobileDpad";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import { useMobileGameUi } from "@/lib/hooks/useMobileGameUi";
import type { MazePlayerState } from "@/lib/realtime/types";

const CELL = 26;
const HUD_HEIGHT = 48;

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

  const me = useMemo(
    () => mazeState?.players.find((player) => player.id === selfId) ?? null,
    [mazeState, selfId]
  );

  const rows = mazeState?.rows ?? 17;
  const cols = mazeState?.cols ?? 25;
  const width = cols * CELL;
  const height = rows * CELL + HUD_HEIGHT;
  const now = Date.now();
  const memorizeSecs =
    mazeState?.phase === "memorize" && mazeState.revealUntilMs
      ? Math.max(0, Math.ceil((mazeState.revealUntilMs - now) / 1000))
      : 0;

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

    const showWalls = mazeState.gridVisible || mazeState.phase !== "racing";
    for (let r = 0; r < mazeState.rows; r++) {
      for (let c = 0; c < mazeState.cols; c++) {
        const x = c * CELL;
        const y = r * CELL;
        const wall = mazeState.grid[r]?.[c] === 1;

        if (wall && showWalls) {
          ctx.fillStyle = "#374151";
          ctx.fillRect(x, y, CELL, CELL);
        } else {
          ctx.fillStyle = (r + c) % 2 === 0 ? "#0f172a" : "#10192f";
          ctx.fillRect(x, y, CELL, CELL);
        }

        if (!showWalls) {
          ctx.strokeStyle = "rgba(255,255,255,0.05)";
          ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
        }
      }
    }

    const start = mazeState.start;
    const goal = mazeState.goal;

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(start.col * CELL + 4, start.row * CELL + 4, CELL - 8, CELL - 8);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(goal.col * CELL + 4, goal.row * CELL + 4, CELL - 8, CELL - 8);

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

  const onPagePlayers = (mazeState?.players ?? []).filter((p) =>
    users.some((u) => u.id === p.id && u.game === "maze")
  );
  const waitingReady =
    mazeState?.phase === "lobby" ? onPagePlayers.filter((p) => !p.spectator && !p.ready).length : 0;
  const winner =
    mazeState?.winnerId && mazeState.players.find((player) => player.id === mazeState.winnerId);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,#3b2a11_0%,#171208_55%,#0a0907_100%)] p-6 shadow-[0_35px_90px_-55px_rgba(0,0,0,0.95)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[#d8b889]">Invisible Maze Race</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#f7eddc] sm:text-3xl">
          Hafalkan peta, lalu balapan dalam gelap
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#c4aa86]">
          Saat fase memorize, dinding terlihat beberapa detik. Setelah itu, dinding menghilang dan kamu
          harus sampai ke kotak merah lebih dulu.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-3xl border border-white/10 bg-[#0b0f16]/95 p-4">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[#d9c9b2]">
              Round {mazeState?.round ?? 0}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[#d9c9b2]">
              {mazeState?.phase ?? "lobby"}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 ${
                connected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-200"
              }`}
            >
              {connected ? "Terhubung" : "Terputus"}
            </span>
            {mazeState?.phase === "memorize" && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
                Sisa hafalan: {memorizeSecs}s
              </span>
            )}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[#2a2438] bg-black/40 p-2">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="mx-auto block max-w-full rounded-xl"
            />
          </div>
          {mobileUi && mazeState?.phase === "racing" && (
            <MobileDpad
              className="mt-4"
              disabled={!me || me.spectator || me.finished}
              onDirection={(dir) => sendMazeMove(dir)}
            />
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#14110d] p-4">
            <h2 className="text-sm font-semibold text-[#f7eddc]">Match</h2>
            {mazeState?.phase === "lobby" && (
              <p className="mt-2 text-sm text-[#d0ba98]">
                Menunggu ready: <span className="text-[#fff2dc]">{waitingReady}</span>
              </p>
            )}
            {mazeState?.phase === "memorize" && (
              <p className="mt-2 text-sm text-[#d0ba98]">Hafalkan jalur secepat mungkin.</p>
            )}
            {mazeState?.phase === "racing" && (
              <p className="mt-2 text-sm text-[#d0ba98]">Dinding disembunyikan. Cari finish.</p>
            )}
            {mazeState?.phase === "finished" && (
              <p className="mt-2 text-sm text-[#d0ba98]">
                {winner ? `Pemenang: ${winner.name}` : "Ronde berakhir tanpa pemenang."}
              </p>
            )}
            {me?.spectator && mazeState?.phase !== "lobby" && (
              <p className="mt-2 text-xs text-[#f7d9a8]">Kamu spectator untuk ronde ini.</p>
            )}
            <button
              type="button"
              disabled={!mazeState || mazeState.phase === "memorize" || mazeState.phase === "racing"}
              onClick={() => sendMazeReady(!(me?.ready ?? false))}
              className="mt-4 w-full rounded-xl bg-[#d97706] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#ea8a16] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {me?.ready ? "Batal ready" : "Ready"}
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#14110d] p-4">
            <h2 className="text-sm font-semibold text-[#f7eddc]">Pemain</h2>
            <ul className="mt-3 space-y-2">
              {(mazeState?.players ?? []).map((player, idx) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.04] px-2.5 py-2 text-xs text-[#d8c3a4]"
                >
                  <span className="min-w-0 truncate font-medium text-[#fff2dc]">
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full align-middle"
                      style={{ backgroundColor: playerColor(player.id, idx) }}
                    />
                    {player.name}
                    {player.id === selfId ? " (kamu)" : ""}
                  </span>
                  <span className="shrink-0 text-[#b8a080]">
                    {player.spectator ? "Spectator" : player.finished ? "Finish" : player.ready ? "Ready" : "Idle"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
