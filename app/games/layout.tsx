import Link from "next/link";

export default function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0b0d12]">
      <nav className="sticky top-0 z-10 border-b border-[#1e2430] bg-[#0b0d12]/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <Link
          href="/"
          className="text-sm text-[#8f96ac] transition-colors hover:text-[#3d7dd9]"
        >
          ← Kembali ke Game Hub
        </Link>
      </nav>
      {children}
    </div>
  );
}
