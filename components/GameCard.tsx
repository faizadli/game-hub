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
      className="group relative flex w-full max-w-xl overflow-hidden rounded-xl border border-[#2a3142] bg-[#161b26] transition-colors hover:border-[#3d4a62] hover:bg-[#1c2333]"
    >
      <div
        className="w-1.5 shrink-0 self-stretch"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
        <div className="flex items-start gap-3">
          <span
            className="text-xl leading-none"
            style={{ color: accent }}
            aria-hidden
          >
            {icon}
          </span>
          <div>
            <h2 className="text-base font-bold text-[#e9ecf4]">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#8f96ac]">
              {description}
            </p>
            <p className="mt-2 text-xs text-[#5ecf7a]">
              Sedang di game ini: {playingCount} user
            </p>
          </div>
        </div>
        <p className="text-right text-xs text-[#3d7dd9] group-hover:underline">
          Buka →
        </p>
      </div>
    </Link>
  );
}
