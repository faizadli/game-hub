import { useEffect, useRef } from "react";

type FrameHandler = (deltaMs: number, nowMs: number) => void;

type UseRafTickerOptions = {
  running: boolean;
  onFrame: FrameHandler;
  maxDeltaMs?: number;
};

export function useRafTicker({
  running,
  onFrame,
  maxDeltaMs = 50,
}: UseRafTickerOptions) {
  const frameRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!running) {
      lastRef.current = 0;
      return;
    }

    const loop = (now: number) => {
      if (lastRef.current === 0) {
        lastRef.current = now;
      }
      const delta = Math.min(maxDeltaMs, Math.max(1, now - lastRef.current));
      lastRef.current = now;
      onFrameRef.current(delta, now);
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, [running, maxDeltaMs]);
}
