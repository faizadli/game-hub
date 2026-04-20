"use client";

import type { TetrisInputAction } from "@/lib/realtime/types";

type Props = {
  disabled?: boolean;
  onAction: (action: TetrisInputAction) => void;
  className?: string;
};

const btn =
  "flex min-h-[48px] touch-manipulation select-none items-center justify-center rounded-xl border border-white/20 bg-white/10 px-2 text-sm font-medium text-white shadow-sm transition active:scale-[0.97] active:bg-white/20 disabled:pointer-events-none disabled:opacity-35";

export function MobileTetrisControls({ disabled, onAction, className }: Props) {
  const go = (a: TetrisInputAction) => {
    if (disabled) return;
    onAction(a);
  };

  return (
    <div
      className={`mx-auto w-full max-w-md space-y-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${className ?? ""}`}
      aria-label="Kontrol Tetris"
    >
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className={btn} disabled={disabled} onClick={() => go("left")} aria-label="Kiri">
          ← Kiri
        </button>
        <button
          type="button"
          className={btn}
          disabled={disabled}
          onClick={() => go("soft_drop")}
          aria-label="Turun pelan"
        >
          Turun
        </button>
        <button type="button" className={btn} disabled={disabled} onClick={() => go("right")} aria-label="Kanan">
          Kanan →
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          className={btn}
          disabled={disabled}
          onClick={() => go("rotate_ccw")}
          aria-label="Putar kiri"
        >
          ↺ Kiri
        </button>
        <button
          type="button"
          className={`${btn} border-rose-500/40 bg-rose-500/15`}
          disabled={disabled}
          onClick={() => go("hard_drop")}
          aria-label="Drop keras"
        >
          Drop
        </button>
        <button
          type="button"
          className={btn}
          disabled={disabled}
          onClick={() => go("rotate_cw")}
          aria-label="Putar kanan"
        >
          ↻ Kanan
        </button>
      </div>
      <button
        type="button"
        className={`${btn} w-full`}
        disabled={disabled}
        onClick={() => go("toggle_pause")}
        aria-label="Jeda"
      >
        Jeda / lanjut
      </button>
    </div>
  );
}
