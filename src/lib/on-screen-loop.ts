/**
 * Runs `frame` every animation frame, but only while `el` is on (or near) the screen and the tab is open.
 * Endless loops that kept running off-screen made phones hot and scrolling jerky.
 * Returns a stop function (use it as the effect cleanup).
 */
export function onScreenLoop(el: Element | null | undefined, frame: (t: number) => void, margin = "120px") {
  let raf = 0;
  let running = false;
  let near = !el; // no element: treat as always visible
  const tick = (t: number) => {
    frame(t);
    if (running) raf = requestAnimationFrame(tick);
  };
  const sync = () => {
    const want = near && document.visibilityState === "visible";
    if (want && !running) {
      running = true;
      raf = requestAnimationFrame(tick);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };
  const io = el
    ? new IntersectionObserver(
        ([e]) => {
          near = e.isIntersecting;
          sync();
        },
        { rootMargin: margin },
      )
    : null;
  if (el && io) io.observe(el);
  document.addEventListener("visibilitychange", sync);
  sync();
  return () => {
    running = false;
    cancelAnimationFrame(raf);
    io?.disconnect();
    document.removeEventListener("visibilitychange", sync);
  };
}
