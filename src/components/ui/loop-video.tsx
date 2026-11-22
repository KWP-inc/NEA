"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A silent, looping background video: plays only while on screen, and stays on its poster frame
 * for visitors who prefer reduced motion or are saving data.
 */
/**
 * `small` is an optional lighter copy for phones. Nothing downloads until the video is near the screen.
 */
export function LoopVideo({ src, small, poster, className, label }: { src: string; small?: string; poster: string; className?: string; label?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (still) return void v.pause();
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!v.getAttribute("src")) v.src = small && window.innerWidth < 768 ? small : src;
          v.play().catch(() => {});
        } else v.pause();
      },
      { threshold: 0.05, rootMargin: "200px" },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [src, small]);
  return <video ref={ref} poster={poster} muted loop playsInline preload="none" aria-label={label} aria-hidden={label ? undefined : true} className={cn("object-cover", className)} />;
}
