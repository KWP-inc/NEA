"use client";
import { NeaSiIcon } from "@/components/brand/nea-si-icon";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarHeart, ChevronLeft, ChevronRight, Instagram, Sparkles, UserPlus, X, Youtube } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAi } from "@/components/ai/ai-provider";
import { useBooking } from "@/components/booking/booking";
import { cleanCaption, embedFor, embedHeight, reelTopic, socialVideos, type Platform, type SocialVideo } from "@/content/reels";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { useTouchDevice } from "@/lib/use-touch";

type Ctx = { open: (start?: number) => void; load: () => void; videos: SocialVideo[] };
const ReelsCtx = createContext<Ctx>({ open: () => {}, load: () => {}, videos: socialVideos });
export const useReels = () => useContext(ReelsCtx);

const valid = (list: SocialVideo[]) => list.filter((v) => embedFor(v.url));

/**
 * NEA's videos, played on this site through each platform's official embedded player.
 * Starts with the links in content/reels.ts; newer Instagram Reels are added when the Instagram API is connected.
 */
export function ReelsProvider({ children }: { children: ReactNode }) {
  const [start, setStart] = useState<number | null>(null);
  const [videos, setVideos] = useState<SocialVideo[]>(() => valid(socialVideos));
  const asked = useRef(false);

  const load = useCallback(() => {
    if (asked.current) return;
    asked.current = true;
    fetch("/api/reels")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { videos?: SocialVideo[] }) => {
        if (d.videos?.length) setVideos(valid(d.videos));
      })
      .catch(() => {});
  }, []);
  const open = useCallback(
    (i = 0) => {
      load();
      setStart(i);
    },
    [load],
  );

  // Nea SI answers can link straight to a video: [watch: …](#reel-3)
  useEffect(() => {
    const on = (e: Event) => open((e as CustomEvent<{ index?: number }>).detail?.index ?? 0);
    window.addEventListener("nea:reels", on);
    return () => window.removeEventListener("nea:reels", on);
  }, [open]);

  return (
    <ReelsCtx.Provider value={{ open, load, videos }}>
      {children}
      <AnimatePresence>{start !== null && videos.length > 0 && <Viewer videos={videos} start={start} onClose={() => setStart(null)} />}</AnimatePresence>
    </ReelsCtx.Provider>
  );
}

const FOLLOW: Record<Platform, { label: string; href: string; icon: ReactNode; bg: string }> = {
  instagram: { label: "Follow on Instagram", href: site.social.instagram, icon: <Instagram className="h-4 w-4" />, bg: "linear-gradient(90deg,#f58529,#dd2a7b 45%,#8134af 80%,#515bd4)" },
  youtube: { label: "Subscribe on YouTube", href: site.social.youtube, icon: <Youtube className="h-4 w-4" />, bg: "#ff0033" },
  tiktok: { label: "Follow on TikTok", href: site.social.tiktok, icon: <UserPlus className="h-4 w-4" />, bg: "#111" },
};

/** Follow button for a platform (hidden when NEA has no link for it yet). */
export function FollowButton({ platform = "instagram", className }: { platform?: Platform; className?: string }) {
  const f = FOLLOW[platform];
  if (!f.href) return null;
  return (
    <a href={f.href} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-medium text-white transition hover:brightness-110", className)} style={{ background: f.bg }}>
      {f.icon} {f.label}
    </a>
  );
}

