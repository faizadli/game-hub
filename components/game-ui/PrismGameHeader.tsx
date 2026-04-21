"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type PrismGameHeaderVariant = "snake" | "tetris" | "flappy" | "bomberman" | "maze";

type Props = {
  variant: PrismGameHeaderVariant;
  title: string;
  centerSubtitle?: string;
  connected?: boolean;
  tetrisOnlineUsers?: { id: string; name: string }[];
  rightExtra?: ReactNode;
};

export function PrismGameHeader({
  variant,
  title,
  centerSubtitle,
  connected = true,
  tetrisOnlineUsers = [],
  rightExtra,
}: Props) {
  if (variant === "snake") {
    return (
      <header className="fixed top-0 z-50 flex w-full items-center justify-between px-4 py-5 sm:px-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-3 rounded-xl bg-surface-container-lowest px-5 py-2.5 shadow-luxe transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-primary transition-transform group-hover:-translate-x-1">
            arrow_back
          </span>
          <span className="font-headline font-semibold text-on-surface">Back to Home</span>
        </Link>
        <div className="absolute left-1/2 flex max-w-[min(90vw,520px)] -translate-x-1/2 flex-col items-center text-center">
          <h1 className="flex items-center gap-3 font-headline text-3xl font-black tracking-tight text-on-surface md:text-4xl lg:text-5xl">
            <span className="bg-gradient-to-br from-primary to-primary-container bg-clip-text text-transparent">
              {title}
            </span>
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-tertiary-container shadow-[0_0_12px_#65fde6]" />
          </h1>
          {centerSubtitle ? (
            <p className="mt-1 hidden text-xs text-on-surface-variant sm:block">{centerSubtitle}</p>
          ) : null}
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <div className="flex items-center gap-2 rounded-full border border-outline-variant/10 bg-surface-container-high/50 px-4 py-2">
            <span
              className="material-symbols-outlined text-sm text-tertiary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              circle
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Live Room
            </span>
          </div>
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-tertiary-container shadow-[0_0_8px_#65fde6]" : "bg-error"}`}
            title={connected ? "Realtime" : "Offline"}
          />
        </div>
      </header>
    );
  }

  if (variant === "tetris") {
    const show = tetrisOnlineUsers.slice(0, 2);
    return (
      <header className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-slate-200/40 bg-white/70 px-4 py-4 backdrop-blur-lg sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl px-4 py-2 font-bold text-primary transition-all hover:bg-surface-container-low active:scale-95"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="font-headline tracking-tight">Back to Home</span>
        </Link>
        <div className="absolute left-1/2 -translate-x-1/2">
          <h1 className="font-headline text-xl font-black tracking-tighter text-on-surface sm:text-2xl">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {show.map((u) => (
              <div
                key={u.id}
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-surface-container-lowest bg-secondary-container text-[10px] font-bold text-secondary"
                title={u.name}
              >
                {u.name.slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
          {tetrisOnlineUsers.length > 0 && (
            <span className="rounded-full bg-primary-container/20 px-3 py-1 text-xs font-bold text-primary">
              +{tetrisOnlineUsers.length} online
            </span>
          )}
        </div>
      </header>
    );
  }

  if (variant === "flappy") {
    return (
      <header className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-slate-200/40 bg-white/70 px-4 py-4 shadow-luxe backdrop-blur-lg sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl p-2 transition-all hover:bg-slate-100/50 active:scale-95"
        >
          <span className="material-symbols-outlined text-indigo-600">arrow_back</span>
          <span className="hidden font-semibold text-on-surface-variant md:inline">Home</span>
        </Link>
        <div className="absolute left-1/2 -translate-x-1/2">
          <h1 className="font-headline text-xl font-black tracking-tight text-slate-900">{title}</h1>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <button type="button" className="rounded-xl p-2 hover:bg-slate-100/50" aria-label="Akun">
            <span className="material-symbols-outlined">account_circle</span>
          </button>
          <button type="button" className="rounded-xl p-2 hover:bg-slate-100/50" aria-label="Pengaturan">
            <span className="material-symbols-outlined">settings</span>
          </button>
          {rightExtra}
        </div>
      </header>
    );
  }

  if (variant === "bomberman") {
    return (
      <header className="fixed top-0 z-50 flex w-full items-center justify-between px-4 py-6 sm:px-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-3 rounded-xl glass-panel px-5 py-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-primary transition-transform group-hover:-translate-x-1">
            arrow_back
          </span>
          <span className="font-headline text-sm font-bold tracking-tight">Back to Home</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="glass-panel flex items-center gap-2 rounded-xl px-4 py-2">
            <span
              className="material-symbols-outlined text-tertiary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              stars
            </span>
            <span className="text-sm font-bold">{connected ? "Live" : "Offline"}</span>
          </div>
          {rightExtra}
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-slate-200/40 bg-white/70 px-4 py-4 shadow-luxe backdrop-blur-lg sm:px-8">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-xl px-4 py-2 font-semibold text-primary transition-all hover:bg-surface-container-low active:scale-95"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        <span className="hidden sm:inline">Back to Home</span>
      </Link>
      <h1 className="absolute left-1/2 max-w-[70vw] -translate-x-1/2 truncate font-headline text-xl font-extrabold tracking-tighter text-on-surface">
        {title}
      </h1>
      <div className="flex items-center gap-2 text-on-surface-variant">
        <button type="button" className="rounded-full p-2 hover:bg-slate-100/50" aria-label="Akun">
          <span className="material-symbols-outlined">account_circle</span>
        </button>
        <button type="button" className="rounded-full p-2 hover:bg-slate-100/50" aria-label="Pengaturan">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>
  );
}
