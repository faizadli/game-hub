"use client";

import { IntroVideoSplash } from "@/components/IntroVideoSplash";
import { NameGate } from "./NameGate";
import { RealtimeProvider } from "./RealtimeProvider";

export function RealtimeShell({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <IntroVideoSplash>
        <NameGate>{children}</NameGate>
      </IntroVideoSplash>
    </RealtimeProvider>
  );
}
