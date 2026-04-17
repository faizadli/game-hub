"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRealtime } from "@/components/realtime/RealtimeProvider";
import type { SnakePlayerState } from "@/lib/realtime/types";

const CELL = 22;
const STATUS_H = 44;
const COLOR_BG = "#1a331a";
const COLOR_GRID = "#143014";
const COLOR_UI = "#c8e8c8";
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
    ctx.fillStyle = "#0f200f";
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

  const waitingReadyCount = onlineSnakePlayers.filter(
    (p) => !p.spectator && !p.ready
  ).length;

  const winnerName =
    snakeState?.winnerId &&
    snakeState.players.find((p) => p.id === snakeState.winnerId)?.name;

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
    <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-8">
      <h1 className="text-xl font-bold text-[#e8ecff]">Snake Multiplayer</h1>
      <p className="mt-2 text-center text-sm text-[#8f96ac]">
        Tanpa akun/database — ready check, spectate saat round berjalan.
      </p>

      <canvas
        ref={canvasRef}
        width={width}
        height={totalHeight}
        className="mt-4 rounded border border-[#2a3142]"
      />

      {(showEliminatedPopup || showFinishedPopup) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#314055] bg-[#111725] p-5 shadow-2xl">
            {showFinishedPopup ? (
              <>
                <h3 className="text-lg font-bold text-[#e8ecff]">
                  {finishedResult?.didIWin ? "Kamu menang!" : "Round selesai"}
                </h3>
                <p className="mt-2 text-sm text-[#9db0d0]">
                  {finishedResult?.winnerName
                    ? `Pemenang ronde: ${finishedResult.winnerName}`
                    : "Tidak ada pemenang ronde ini."}
                </p>
                <p className="mt-1 text-xs text-[#7f8aa3]">
                  Tekan tombol di bawah untuk menutup popup.
                </p>
                <button
                  type="button"
                  onClick={() => setShowFinishedPopup(false)}
                  className="mt-4 w-full rounded-lg bg-[#3d4860] px-4 py-2 font-medium text-white hover:bg-[#4d5a78]"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-[#ffdc78]">Kamu keluar ronde ini</h3>
                <p className="mt-2 text-sm text-[#9db0d0]">
                  Snake kamu sudah tereliminasi. Tunggu ronde selesai untuk main lagi.
                </p>
                <p className="mt-1 text-xs text-[#7f8aa3]">
                  Popup ini tidak akan tertutup otomatis.
                </p>
                <button
                  type="button"
                  onClick={() => setShowEliminatedPopup(false)}
                  className="mt-4 w-full rounded-lg bg-[#3d4860] px-4 py-2 font-medium text-white hover:bg-[#4d5a78]"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 w-full max-w-[620px] rounded-lg border border-[#273048] bg-[#111725] p-3 text-sm">
        <p className="text-[#9db0d0]">
          Status realtime:{" "}
          <span className={connected ? "text-[#5ecf7a]" : "text-[#f08080]"}>
            {connected ? "terhubung" : "terputus"}
          </span>
        </p>
        <p className="mt-1 text-[#9db0d0]">
          Fase: <span className="text-[#e9ecf4]">{snakeState?.phase ?? "lobby"}</span>
          {snakeState?.phase === "lobby" && (
            <>
              {" "}
              · menunggu ready:{" "}
              <span className="text-[#e9ecf4]">{waitingReadyCount}</span>
            </>
          )}
        </p>
        {me?.spectator && snakeState?.phase === "playing" && (
          <p className="mt-2 text-[#ffdc78]">
            Kamu join saat game berjalan, jadi spectate dulu sampai round selesai.
          </p>
        )}
        {snakeState?.phase === "finished" && winnerName && (
          <p className="mt-2 text-[#5ecf7a]">Round selesai. Winner: {winnerName}</p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={!me || me.spectator || snakeState?.phase === "playing"}
            onClick={() => sendSnakeReady(!(me?.ready ?? false))}
            className="rounded bg-[#3d4860] px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {me?.ready ? "Batal Ready" : "Ready"}
          </button>
        </div>
      </div>

      <div className="mt-4 w-full max-w-[620px] rounded-lg border border-[#2a3142] bg-[#161b26] p-3">
        <h2 className="text-sm font-semibold text-[#e9ecf4]">Pemain di room</h2>
        <ul className="mt-2 space-y-1 text-sm text-[#9db0d0]">
          {(snakeState?.players ?? []).map((p: SnakePlayerState) => {
            const isOnline = users.some((u) => u.id === p.id);
            return (
              <li key={p.id}>
                <span
                  className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                  style={{ backgroundColor: playerColor(p.id) }}
                />
                {p.name}
                {p.id === selfId ? " (kamu)" : ""}
                {isOnline ? "" : " (offline)"} ·{" "}
                {p.spectator
                  ? "spectator"
                  : p.alive
                    ? "alive"
                    : p.ready
                      ? "ready"
                      : "belum ready"}{" "}
                · skor {p.score}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
