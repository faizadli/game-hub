import Image from "next/image";
import Link from "next/link";

export type HubVariant = "featured" | "side" | "media" | "flappy" | "maze";

/** Tinggi seragam kartu baris 2 (Bomberman, Flappy, Maze) */
const ROW2_CARD =
  "flex h-full min-h-[520px] flex-col md:min-h-[540px] overflow-hidden rounded-[3rem]";

type Props = {
  href: string;
  hubTitle: string;
  hubDescription: string;
  playingCount: number;
  variant: HubVariant;
  coverImage: string | null;
};

export function GameCard({
  href,
  hubTitle,
  hubDescription,
  playingCount,
  variant,
  coverImage,
}: Props) {
  const countLabel = `${playingCount.toLocaleString("id-ID")} playing`;

  const baseMotion =
    "group relative block shadow-luxe transition-all duration-500 hover:scale-[1.02] hover:shadow-luxe-hover";

  if (variant === "featured" && coverImage) {
    return (
      <div className="md:col-span-8">
        <Link
          href={href}
          className={`${baseMotion} block h-[450px] w-full overflow-hidden rounded-[3rem] bg-surface-container-lowest`}
        >
          <Image
            src={coverImage}
            alt=""
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, 66vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/90 via-inverse-surface/20 to-transparent" />
          <div className="absolute bottom-0 left-0 flex w-full items-end justify-between p-8 sm:p-12">
            <div className="text-white">
              <div className="mb-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                  {countLabel}
                </span>
              </div>
              <h2 className="font-headline text-4xl font-extrabold tracking-tight sm:text-5xl">{hubTitle}</h2>
              <p className="mb-6 mt-2 max-w-sm text-sm text-white/70">{hubDescription}</p>
              <span className="inline-flex cursor-pointer items-center justify-center rounded-2xl px-8 py-4 text-sm font-bold text-white gradient-primary transition-shadow hover:shadow-[0_0_20px_rgba(70,71,211,0.3)]">
                Mainkan sekarang
              </span>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  if (variant === "side" && coverImage) {
    return (
      <div className="md:col-span-4">
        <Link
          href={href}
          className={`${baseMotion} flex h-[450px] w-full flex-col overflow-hidden bg-secondary-container/20`}
        >
          <div className="relative z-0 shrink-0 px-8 pb-0 pt-8 sm:px-10 sm:pt-10">
            <div className="relative h-48 w-full overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5">
              <Image
                src={coverImage}
                alt=""
                fill
                className="-rotate-2 object-cover transition-transform duration-500 group-hover:rotate-0"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute left-4 top-4 z-10">
                <span className="inline-flex items-center rounded-full border border-secondary/25 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-secondary shadow-md">
                  {countLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-8 pb-8 pt-2 sm:px-10 sm:pb-10">
            <div className="flex min-h-0 flex-1 flex-col">
              <h2 className="font-headline text-3xl font-extrabold text-on-surface">{hubTitle}</h2>
              <p className="mt-2 text-sm text-on-surface-variant">{hubDescription}</p>
            </div>
            <span className="mt-6 inline-flex w-full cursor-pointer items-center justify-center rounded-2xl border border-secondary/10 bg-white px-6 py-4 text-sm font-bold text-secondary transition-colors hover:bg-secondary hover:text-white">
              Mainkan sekarang
            </span>
          </div>
        </Link>
      </div>
    );
  }

  if (variant === "media" && coverImage) {
    return (
      <div className="md:col-span-4">
        <Link href={href} className={`${baseMotion} ${ROW2_CARD} bg-surface-container-lowest`}>
          <div className="flex flex-1 flex-col p-8">
            <div className="relative mb-6 h-56 w-full shrink-0 overflow-hidden rounded-3xl">
              <Image
                src={coverImage}
                alt=""
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute left-4 top-4 z-10">
                <span className="rounded-lg bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
                  {countLabel}
                </span>
              </div>
            </div>
            <h2 className="font-headline text-2xl font-extrabold text-on-surface">{hubTitle}</h2>
            <p className="mt-2 flex-1 text-sm text-on-surface-variant">{hubDescription}</p>
            <span className="mt-6 flex w-full cursor-pointer items-center justify-center rounded-2xl py-4 text-sm font-bold text-primary transition-colors hover:bg-primary-container/10">
              Mainkan sekarang
            </span>
          </div>
        </Link>
      </div>
    );
  }

  if (variant === "flappy" && coverImage) {
    return (
      <div className="md:col-span-4">
        <Link href={href} className={`${baseMotion} ${ROW2_CARD} bg-primary/5`}>
          <div className="flex flex-1 flex-col p-8 pb-4">
            <div className="mb-6 flex items-center justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm">
                <span className="material-symbols-outlined text-2xl text-primary">flutter_dash</span>
              </span>
              <span className="rounded-lg border border-primary/15 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm">
                {countLabel}
              </span>
            </div>
            <h2 className="font-headline text-2xl font-extrabold text-on-surface">{hubTitle}</h2>
            <p className="mt-2 text-sm text-on-surface-variant">{hubDescription}</p>
          </div>
          <div className="relative mt-auto h-48 w-full shrink-0">
            <Image
              src={coverImage}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/25 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-5 z-10 flex justify-center px-6">
              <span className="rounded-full bg-white px-7 py-3 text-sm font-bold text-primary shadow-xl ring-1 ring-black/5">
                Mainkan sekarang
              </span>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  if (variant === "maze" && coverImage) {
    return (
      <div className="md:col-span-4">
        <Link href={href} className={`${baseMotion} ${ROW2_CARD} bg-surface-container-lowest`}>
          <div className="relative h-56 w-full shrink-0 overflow-hidden">
            <Image
              src={coverImage}
              alt=""
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface via-inverse-surface/40 to-transparent" />
            <div className="absolute left-4 top-4 z-10">
              <span className="rounded-lg bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
                {countLabel}
              </span>
            </div>
          </div>
          <div className="relative flex flex-1 flex-col bg-inverse-surface p-8">
            <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 bg-primary/20 blur-3xl" aria-hidden />
            <div className="relative z-10 flex flex-1 flex-col">
              <h2 className="font-headline text-2xl font-extrabold text-white">{hubTitle}</h2>
              <p className="mt-3 flex-1 text-sm text-white/65">{hubDescription}</p>
              <div className="mt-6 flex flex-wrap gap-4 text-xs text-white/45">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">timer</span>
                  5m Match
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">group</span>
                  4 Players
                </span>
              </div>
              <span className="mt-8 flex w-full cursor-pointer items-center justify-center rounded-2xl bg-primary py-4 text-sm font-bold text-white transition-shadow hover:shadow-[0_0_24px_rgba(70,71,211,0.35)]">
                Mainkan sekarang
              </span>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  return null;
}
