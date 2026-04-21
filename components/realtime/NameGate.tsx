"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRealtime } from "./RealtimeProvider";

export function NameGate({ children }: { children: React.ReactNode }) {
  const { username, setUsername } = useRealtime();
  const [draft, setDraft] = useState("");
  const mounted = useSyncExternalStore(
    () => () => {
      // no-op subscription, we only need hydration-safe snapshots
    },
    () => true,
    () => false
  );

  const hasName = useMemo(() => username.trim().length > 0, [username]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="w-full max-w-md rounded-3xl bg-surface-container-lowest p-8 text-center text-sm text-on-surface-variant shadow-luxe">
          Menyiapkan sesi...
        </div>
      </div>
    );
  }

  if (hasName) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface p-6">
      <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] light-leak" aria-hidden />
      <div className="relative w-full max-w-md rounded-3xl bg-surface-container-lowest p-8 shadow-luxe">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface">Masukkan nama dulu</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Nama ini akan terlihat oleh user lain yang sedang online.
        </p>

        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            const value = draft.trim().slice(0, 24);
            if (!value) return;
            setUsername(value);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={24}
            placeholder="Contoh: Faiz"
            className="w-full rounded-2xl bg-surface-container-low px-4 py-3 text-on-surface outline-none ring-0 transition-colors placeholder:text-on-surface-variant/70 focus:bg-surface-container-lowest focus:shadow-[0_0_0_2px_rgba(70,71,211,0.2)]"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white gradient-primary transition-shadow hover:shadow-[0_0_24px_rgba(70,71,211,0.35)]"
          >
            Masuk ke Game Hub
          </button>
        </form>
      </div>
    </div>
  );
}
