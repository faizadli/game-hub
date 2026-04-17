"use client";

import { NameGate } from "./NameGate";
import { RealtimeProvider } from "./RealtimeProvider";

export function RealtimeShell({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <NameGate>{children}</NameGate>
    </RealtimeProvider>
  );
}
