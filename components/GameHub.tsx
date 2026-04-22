"use client";

import Link from "next/link";
import { SiteLogo } from "@/components/branding/SiteLogo";
import { GAMES } from "@/lib/games";
import { GameCard, type HubVariant } from "./GameCard";
import { useRealtimeHub } from "./realtime/RealtimeProvider";

const VARIANT_BY_SLUG: Record<string, HubVariant> = {
  snake: "featured",
  tetris: "side",
  bomberman: "media",
  /** Gaya Tetris (secondary), tinggi sama Bomberman/Maze */
  flappy: "sideTall",
  maze: "maze",
};

export function GameHub() {
  const { counts, username, connected } = useRealtimeHub();

  const gameCountBySlug: Record<string, number> = {
    snake: counts.snake,
    tetris: counts.tetris,
    bomberman: counts.bomberman,
    flappy: counts.flappy,
    maze: counts.maze,
  };

  return (
    <main className="relative mx-auto min-h-screen max-w-7xl overflow-hidden px-5 py-8 md:px-16 md:py-12">
      <div className="pointer-events-none absolute right-0 top-0 h-[600px] w-[600px] light-leak" aria-hidden />
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] opacity-50 light-leak"
        aria-hidden
      />

      <header className="relative z-10 mb-12 md:mb-16">
        <div className="flex max-w-2xl flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
          <Link
            href="/"
            className="inline-flex shrink-0 self-start transition-opacity hover:opacity-90"
            aria-label="Beranda Game Hub"
          >
            <SiteLogo size="lg" priority />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-headline text-4xl font-extrabold tracking-[-0.02em] text-on-surface sm:text-5xl md:text-6xl">
              Game <span className="text-primary italic">Hub</span>
            </h1>
            <p className="mt-2 max-w-md font-medium text-on-surface-variant">
              Jelajahi dunia petualangan dalam satu genggaman. Pilih permainanmu dan mulailah berkompetisi dengan
              pemain lain secara realtime.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface">
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-tertiary-container" : "bg-error"}`} />
                {counts.total} user online
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface">
                <span className="material-symbols-outlined text-base text-primary">account_circle</span>
                {username || "Guest"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="relative z-10 grid grid-cols-1 gap-8 md:grid-cols-12">
        {GAMES.map((g) => (
          <GameCard
            key={g.slug}
            href={`/games/${g.slug}`}
            hubTitle={g.hubTitle}
            hubDescription={g.hubDescription}
            playingCount={gameCountBySlug[g.slug] ?? 0}
            variant={VARIANT_BY_SLUG[g.slug] ?? "media"}
            coverImage={g.coverImage}
          />
        ))}
      </section>

      <footer className="mx-auto mt-16 flex max-w-7xl flex-col items-center justify-between gap-6 border-t border-outline-variant/10 py-12 md:flex-row">
        <p className="text-xs font-medium uppercase tracking-widest text-on-surface-variant">
          © {new Date().getFullYear()} Luminous Gallery Game Hub. Crafted for play.
        </p>
        <div className="flex flex-wrap justify-center gap-6 md:gap-8">
          <span className="cursor-default text-xs font-medium uppercase tracking-widest text-on-surface-variant opacity-70">
            Kebijakan Privasi
          </span>
          <span className="cursor-default text-xs font-medium uppercase tracking-widest text-on-surface-variant opacity-70">
            Ketentuan Layanan
          </span>
          <span className="cursor-default text-xs font-medium uppercase tracking-widest text-on-surface-variant opacity-70">
            Bantuan
          </span>
        </div>
      </footer>
    </main>
  );
}
