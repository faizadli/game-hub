"use client";

import { useEffect, useState } from "react";

/**
 * True on narrow viewports or coarse pointer (touch), so we show on-screen controls.
 */
export function useMobileGameUi() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const update = () => {
      const narrow = window.matchMedia("(max-width: 1023px)").matches;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setMobile(narrow || coarse);
    };
    update();
    const m1 = window.matchMedia("(max-width: 1023px)");
    const m2 = window.matchMedia("(pointer: coarse)");
    m1.addEventListener("change", update);
    m2.addEventListener("change", update);
    return () => {
      m1.removeEventListener("change", update);
      m2.removeEventListener("change", update);
    };
  }, []);

  return mobile;
}