/** Fits the platform's player to the space available. */
function useFit(platform: Platform) {
  const [w, setW] = useState(380);
  useEffect(() => {
    const fit = () => {
      const maxH = window.innerHeight - (window.innerWidth < 1024 ? 190 : 120);
      let width = Math.min(440, window.innerWidth - 32);
      while (width > 220 && embedHeight(platform, width) > maxH) width -= 10;
      setW(width);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [platform]);
  return w;
}

function Viewer(props: { videos: SocialVideo[]; start: number; onClose: () => void }) {
  // phones and tablets: a vertical swipe feed like Instagram Reels. Computers: one player with arrows.
  const touch = useTouchDevice();
  return touch ? <PhoneFeed {...props} /> : <DesktopViewer {...props} />;
}

/** Full-screen vertical feed: swipe up for the next video, like Instagram Reels. Only the videos near the screen load. */
function PhoneFeed({ videos, start, onClose }: { videos: SocialVideo[]; start: number; onClose: () => void }) {
  const list = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(Math.min(start, videos.length - 1));
  const [w, setW] = useState(360);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fit = () => setW(Math.min(440, window.innerWidth - 24));
    fit();
    window.addEventListener("resize", fit);
    const k = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    // open at the video that was tapped
    const el = list.current?.children[start] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "start" });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", k);
    };
  }, [onClose, start]);

  // which video is on screen
  useEffect(() => {
    const root = list.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((en) => en.isIntersecting && setActive(Number((en.target as HTMLElement).dataset.i))),
      { root, threshold: 0.6 },
    );
    Array.from(root.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [videos.length]);

  return (
    <motion.div role="dialog" aria-modal="true" aria-label="Glow Feed" className="fixed inset-0 z-[88] bg-black text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-lenis-prevent>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <p className="font-display text-[20px] leading-none">Glow Feed</p>
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="tabular rounded-full bg-white/15 px-3 py-1.5 text-[12.5px]">
            {active + 1} / {videos.length}
          </span>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div ref={list} className="h-[100dvh] snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((v, i) => (
          <FeedItem key={v.url} v={v} i={i} w={w} live={Math.abs(i - active) <= 1} />
        ))}
      </div>
    </motion.div>
  );
}

function FeedItem({ v, i, w, live }: { v: SocialVideo; i: number; w: number; live: boolean }) {
  const e = embedFor(v.url)!;
  const h = embedHeight(e.platform, w);
  const book = useBooking();
  const ai = useAi();
  const topic = reelTopic(v.caption ?? "");
  const caption = cleanCaption(v.caption ?? "");
  return (
    <section data-i={i} className="flex h-[100dvh] snap-start snap-always flex-col items-center justify-center gap-3 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-16">
      <div className="relative min-h-0 shrink overflow-hidden rounded-[20px] bg-white" style={{ width: w, height: h, maxHeight: "calc(100dvh - 190px)" }}>
        <div className="absolute inset-0 grid place-items-center text-[13px] text-black/40">Loading video…</div>
        {live && (
          <iframe src={e.src} title={caption || "NEA video"} width={w} height={e.platform === "instagram" ? h + 170 : h} className="relative block border-0" allow="autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share" allowFullScreen scrolling="no" />
        )}
      </div>
      <div className="w-full max-w-md shrink-0">
        {caption && <p className="mb-2 line-clamp-2 text-[13.5px] text-white/85">{caption}</p>}
        <div className="flex items-center gap-2">
          <button onClick={() => book.open(topic.key, topic.label)} className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-[13.5px] font-medium text-ink">
            <CalendarHeart className="h-4 w-4 shrink-0" /> <span className="truncate">{topic.key === "popular" ? "Book a visit" : `Book ${topic.label}`}</span>
          </button>
          <button onClick={() => ai.open({ context: topic.label, query: caption ? `Tell me about this: ${caption.slice(0, 140)}` : `Tell me about ${topic.label}` })} aria-label="Ask Nea SI" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15">
            <Sparkles className="h-5 w-5" />
          </button>
          {FOLLOW[e.platform].href && (
            <a href={FOLLOW[e.platform].href} target="_blank" rel="noreferrer" aria-label={FOLLOW[e.platform].label} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white" style={{ background: FOLLOW[e.platform].bg }}>
              {FOLLOW[e.platform].icon}
            </a>
          )}
        </div>
        {i === 0 && <p className="mt-2 text-center text-[12px] text-white/50">Swipe up for the next video</p>}
      </div>
    </section>
  );
}

