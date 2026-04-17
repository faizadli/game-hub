import Link from "next/link";

type Props = {
  href: string;
  title: string;
  description: string;
  accent: string;
  icon: string;
  playingCount: number;
};

export function GameCard({
  href,
  title,
  description,
  accent,
  icon,
  playingCount,
}: Props) {
  return (
    <Link
      href={href}
      className="group relative flex h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-[#121826]/80 p-5 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#171f30]/90"
    >
      <span
        className="pointer-events-none absolute -right-12 -top-10 h-28 w-28 rounded-full opacity-30 blur-2xl"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-xl leading-none"
              style={{ color: accent }}
              aria-hidden
            >
              {icon}
            </span>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[#e9ecf4]">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#99a2bb]">{description}</p>
            </div>
          </div>
          <span
            className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-medium text-[#dce5ff]"
          >
            {playingCount} online
          </span>
        </div>

        <p className="mt-auto flex items-center gap-2 text-xs font-medium text-[#8ea4d9] transition-colors group-hover:text-[#b8ccff]">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          Mainkan sekarang
          <span aria-hidden>→</span>
        </p>
      </div>
    </Link>
  );
}
