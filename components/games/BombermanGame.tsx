"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import type { BomberPlayerState } from "@/lib/realtime/types";

const CELL = 40;
const HUD_H = 52;
const PLAYER_COLORS = [
  "#5b8cff",
  "#ff6b6b",
  "#51cf66",
  "#ffd43b",
];

function hashKey(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function playerColor(id: string, index: number) {
  return PLAYER_COLORS[(hashKey(id) + index) % PLAYER_COLORS.length];
}

function drawStoneWall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  t: number
) {
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, "#6a7588");
  g.addColorStop(0.45, "#3d4555");
  g.addColorStop(1, "#252a35");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x + s * 0.15, y + s * 0.15, s * 0.25, s * 0.25);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(x + s * 0.55, y + s * 0.55, s * 0.3, s * 0.25);
  const mx = x + s / 2;
  const my = y + s / 2;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.moveTo(mx - s * 0.35, my);
  ctx.lineTo(mx + s * 0.35, my + Math.sin(t * 0.002) * 2);
  ctx.stroke();
}

function drawBrick(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const pad = 2;
  ctx.fillStyle = "#8b3a1a";
  ctx.fillRect(x, y, s, s);
  const rows = 3;
  const cols = 4;
  const bh = (s - pad * 2) / rows;
  const bw = (s - pad * 2) / cols;
  for (let r = 0; r < rows; r++) {
    const ox = r % 2 === 0 ? 0 : bw * 0.5;
    for (let c = 0; c < cols + 1; c++) {
      const bx = x + pad + c * bw - ox;
      const by = y + pad + r * bh;
      if (bx + bw * 0.85 < x || bx > x + s) continue;
      const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      g.addColorStop(0, "#d4633a");
      g.addColorStop(0.5, "#a84828");
      g.addColorStop(1, "#6e2c18");
      ctx.fillStyle = g;
      ctx.fillRect(bx, by, bw * 0.92, bh * 0.88);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.strokeRect(bx, by, bw * 0.92, bh * 0.88);
    }
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, r: number, c: number) {
  const dark = (r + c) % 2 === 0 ? "#1e3d32" : "#1a352b";
  const light = (r + c) % 2 === 0 ? "#244a3c" : "#203f33";
  const g = ctx.createRadialGradient(x + s * 0.3, y + s * 0.25, 0, x + s * 0.5, y + s * 0.5, s * 0.8);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}

function drawBomb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  ticks: number,
  maxTicks: number
) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const rad = s * 0.32;
  const pulse = 1 + 0.06 * Math.sin((maxTicks - ticks) * 0.8);
  const g = ctx.createRadialGradient(cx - rad * 0.3, cy - rad * 0.3, rad * 0.1, cx, cy, rad * pulse);
  g.addColorStop(0, "#4a4a52");
  g.addColorStop(0.6, "#222228");
  g.addColorStop(1, "#0a0a0e");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, rad * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const fuseAng = -Math.PI * 0.65;
  const fx = cx + Math.cos(fuseAng) * rad * 0.85;
  const fy = cy + Math.sin(fuseAng) * rad * 0.85;
  ctx.strokeStyle = "#8b7355";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(fuseAng) * rad * 0.55, cy + Math.sin(fuseAng) * rad * 0.55);
  ctx.quadraticCurveTo(fx + 4, fy - 6, fx, fy);
  ctx.stroke();
  const spark = ticks <= 3 ? "#ff6b35" : "#ffaa33";
  ctx.fillStyle = spark;
  ctx.beginPath();
  ctx.arc(fx, fy, 2.5 + (maxTicks - ticks) * 0.15, 0, Math.PI * 2);
  ctx.fill();
}

function drawExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ttl: number, maxTtl: number) {
  const a = ttl / maxTtl;
  const cx = x + s / 2;
  const cy = y + s / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.55);
  g.addColorStop(0, `rgba(255,240,180,${0.45 * a})`);
  g.addColorStop(0.35, `rgba(255,120,40,${0.55 * a})`);
  g.addColorStop(0.7, `rgba(200,40,20,${0.35 * a})`);
  g.addColorStop(1, `rgba(80,10,10,0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = `rgba(255,200,120,${0.25 * a})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + s * 0.15, y + s * 0.15, s * 0.7, s * 0.7);
}

