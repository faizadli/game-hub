"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GamePageHeroTitle } from "@/components/game-ui/GamePageHeroTitle";
import { PrismGameHeader } from "@/components/game-ui/PrismGameHeader";
import { useRealtime } from "@/components/realtime/RealtimeProvider";

const FLAPPY_SKY_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCStTTqYLtEN4HJefiGqijEmbetGuoNooLVhhj7fOVWziU4vZIbF_Brw7WvdD_K9US3Ojr1SR0CgN0AKe6tapctDi2kOnncjt0ViUO4O-6fZaud3LPVwAuQh1JGp07cxaiBQlo0KbphL5Hhn9Xb7l99OkhdI4Glto7fUiXf9U0ZHhCt9pTcQexcrWgozD1iUtbiIqJnVg6kQtpjd83OvL_us23hnNjEIdx9x8hgWJdmfCLxs81VUm1maDV-dVuI8mFpibmYI4SDfDc";

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
  const gameShellRef = useRef<HTMLDivElement>(null);
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsError, setFsError] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: W, h: H });

  const { users, connected } = useRealtime();

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
      ctx.clearRect(0, 0, W, PLAY_H);

      for (const p of s.pipes) {
        ctx.fillStyle = "rgba(255,255,255,0.42)";
        ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
        ctx.fillRect(p.x, p.gapY + GAP_H, PIPE_W, PLAY_H - (p.gapY + GAP_H));
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x + 1, 1, PIPE_W - 2, p.gapY - 2);
        ctx.strokeRect(p.x + 1, p.gapY + GAP_H + 1, PIPE_W - 2, PLAY_H - (p.gapY + GAP_H) - 2);
        ctx.fillStyle = "rgba(0, 103, 92, 0.35)";
        ctx.fillRect(p.x + 4, p.gapY - 20, PIPE_W - 8, 18);
        ctx.fillRect(p.x + 4, p.gapY + GAP_H + 2, PIPE_W - 8, 18);
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
    [best]
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
    const readViewport = () => {
      const vv = window.visualViewport;
      const w = Math.floor(vv?.width ?? window.innerWidth);
      const h = Math.floor(vv?.height ?? window.innerHeight);
      setViewportSize({ w, h });
    };
    readViewport();
    window.addEventListener("resize", readViewport);
    window.addEventListener("orientationchange", readViewport);
    window.visualViewport?.addEventListener("resize", readViewport);
    return () => {
      window.removeEventListener("resize", readViewport);
      window.removeEventListener("orientationchange", readViewport);
      window.visualViewport?.removeEventListener("resize", readViewport);
    };
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

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === gameShellRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const target = gameShellRef.current;
    if (!target) return;
    setFsError(null);

    if (document.fullscreenElement === target) {
      await document.exitFullscreen();
      return;
    }

    if (typeof target.requestFullscreen !== "function") {
      setFsError("Browser ini belum mendukung fullscreen.");
      return;
    }

    try {
      await target.requestFullscreen();
    } catch {
      setFsError("Fullscreen diblokir browser. Coba lagi lewat tombol ini.");
    }
  }, []);

  const flappyOnline = users.filter((u) => u.game === "flappy").length;
  const boardSize = useMemo(() => {
    if (!isFullscreen) return { w: 380, h: Math.round((380 / W) * H) };
    const vw = Math.max(1, viewportSize.w);
    const vh = Math.max(1, viewportSize.h);
    const ratio = W / H;
    let fittedW = vw;
    let fittedH = fittedW / ratio;
    if (fittedH > vh) {
      fittedH = vh;
      fittedW = fittedH * ratio;
    }
    return {
      w: Math.round(fittedW),
      h: Math.round(fittedH),
    };
  }, [isFullscreen, viewportSize.h, viewportSize.w]);

  const gameShellClass = isFullscreen
    ? "group relative flex h-[100dvh] w-[100dvw] touch-manipulation select-none items-center justify-center overflow-hidden bg-black"
    : "group relative w-full max-w-[380px] touch-manipulation select-none overflow-hidden rounded-[2.5rem] shadow-luxe";
  const frameClass = isFullscreen
    ? "relative overflow-hidden rounded-none"
    : "relative h-full w-full overflow-hidden rounded-[2.5rem]";
  const frameStyle = isFullscreen
    ? {
        width: `${boardSize.w}px`,
        height: `${boardSize.h}px`,
      }
    : undefined;
  const canvasClass = "relative z-10 block h-full w-full bg-transparent";

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-on-surface">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -right-[10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute -left-[5%] bottom-[-5%] h-[400px] w-[400px] rounded-full bg-secondary/5 blur-[100px]" />
      </div>

      <PrismGameHeader variant="flappy" connected={connected} />

      <main className="relative mx-auto flex max-w-[1400px] flex-col items-center px-4 pb-16 pt-32 sm:px-8">
        <GamePageHeroTitle
          title="Flappy Bird"
          subtitle={
            <>
              Ketuk untuk terbang — <span className="font-semibold text-primary">Skor terbaik lokal</span>
            </>
          }
        />
        <div
          ref={gameShellRef}
          className={gameShellClass}
          role="application"
          aria-label="Permainan Flappy Bird"
          tabIndex={0}
          onPointerDown={(e) => {
            e.preventDefault();
            onFlap();
          }}
        >
          <div className={frameClass} style={frameStyle}>
            <div className="absolute inset-0 z-0">
              <Image
                src={FLAPPY_SKY_IMAGE}
                alt=""
                fill
                className="object-cover opacity-60 mix-blend-soft-light"
                sizes="(max-width: 768px) 100vw, 380px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-primary-container/10 via-transparent to-background/40" />
            </div>

            <div className="absolute inset-x-0 top-8 z-20 flex justify-center gap-4 px-6">
              <div className="glass-panel flex flex-1 flex-col items-center rounded-2xl px-6 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
                  Score
                </span>
                <span className="font-headline text-3xl font-black text-primary">{displayScore}</span>
              </div>
              <div className="glass-panel flex flex-1 flex-col items-center rounded-2xl px-6 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
                  Best
                </span>
                <span className="font-headline text-3xl font-black text-secondary">{best}</span>
              </div>
            </div>

            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className={canvasClass}
            />

            <div className="pointer-events-none absolute bottom-12 inset-x-0 z-20 flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-white/40">
                <span className="material-symbols-outlined text-primary">touch_app</span>
              </div>
              <p className="text-sm font-medium text-on-surface-variant/80">Tap to Jump</p>
            </div>

            <div className="absolute bottom-0 z-10 h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>

          {isFullscreen && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void toggleFullscreen();
              }}
              className="absolute right-4 top-4 z-30 inline-flex items-center gap-1 rounded-xl bg-black/45 px-3 py-2 text-xs font-bold text-white backdrop-blur-sm"
            >
              <span className="material-symbols-outlined text-base">fullscreen_exit</span>
              Keluar
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-on-surface transition-colors hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-base">
            {isFullscreen ? "fullscreen_exit" : "fullscreen"}
          </span>
          {isFullscreen ? "Keluar Fullscreen" : "Fullscreen"}
        </button>
        {fsError ? <p className="mt-2 text-center text-xs text-error">{fsError}</p> : null}

        <p className="mt-8 text-center text-xs text-on-surface-variant">
          Realtime {connected ? "aktif" : "offline"} · {flappyOnline} user di halaman Flappy
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-on-surface-variant sm:gap-12">
          <div className="flex flex-col items-center">
            <span className="font-headline text-2xl font-bold text-on-surface">{flappyOnline}</span>
            <span className="text-xs font-semibold uppercase tracking-widest opacity-60">Online</span>
          </div>
          <div className="h-8 w-px bg-outline-variant/30" />
          <div className="flex flex-col items-center">
            <span className="font-headline text-2xl font-bold text-on-surface">{best}</span>
            <span className="text-xs font-semibold uppercase tracking-widest opacity-60">Best local</span>
          </div>
        </div>
      </main>
    </div>
  );
}
