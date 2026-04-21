import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  /** Konten tambahan di bawah subtitle (mis. hint mobile). */
  children?: ReactNode;
};

/** Judul halaman game — gaya sama seperti Bomberman (besar, tengah, subtitle di bawah). */
export function GamePageHeroTitle({ title, subtitle, children }: Props) {
  return (
    <div className="mb-10 w-full text-center">
      <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-on-surface md:text-5xl lg:text-6xl">
        {title}
      </h1>
      {subtitle != null ? (
        <p className="mt-3 font-body text-lg tracking-wide text-on-surface-variant">{subtitle}</p>
      ) : null}
      {children}
    </div>
  );
}
