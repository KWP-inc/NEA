"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Marks each top-level page section that is off screen, so its endless CSS animations (pulses, shines,
 * marquees) pause. The browser then has nothing to update for parts nobody can see. Saves battery and
 * keeps scrolling smooth on phones.
 */
export function PauseOffscreen() {
  const path = usePathname();
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => (e.isIntersecting ? e.target.removeAttribute("data-offscreen") : e.target.setAttribute("data-offscreen", ""))),
      { rootMargin: "200px 0px" },
    );
    const t = window.setTimeout(() => document.querySelectorAll("main > section, main > div > section, footer").forEach((el) => io.observe(el)), 300);
    return () => {
      window.clearTimeout(t);
      io.disconnect();
    };
  }, [path]);
  return null;
}