function DesktopViewer({ videos, start, onClose }: { videos: SocialVideo[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(Math.min(start, videos.length - 1));
  const v = videos[Math.min(i, videos.length - 1)];
  const e = embedFor(v.url)!;
  const w = useFit(e.platform);
  const h = embedHeight(e.platform, w);
  const book = useBooking();
  const ai = useAi();
  const topic = reelTopic(v.caption ?? "");
  const caption = cleanCaption(v.caption ?? "");
  const go = useCallback((d: number) => setI((x) => (x + d + videos.length) % videos.length), [videos.length]);
  const bookIt = () => book.open(topic.key, topic.label);
  const askIt = () => ai.open({ context: topic.label, query: caption ? `Tell me about this: ${caption.slice(0, 140)}` : `Tell me about ${topic.label}` });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const k = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") (ev.preventDefault(), go(1));
      if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") (ev.preventDefault(), go(-1));
    };
    window.addEventListener("keydown", k);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", k);
    };
  }, [go, onClose]);

  // swipe left or right outside the player to change video
  const touch = useRef<number | null>(null);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Glow Feed"
      className="fixed inset-0 z-[88] flex flex-col bg-[rgb(12_10_16/0.94)] text-white backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      data-lenis-prevent
      onTouchStart={(ev) => (touch.current = ev.touches[0].clientX)}
      onTouchEnd={(ev) => {
        if (touch.current === null) return;
        const dx = ev.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      {/* top bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 p-3 md:p-5">
        <div className="flex items-center gap-3">
          <p className="hidden font-display text-[22px] leading-none md:block">Glow Feed</p>
          <FollowButton platform={e.platform} />
        </div>
        <div className="flex items-center gap-2">
          <span className="tabular rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] text-white/80">
            {i + 1} / {videos.length}
          </span>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* player, with details beside it on desktop */}
      <div className="flex min-h-0 flex-1 items-center justify-center gap-6 px-4 md:gap-10">
        <button onClick={() => go(-1)} aria-label="Previous video" className="hidden h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 md:grid">
          <ChevronLeft className="h-6 w-6" />
        </button>

        <AnimatePresence mode="wait">
          <motion.div key={e.platform + e.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.25 }} className="relative shrink-0 overflow-hidden rounded-[22px] bg-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]" style={{ width: w, height: h }}>
            <div className="absolute inset-0 grid place-items-center text-[13px] text-black/40">Loading video…</div>
            {/* Instagram's player is taller than the frame: likes and comments stay below the fold */}
            <iframe src={e.src} title={caption || "NEA video"} width={w} height={e.platform === "instagram" ? h + 170 : h} className="relative block border-0" allow="autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share" allowFullScreen scrolling="no" />
          </motion.div>
        </AnimatePresence>

        <div className="hidden w-[300px] shrink-0 lg:block">
          <p className="text-[12px] uppercase tracking-[0.18em] text-white/50">NEA Precision Skin</p>
          {topic.key !== "popular" && <p className="mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/85">{topic.label}</p>}
          {caption && <p className="mt-3 text-[15px] leading-relaxed text-white/90">{caption}</p>}
          <div className="mt-6 flex flex-col gap-2">
            <button onClick={bookIt} className="flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[14px] font-medium text-ink transition hover:bg-white/90">
              <CalendarHeart className="h-4 w-4" /> {topic.key === "popular" ? "Book a visit" : `Book ${topic.label}`}
            </button>
            <button onClick={askIt} className="flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-3 text-[14px] text-white transition hover:bg-white/20">
              <NeaSiIcon className="h-4 w-4" /> Ask Nea SI about this
            </button>
          </div>
          <p className="mt-5 text-[12px] text-white/45">Tap the video to play. Arrows or keyboard for the next one.</p>
        </div>

        <button onClick={() => go(1)} aria-label="Next video" className="hidden h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 md:grid">
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* bottom bar on phones and tablets */}
      <div className="shrink-0 p-3 lg:hidden">
        {caption && <p className="mx-auto mb-2 line-clamp-2 max-w-md text-center text-[13px] text-white/80">{caption}</p>}
        <div className="mx-auto flex max-w-md items-center justify-between gap-2">
          <button onClick={() => go(-1)} aria-label="Previous video" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={bookIt} className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-[13.5px] font-medium text-ink">
            <CalendarHeart className="h-4 w-4 shrink-0" /> <span className="truncate">{topic.key === "popular" ? "Book a visit" : `Book ${topic.label}`}</span>
          </button>
          <button onClick={askIt} aria-label="Ask Nea SI" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10">
            <Sparkles className="h-5 w-5" />
          </button>
          <button onClick={() => go(1)} aria-label="Next video" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
