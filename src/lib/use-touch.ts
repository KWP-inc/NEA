"use client";
import { useEffect, useState } from "react";

/**
 * True on phones and tablets (a finger, not a mouse). Heavy scroll effects use a lighter version there,
 * because they made phones stutter and left pictures "stuck" while the page moved.
 */
export const isTouchDevice = () =>
  typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 767px)").matches);

export function useTouchDevice() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const update = () => setTouch(isTouchDevice());
    update();
    const mq = window.matchMedia("(pointer: coarse)");
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return touch;
}
