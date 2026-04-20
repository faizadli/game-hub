"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime } from "@/components/realtime/RealtimeProvider";

const W = 400;
const H = 560;
const GROUND = 72;
const PLAY_H = H - GROUND;

const BIRD_X = 80;
const BIRD_W = 36;
const BIRD_H = 28;

/** Inset kecil supaya hitbox mengikuti elips burung (bukan kotak penuh). */
const HIT_IN_BIRD = 3;
/** Tabrakan pipa mengikuti lebar gambar; inset 0 = sesuai pipa hijau. */
const HIT_IN_PIPE_X = 0;
/** 0 = tepi celah tabrakan sama dengan gambar (tanpa “mulut” toleransi ekstra). */
const GAP_MOUTH = 0;

const PIPE_W = 54;
const GAP_H = 130;
const GRAVITY = 0.45;
const FLAP_V = -8;
const SPEED = 3.1;
const PIPE_SPACING = 168;

const BEST_KEY = "games_flappy_best_v1";

type Pipe = { x: number; gapY: number; scored: boolean };

type GamePhase = "idle" | "playing" | "dead";

type Sim = {
  phase: GamePhase;
  birdY: number;
  birdVy: number;
  pipes: Pipe[];
  score: number;
};

function intersects(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function randomGapY(rng: () => number) {
  const margin = 96;
  return margin + rng() * (PLAY_H - GAP_H - margin * 2);
}

export function FlappyGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim>({
    phase: "idle",
    birdY: PLAY_H / 2 - BIRD_H / 2,
    birdVy: 0,
    pipes: [],
    score: 0,
  });
  const rngRef = useRef<() => number>(() => Math.random());
  const rafRef = useRef<number>(0);
  const lastTRef = useRef<number>(0);

  const [displayScore, setDisplayScore] = useState(0);
  const [best, setBest] = useState(() => {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem(BEST_KEY);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isNaN(n) ? 0 : n;
  });

  const { users, counts, connected } = useRealtime();

  const birdHit = useCallback((bx: number, by: number) => {
    return {
      x: bx + HIT_IN_BIRD,
      y: by + HIT_IN_BIRD,
      w: BIRD_W - 2 * HIT_IN_BIRD,
      h: BIRD_H - 2 * HIT_IN_BIRD,
    };
  }, []);

  const pipeHits = useCallback((p: Pipe) => {
    const x0 = p.x + HIT_IN_PIPE_X;
    const pw = PIPE_W - 2 * HIT_IN_PIPE_X;
    const topH = Math.max(0, p.gapY - GAP_MOUTH);
    const botY = p.gapY + GAP_H + GAP_MOUTH;
    const botH = Math.max(0, PLAY_H - botY);
    return {
      top: { x: x0, y: 0, w: pw, h: topH },
      bot: { x: x0, y: botY, w: pw, h: botH },
    };
  }, []);

  const applyBest = useCallback((score: number) => {
    setBest((prev) => {
      if (score > prev) {
        localStorage.setItem(BEST_KEY, String(score));
        return score;
      }
      return prev;
    });
  }, []);

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, s: Sim) => {
      const sky = ctx.createLinearGradient(0, 0, 0, PLAY_H);
      sky.addColorStop(0, "#4fc3f7");
      sky.addColorStop(0.55, "#81d4fa");
      sky.addColorStop(1, "#b3e5fc");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, PLAY_H);

      for (const p of s.pipes) {
        ctx.fillStyle = "#2e7d32";
        ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
        ctx.fillRect(p.x, p.gapY + GAP_H, PIPE_W, PLAY_H - (p.gapY + GAP_H));
        ctx.strokeStyle = "#1b5e20";
        ctx.lineWidth = 3;
        ctx.strokeRect(p.x + 1, 1, PIPE_W - 2, p.gapY - 2);
        ctx.strokeRect(p.x + 1, p.gapY + GAP_H + 1, PIPE_W - 2, PLAY_H - (p.gapY + GAP_H) - 2);
        ctx.fillStyle = "#66bb6a";
        ctx.fillRect(p.x + 4, p.gapY - 24, PIPE_W - 8, 22);
        ctx.fillRect(p.x + 4, p.gapY + GAP_H + 2, PIPE_W - 8, 22);
      }

      const bx = BIRD_X;
      const by = s.birdY;
      ctx.fillStyle = "#ffb300";
      ctx.beginPath();
      ctx.ellipse(bx + BIRD_W / 2, by + BIRD_H / 2, BIRD_W / 2, BIRD_H / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e65100";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(bx + BIRD_W * 0.72, by + BIRD_H * 0.38, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(bx + BIRD_W * 0.76, by + BIRD_H * 0.36, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#7cb342";
      ctx.fillRect(0, PLAY_H, W, GROUND);
      ctx.fillStyle = "#558b2f";
      ctx.fillRect(0, PLAY_H, W, 10);
      ctx.fillStyle = "#33691e";
      for (let i = 0; i < W; i += 18) {
        ctx.fillRect(i, PLAY_H + 18 + (i % 3) * 4, 10, 8);
      }

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 10, W, 44);
      ctx.fillStyle = "#fff";
      ctx.font = "700 22px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(String(s.score), 16, 38);

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "12px system-ui";
      ctx.fillText(`Flappy · ${counts.flappy} online`, W - 160, 26);

      if (s.phase === "idle") {
        ctx.fillStyle = "rgba(0,20,40,0.5)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = "700 20px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Klik / Spasi / Sentuh layar", W / 2, H / 2 - 28);
        ctx.font = "14px system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText(`Terbaik: ${best}`, W / 2, H / 2 + 8);
      } else if (s.phase === "dead") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = "700 22px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Game over", W / 2, H / 2 - 44);
        ctx.font = "16px system-ui";
        ctx.fillText(`Skor: ${s.score}`, W / 2, H / 2 - 8);
        ctx.fillText(`Terbaik: ${best}`, W / 2, H / 2 + 20);
        ctx.font = "14px system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText("Tap untuk main lagi", W / 2, H / 2 + 52);
      }
    },
    [best, counts.flappy]
  );

  const resetSim = (startPlaying: boolean) => {
    const s = simRef.current;
    s.birdY = PLAY_H / 2 - BIRD_H / 2;
    s.birdVy = startPlaying ? FLAP_V * 0.4 : 0;
    s.pipes = [];
    s.score = 0;
    s.phase = startPlaying ? "playing" : "idle";
    setDisplayScore(0);
    rngRef.current = () => Math.random();
    if (startPlaying) {
      s.pipes.push({ x: W + 40, gapY: randomGapY(rngRef.current), scored: false });
    }
  };

  const tick = useCallback(
    (dt: number) => {
      const s = simRef.current;
      if (s.phase !== "playing") return;

      s.birdVy += GRAVITY * (dt / 16);
      s.birdY += s.birdVy * (dt / 16);

      if (s.birdY + BIRD_H > PLAY_H || s.birdY < 0) {
        s.phase = "dead";
        applyBest(s.score);
        return;
      }

      const rightmost = s.pipes.length ? Math.max(...s.pipes.map((p) => p.x)) : 0;
      if (s.pipes.length === 0 || W - rightmost > PIPE_SPACING) {
        s.pipes.push({ x: W + PIPE_W + 10, gapY: randomGapY(rngRef.current), scored: false });
      }

      for (const p of s.pipes) {
        p.x -= SPEED * (dt / 16);
      }
      s.pipes = s.pipes.filter((p) => p.x > -PIPE_W - 20);

      const bh = birdHit(BIRD_X, s.birdY);
      for (const p of s.pipes) {
        if (!p.scored && p.x + PIPE_W < BIRD_X) {
          p.scored = true;
          s.score += 1;
          setDisplayScore(s.score);
        }
        const ph = pipeHits(p);
        if (
          intersects(bh.x, bh.y, bh.w, bh.h, ph.top.x, ph.top.y, ph.top.w, ph.top.h) ||
          intersects(bh.x, bh.y, bh.w, bh.h, ph.bot.x, ph.bot.y, ph.bot.w, ph.bot.h)
        ) {
          s.phase = "dead";
          applyBest(s.score);
          return;
        }
      }
    },
    [applyBest, birdHit, pipeHits]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    lastTRef.current = performance.now();

    const loop = (t: number) => {
      const dts = Math.min(48, t - lastTRef.current);
      lastTRef.current = t;
      tick(dts);
      drawFrame(ctx, simRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawFrame, tick]);

  const onFlap = useCallback(() => {
    const s = simRef.current;
    if (s.phase === "idle" || s.phase === "dead") {
      resetSim(true);
      simRef.current.birdVy = FLAP_V;
      return;
    }
    if (s.phase === "playing") {
      s.birdVy = FLAP_V;
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        onFlap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFlap]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,#1e3a5f_0%,#0f1528_55%,#0b0d12_100%)] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#7ea3d4]">Arcade</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#eef3ff] sm:text-3xl">
          Flappy Bird
        </h1>
        <p className="mt-2 text-sm text-[#9cb0d4]">
          Hindari pipa dan pecahkan rekor lokal. Pakai Spasi, klik, atau sentuh area permainan.
        </p>
        <p className="mt-2 text-xs text-[#6a7fa0]">
          Realtime {connected ? "aktif" : "offline"} · di halaman Flappy:{" "}
          {users.filter((u) => u.game === "flappy").length} user
        </p>
      </div>

      <div className="mt-6">
        <div
          className="relative mx-auto max-w-[400px] touch-manipulation select-none overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)]"
          role="application"
          aria-label="Permainan Flappy Bird"
          tabIndex={0}
          onPointerDown={(e) => {
            e.preventDefault();
            onFlap();
          }}
        >
          <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full max-w-[400px] bg-[#81d4fa]" />
        </div>
        <p className="mt-3 text-center text-xs text-[#6f7f9a]">
          Skor: <span className="font-semibold text-[#dbe7ff]">{displayScore}</span> · Terbaik:{" "}
          <span className="font-semibold text-[#dbe7ff]">{best}</span>
        </p>
      </div>
    </div>
  );
}
