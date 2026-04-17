import { useEffect, useRef } from "react";

type KeyMap = Record<string, boolean>;

type UseKeyboardStateOptions = {
  active?: boolean;
  onKeyDown?: (key: string, event: KeyboardEvent) => void;
  onKeyUp?: (key: string, event: KeyboardEvent) => void;
};

export function useKeyboardState({
  active = true,
  onKeyDown,
  onKeyUp,
}: UseKeyboardStateOptions = {}) {
  const keysRef = useRef<KeyMap>({});

  useEffect(() => {
    if (!active) return;

    const handleDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keysRef.current[key] = true;
      onKeyDown?.(key, event);
    };

    const handleUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keysRef.current[key] = false;
      onKeyUp?.(key, event);
    };

    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, [active, onKeyDown, onKeyUp]);

  return keysRef;
}
