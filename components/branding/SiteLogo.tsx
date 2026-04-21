"use client";

import Image from "next/image";
import { BRANDING } from "@/lib/branding";

/** Display sizes (px) — tuned so logo reads clearly in headers and on the hub. */
const SIZES = { sm: 76, md: 108, lg: 192 } as const;

type Props = {
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
};

export function SiteLogo({ size = "md", className, priority }: Props) {
  const dim = SIZES[size];
  return (
    <Image
      src={BRANDING.logoPng}
      alt="Game Hub"
      width={dim}
      height={dim}
      className={`object-contain ${className ?? ""}`}
      priority={priority}
      sizes={`${dim}px`}
    />
  );
}
