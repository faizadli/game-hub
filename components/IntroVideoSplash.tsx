"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const INTRO_SRC = "/intro.mp4";
const FADE_MS = 520;

type SplashPhase = "playing" | "exiting" | "done";

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

export function IntroVideoSplash({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<SplashPhase>("playing");
  const videoRef = useRef<HTMLVideoElement>(null);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const overlayOpen = phase !== "done" && !reducedMotion;
  const isPlaying = phase === "playing" && !reducedMotion;

  const beginExit = useCallback(() => {
    setPhase((p) => (p === "playing" ? "exiting" : p));
  }, []);

  useEffect(() => {
    if (phase !== "exiting") return;
    const t = window.setTimeout(() => {
      setPhase((p) => (p === "exiting" ? "done" : p));
    }, FADE_MS + 80);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlayOpen]);

  useEffect(() => {
    if (!isPlaying) return;
    const v = videoRef.current;
    if (!v) return;
    const id = requestAnimationFrame(() => {
      v.currentTime = 0;
      v.muted = true;
      v.play().catch(() => {});
    });
    return () => cancelAnimationFrame(id);
  }, [isPlaying]);

  const tryPlayWithSound = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {});
  }, []);

  const onOverlayTransitionEnd = useCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== "opacity") return;
    setPhase((p) => (p === "exiting" ? "done" : p));
  }, []);

  return (
    <>
      {children}
      {overlayOpen ? (
        <div
          className={`fixed inset-0 z-[300] flex items-center justify-center bg-white p-4 transition-opacity duration-500 ease-out motion-reduce:transition-none ${
            phase === "exiting" ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          role="presentation"
          aria-hidden
          onClick={tryPlayWithSound}
          onTransitionEnd={onOverlayTransitionEnd}
        >
          <video
            ref={videoRef}
            className="block max-h-[min(95vh,1840px)] w-auto max-w-[min(100vw,1920px)] border-0 bg-white object-contain outline-none ring-0"
            src={INTRO_SRC}
            playsInline
            muted
            preload="auto"
            onEnded={beginExit}
            onError={beginExit}
          />
        </div>
      ) : null}
    </>
  );
}
