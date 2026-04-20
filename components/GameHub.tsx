"use client";

import { GAMES } from "@/lib/games";
import { GameCard } from "./GameCard";
import { useRealtime } from "./realtime/RealtimeProvider";

export function GameHub() {
  const { users, counts, connected, username } = useRealtime();
  const onlineNames = users.map((u) => u.name).filter(Boolean).slice(0, 10);
  const maxUsersText =
    users.length > onlineNames.length ? `, +${users.length - onlineNames.length} lainnya` : "";

  const gameCountBySlug: Record<string, number> = {
    snake: counts.snake,
    tetris: counts.tetris,
    bomberman: counts.bomberman,
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-10 sm:px-8">
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,#253252_0%,#101524_58%,#0b0d12_100%)] p-7 shadow-[0_35px_80px_-50px_rgba(0,0,0,0.95)]">
        <div className="pointer-events-none absolute -top-14 right-8 h-36 w-36 rounded-full bg-[#3d7dd9]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-[#7fffd4]/10 blur-3xl" />

        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-[#aab6d1]">
          <span
            className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-400"}`}
            aria-hidden
          />
          {connected ? "Realtime aktif" : "Realtime terputus"}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#eff3ff] sm:text-4xl">
          Game Hub
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#a8b1c7] sm:text-[15px]">
          Koleksi mini-game browser dengan nuansa arcade modern. Pilih game, lihat
          siapa yang online, lalu langsung main.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-xs text-[#97a4c2]">Nama kamu</p>
            <p className="mt-1 truncate text-sm font-medium text-[#e9ecf4]">{username}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-xs text-[#97a4c2]">Total online</p>
            <p className="mt-1 text-sm font-medium text-[#e9ecf4]">{counts.total} user</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-xs text-[#97a4c2]">Sedang di Snake</p>
            <p className="mt-1 text-sm font-medium text-[#e9ecf4]">{counts.snake} user</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-[#9ba8c7]">
          <span className="text-[#e0e7fb]">User online:</span>{" "}
          {onlineNames.length > 0 ? `${onlineNames.join(", ")}${maxUsersText}` : "-"}
        </div>
      </header>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#e9ecf4]">Pilih game</h2>
        <span className="text-xs text-[#8f96ac]">{GAMES.length} game tersedia</span>
      </div>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {GAMES.map((g) => (
          <li key={g.slug} className="min-h-[176px]">
            <GameCard
              href={`/games/${g.slug}`}
              title={g.title}
              description={g.description}
              accent={g.accent}
              icon={g.icon}
              playingCount={gameCountBySlug[g.slug] ?? 0}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
