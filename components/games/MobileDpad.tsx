"use client";

export type CardinalDir = "up" | "down" | "left" | "right";

type MobileDpadProps = {
  disabled?: boolean;
  onDirection: (dir: CardinalDir) => void;
  /** Bomberman: tombol bom di tengah */
  center?: {
    label: React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
  };
  className?: string;
};

const btn =
  "flex min-h-[52px] min-w-[52px] touch-manipulation select-none items-center justify-center rounded-xl border border-white/20 bg-white/10 text-xl text-white shadow-sm transition active:scale-[0.97] active:bg-white/20 disabled:pointer-events-none disabled:opacity-35";

export function MobileDpad({ disabled, onDirection, center, className }: MobileDpadProps) {
  const fire = (dir: CardinalDir) => {
    if (disabled) return;
    onDirection(dir);
  };

  return (
    <div
      className={`mx-auto grid w-full max-w-[220px] grid-cols-3 gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${className ?? ""}`}
      aria-label="Kontrol arah"
    >
      <span />
      <button
        type="button"
        className={btn}
        aria-label="Atas"
        disabled={disabled}
        onClick={() => fire("up")}
      >
        ↑
      </button>
      <span />

      <button
        type="button"
        className={btn}
        aria-label="Kiri"
        disabled={disabled}
        onClick={() => fire("left")}
      >
        ←
      </button>
      {center ? (
        <button
          type="button"
          className={`${btn} text-base font-semibold`}
          aria-label="Aksi tengah"
          disabled={disabled || center.disabled}
          onClick={() => {
            if (disabled || center.disabled) return;
            center.onPress();
          }}
        >
          {center.label}
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        className={btn}
        aria-label="Kanan"
        disabled={disabled}
        onClick={() => fire("right")}
      >
        →
      </button>

      <span />
      <button
        type="button"
        className={btn}
        aria-label="Bawah"
        disabled={disabled}
        onClick={() => fire("down")}
      >
        ↓
      </button>
      <span />
    </div>
  );
}
