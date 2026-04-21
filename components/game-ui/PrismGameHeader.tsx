"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SiteLogo } from "@/components/branding/SiteLogo";

export type PrismGameHeaderVariant = "snake" | "tetris" | "flappy" | "bomberman" | "maze";

type Props = {
  variant: PrismGameHeaderVariant;
  connected?: boolean;
  /** Hanya Tetris: avatar + badge online di kanan header */
  tetrisOnlineUsers?: { id: string; name: string }[];
  rightExtra?: ReactNode;
};

/**
 * Satu gaya untuk semua game: seperti Bomberman (glass back link, stars + Live).
 * Judul permainan tidak di header — pakai `GamePageHeroTitle` di dalam `<main>`.
 */
export function PrismGameHeader({
  variant,
  connected = true,
  tetrisOnlineUsers = [],
  rightExtra,
}: Props) {
  const tetrisShow = tetrisOnlineUsers.slice(0, 2);

  return (
    <header className="fixed top-0 z-50 flex w-full items-center justify-between px-3 py-4 sm:px-8 sm:py-6">
      <Link
        href="/"
        className="group inline-flex items-center gap-2 rounded-xl glass-panel px-3 py-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] sm:gap-3 sm:px-5 sm:py-2.5"
      >
        <SiteLogo size="sm" className="h-10 w-10 rounded-lg sm:h-12 sm:w-12" />
        <span className="material-symbols-outlined text-primary transition-transform group-hover:-translate-x-1">
          arrow_back
        </span>
        <span className="hidden font-headline text-sm font-bold tracking-tight sm:inline">Back to Home</span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="glass-panel flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 sm:gap-2 sm:px-4 sm:py-2">
          <span
            className="material-symbols-outlined text-base text-tertiary sm:text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            stars
          </span>
          <span className="text-xs font-bold sm:text-sm">{connected ? "Live" : "Offline"}</span>
        </div>
        {variant === "tetris" && tetrisOnlineUsers.length > 0 && (
          <>
            <div className="hidden shrink-0 -space-x-2 sm:flex">
              {tetrisShow.map((u) => (
                <div
                  key={u.id}
                  className="grid h-8 w-8 place-items-center rounded-full border-2 border-surface-container-lowest bg-secondary-container text-[10px] font-bold text-secondary"
                  title={u.name}
                >
                  {u.name.slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>
            <span className="hidden shrink-0 rounded-full bg-primary-container/20 px-3 py-1 text-xs font-bold text-primary sm:inline-flex">
              +{tetrisOnlineUsers.length} online
            </span>
          </>
        )}
        {rightExtra}
      </div>
    </header>
  );
}