function drawPowerup(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, kind: "range" | "bomb") {
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.shadowColor = kind === "range" ? "#4488ff" : "#ffcc66";
  ctx.shadowBlur = 12;
  ctx.fillStyle = kind === "range" ? "#3a7dff" : "#f0b429";
  ctx.beginPath();
  ctx.roundRect(x + s * 0.2, y + s * 0.28, s * 0.6, s * 0.44, 6);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `700 ${Math.floor(s * 0.28)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(kind === "range" ? "+" : "B", cx, cy);
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
  name: string,
  isSelf: boolean
) {
  const pad = s * 0.12;
  const body = s - pad * 2;
  const bx = x + pad;
  const by = y + pad;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const g = ctx.createLinearGradient(bx, by, bx + body, by + body);
  g.addColorStop(0, color);
  g.addColorStop(1, `${color}99`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(bx, by, body, body * 0.92, body * 0.28);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(bx + body * 0.22, by + body * 0.18, body * 0.56, body * 0.12);
  ctx.fillStyle = "#1a1a22";
  ctx.beginPath();
  ctx.arc(bx + body * 0.35, by + body * 0.38, body * 0.08, 0, Math.PI * 2);
  ctx.arc(bx + body * 0.65, by + body * 0.38, body * 0.08, 0, Math.PI * 2);
  ctx.fill();
  if (isSelf) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 1, by - 1, body + 2, body * 0.92 + 2);
  }
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.font = `600 ${Math.max(8, Math.floor(s * 0.18))}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(name.slice(0, 8), x + s / 2, y - 2);
}

