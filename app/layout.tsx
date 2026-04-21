import type { Metadata, Viewport } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import { RealtimeShell } from "@/components/realtime/RealtimeShell";
import { BRANDING } from "@/lib/branding";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Game Hub",
  description: "Game sederhana di browser — Snake, Tetris, Typing, dll.",
  icons: {
    icon: [{ url: BRANDING.favicon, type: "image/png" }],
    shortcut: BRANDING.favicon,
    apple: BRANDING.favicon,
  },
  openGraph: {
    title: "Game Hub",
    description: "Game sederhana di browser — Snake, Tetris, Typing, dll.",
    images: [{ url: BRANDING.logoPng, alt: "Game Hub" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f7f9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${plusJakarta.variable} ${manrope.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
      </head>
      <body className="min-h-full bg-surface text-on-surface">
        <RealtimeShell>{children}</RealtimeShell>
      </body>
    </html>
  );
}
