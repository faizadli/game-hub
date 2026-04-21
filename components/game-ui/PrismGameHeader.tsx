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
    <header className="fixed top-0 z-50 flex w-full items-center justify-between px-4 py-6 sm:px-8">
      <Link
        href="/"
        className="group inline-flex items-center gap-3 rounded-xl glass-panel px-5 py-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
      >
        <SiteLogo size="sm" className="rounded-lg" />
        <span className="material-symbols-outlined text-primary transition-transform group-hover:-translate-x-1">
          arrow_back
        </span>
        <span className="font-headline text-sm font-bold tracking-tight">Back to Home</span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="glass-panel flex shrink-0 items-center gap-2 rounded-xl px-4 py-2">
          <span
            className="material-symbols-outlined text-tertiary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            stars
          </span>
          <span className="text-sm font-bold">{connected ? "Live" : "Offline"}</span>
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