export function BombermanGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    bomberState,
    selfId,
    sendBomberReady,
    sendBomberDirection,
    sendBomberBomb,
    connected,
    users,
  } = useRealtime();

  const rows = bomberState?.rows ?? 11;
  const cols = bomberState?.cols ?? 13;
  const w = cols * CELL;
  const h = rows * CELL + HUD_H;
  const tRef = useRef(0);

  const [showFinished, setShowFinished] = useState(false);
  const [finishedText, setFinishedText] = useState("");
  const [showEliminated, setShowEliminated] = useState(false);
  const prevPhaseRef = useRef<string | null>(null);
  const prevEliminatedRef = useRef(false);

  const me = useMemo(
    () => bomberState?.players.find((p) => p.id === selfId) ?? null,
    [bomberState, selfId]
  );

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!bomberState) {
      ctx.fillStyle = "#0a0e14";
      ctx.fillRect(0, 0, w, h);
      return;
    }
    const t = (tRef.current += 1);

    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, w, h);
    const grid = bomberState.grid;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * CELL;
        const y = r * CELL;
        const cell = grid[r]?.[c] ?? 0;
        if (cell === 0) drawFloor(ctx, x, y, CELL, r, c);
        else if (cell === 1) drawStoneWall(ctx, x, y, CELL, t);
        else drawBrick(ctx, x, y, CELL);
      }
    }

    const maxFuse = 12;
    for (const b of bomberState.bombs) {
      drawBomb(ctx, b.col * CELL, b.row * CELL, CELL, b.ticks, maxFuse);
    }

    const maxTtl = 3;
    for (const e of bomberState.explosions) {
      drawExplosion(ctx, e.col * CELL, e.row * CELL, CELL, e.ttl, maxTtl);
    }

    for (const pu of bomberState.powerups) {
      drawPowerup(ctx, pu.col * CELL, pu.row * CELL, CELL, pu.kind);
    }

    const sortedPlayers = [...bomberState.players].sort((a, b) => {
      if (a.id === selfId) return 1;
      if (b.id === selfId) return -1;
      return 0;
    });
    sortedPlayers.forEach((p, idx) => {
      if (!p.alive || p.spectator) return;
      const color = playerColor(p.id, idx);
      drawPlayer(
        ctx,
        p.col * CELL,
        p.row * CELL,
        CELL,
        color,
        p.name,
        p.id === selfId
      );
    });

    ctx.fillStyle = "#0d121c";
    ctx.fillRect(0, rows * CELL, w, HUD_H);
    ctx.fillStyle = "#8fa3c2";
    ctx.font = "12px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `Bomberman · ${users.filter((u) => u.game === "bomberman").length} online · round ${bomberState.round} · ${bomberState.phase}`,
      12,
      rows * CELL + HUD_H / 2
    );
    ctx.textAlign = "right";
    ctx.fillText("WASD gerak · Spasi bom · Enter ready", w - 12, rows * CELL + HUD_H / 2);
  }, [bomberState, cols, h, rows, selfId, users, w]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      paint();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paint]);

  useEffect(() => {
    const onLobby = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (!bomberState || bomberState.phase !== "lobby") return;
      if (!me || me.spectator) return;
      sendBomberReady(!me.ready);
    };
    window.addEventListener("keydown", onLobby);
    return () => window.removeEventListener("keydown", onLobby);
  }, [bomberState, me, sendBomberReady]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!bomberState || bomberState.phase !== "playing") return;
      if (!me || me.spectator || !me.alive) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", " "].includes(k)) e.preventDefault();
      if (k === "w" || k === "arrowup") sendBomberDirection("up");
      else if (k === "s" || k === "arrowdown") sendBomberDirection("down");
      else if (k === "a" || k === "arrowleft") sendBomberDirection("left");
      else if (k === "d" || k === "arrowright") sendBomberDirection("right");
      else if (k === " ") {
        e.preventDefault();
        sendBomberBomb();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bomberState, me, sendBomberBomb, sendBomberDirection]);

  useEffect(() => {
    if (!bomberState) {
      prevPhaseRef.current = null;
      prevEliminatedRef.current = false;
      return;
    }
    const eliminated =
      bomberState.phase === "playing" && !!me && !me.spectator && !me.alive;
    if (eliminated && !prevEliminatedRef.current) {
      setShowEliminated(true);
    }
    prevEliminatedRef.current = eliminated;

    if (bomberState.phase === "finished" && prevPhaseRef.current !== "finished") {
      const winner =
        bomberState.winnerId &&
        bomberState.players.find((p) => p.id === bomberState.winnerId);
      const didWin = !!me && bomberState.winnerId === me.id;
      setFinishedText(
        didWin
          ? "Kamu pemenang ronde ini!"
          : winner
            ? `Pemenang: ${winner.name}`
            : "Ronde selesai (seri / tidak ada pemenang)."
      );
      setShowFinished(true);
    }
    prevPhaseRef.current = bomberState.phase;
  }, [bomberState, me]);

  const onlinePlayers = (bomberState?.players ?? []).filter((p) =>
    users.some((u) => u.id === p.id && u.game === "bomberman")
  );
  const waitingReady =
    bomberState?.phase === "lobby"
      ? onlinePlayers.filter((p) => !p.spectator && !p.ready).length
      : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,#2a1f3d_0%,#12101c_55%,#0a090e_100%)] p-6 shadow-[0_35px_90px_-55px_rgba(0,0,0,0.95)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[#b8a8d4]">Bomberman</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#f4f0ff] sm:text-3xl">
          Arena klasik — multiplayer realtime
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#a89cc0]">
          Ledakan berantai, blok brick, power-up jarak &amp; jumlah bom. Minimal dua pemain ready untuk
          mulai.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-3xl border border-white/10 bg-[#0c0a12]/95 p-4 shadow-[0_40px_100px_-60px_rgba(120,60,200,0.35)]">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[#d4ccf0]">
              Round {bomberState?.round ?? 0}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[#d4ccf0]">
              {bomberState?.phase ?? "lobby"}
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
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[#2a2438] bg-black/40 p-2">
            <canvas
              ref={canvasRef}
              width={w}
              height={h}
              className="mx-auto block max-w-full rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
            />
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#14101f] p-4">
            <h2 className="text-sm font-semibold text-[#ece8ff]">Match</h2>
            {bomberState?.phase === "lobby" && (
              <p className="mt-2 text-sm text-[#a89cc0]">
                Menunggu ready: <span className="text-[#ece8ff]">{waitingReady}</span>
              </p>
            )}
            {bomberState?.phase === "playing" && (
              <p className="mt-2 text-sm text-[#a89cc0]">Ronde sedang berlangsung.</p>
            )}
            {bomberState?.phase === "finished" && (
              <p className="mt-2 text-sm text-[#a89cc0]">Ronde selesai.</p>
            )}
            {me?.spectator && bomberState?.phase === "playing" && (
              <p className="mt-2 text-xs text-[#ffd78a]">
                Kamu spectator sampai ronde ini selesai.
              </p>
            )}
            <button
              type="button"
              disabled={bomberState?.phase === "playing"}
              onClick={() => sendBomberReady(!(me?.ready ?? false))}
              className="mt-4 w-full rounded-xl bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#8b5cf6] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {me?.ready ? "Batal ready" : "Ready"}
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#14101f] p-4">
            <h2 className="text-sm font-semibold text-[#ece8ff]">Pemain</h2>
            <ul className="mt-3 space-y-2">
              {(bomberState?.players ?? []).map((p: BomberPlayerState, idx: number) => {
                const online = users.some((u) => u.id === p.id && u.game === "bomberman");
                const label = p.spectator ? "Spectator" : p.alive ? "Hidup" : p.ready ? "Ready" : "Idle";
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.04] px-2.5 py-2 text-xs text-[#b4aac8]"
                  >
                    <span className="min-w-0 truncate font-medium text-[#ece8ff]">
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full align-middle"
                        style={{ backgroundColor: playerColor(p.id, idx) }}
                      />
                      {p.name}
                      {p.id === selfId ? " (kamu)" : ""}
                      {!online ? " · offline" : ""}
                    </span>
                    <span className="shrink-0 text-[#9d92b5]">
                      {label} · {p.score}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>

      {(showFinished || showEliminated) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#050308]/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#161222] p-6 shadow-[0_30px_80px_-40px_rgba(80,40,160,0.5)]">
            {showFinished ? (
              <>
                <h3 className="text-lg font-semibold text-[#f4f0ff]">Round selesai</h3>
                <p className="mt-2 text-sm text-[#b8aacf]">{finishedText}</p>
                <button
                  type="button"
                  onClick={() => setShowFinished(false)}
                  className="mt-5 w-full rounded-xl bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#8b5cf6]"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-[#ffb4a8]">Kamu tereliminasi</h3>
                <p className="mt-2 text-sm text-[#b8aacf]">
                  Tunggu ronde selesai untuk ikut lagi di ronde berikutnya.
                </p>
                <button
                  type="button"
                  onClick={() => setShowEliminated(false)}
                  className="mt-5 w-full rounded-xl bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#8b5cf6]"
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
