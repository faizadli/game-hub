"use client";

import { GAMES } from "@/lib/games";
import { GameCard } from "./GameCard";
import { useRealtime } from "./realtime/RealtimeProvider";

export function GameHub() {
  const { users, counts, connected, username } = useRealtime();

  const gameCountBySlug: Record<string, number> = {
    snake: counts.snake,
    tetris: counts.tetris,
    typing: counts.typing,
    minecraft: counts.minecraft,
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <header className="mb-8 border-b border-[#252b38] pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#e8ecff]">
          Game Hub
        </h1>
        <p className="mt-2 max-w-lg text-sm text-[#8f96ac]">
          Koleksi game di browser (Next.js + React + TypeScript). Beberapa game
          diadaptasi dari skrip Python lokalmu.
        </p>
        <div className="mt-4 rounded-lg border border-[#273048] bg-[#111725] px-3 py-2 text-xs text-[#9db0d0]">
          <p>
            Kamu: <span className="text-[#e9ecf4]">{username}</span> · Status realtime:{" "}
            <span className={connected ? "text-[#5ecf7a]" : "text-[#f08080]"}>
              {connected ? "terhubung" : "terputus"}
            </span>{" "}
            · Online total: {counts.total}
          </p>
          <p className="mt-1 text-[#8f96ac]">
            User online: {users.map((u) => u.name).join(", ") || "-"}
          </p>
        </div>
      </header>
      <ul className="flex flex-col gap-3">
        {GAMES.map((g) => (
          <li key={g.slug}>
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
