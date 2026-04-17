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
      <div className="flex min-h-screen items-center justify-center bg-[#0b0d12] p-6">
        <div className="w-full max-w-md rounded-xl border border-[#2a3142] bg-[#161b26] p-6 text-center text-sm text-[#8f96ac]">
          Menyiapkan sesi...
        </div>
      </div>
    );
  }

  if (hasName) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0d12] p-6">
      <div className="w-full max-w-md rounded-xl border border-[#2a3142] bg-[#161b26] p-6">
        <h1 className="text-xl font-bold text-[#e9ecf4]">Masukkan nama dulu</h1>
        <p className="mt-2 text-sm text-[#8f96ac]">
          Nama ini akan terlihat oleh user lain yang sedang online.
        </p>

        <form
          className="mt-5"
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
            className="w-full rounded-lg border border-[#343c50] bg-[#0f131d] px-3 py-2 text-[#e9ecf4] outline-none focus:border-[#3d7dd9]"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-[#3d4860] px-4 py-2 font-medium text-white hover:bg-[#4d5a78]"
          >
            Masuk ke Game Hub
          </button>
        </form>
      </div>
    </div>
  );
}
