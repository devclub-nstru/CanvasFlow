"use client";

import React, {
  memo,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Cloud, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MentiOption, MentiSlide } from "~/lib/menti";
import { CloudInput, PlacedWord, layoutCloud, layoutSignature } from "./layout";

interface Props {
  slide: MentiSlide;
  analytics?: any;
  isPreview?: boolean;
  showQuestion?: boolean;
  muted?: boolean;
  hideResults?: boolean;
}

export const DEFAULT_WORD_CLOUD_COLORS = [
  "#5268e8",
  "#ff7378",
  "#313c8e",
  "#9189eb",
  "#43b7a6",
  "#e4a23e",
];

const FALLBACK_FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_WEIGHT = 700;

const previewWords: MentiOption[] = [
  { id: "p1", label: "creative", voteCount: 12 },
  { id: "p2", label: "leader", voteCount: 8 },
  { id: "p3", label: "focus", voteCount: 7 },
  { id: "p4", label: "growth", voteCount: 6 },
  { id: "p5", label: "bold", voteCount: 5 },
  { id: "p6", label: "collaboration", voteCount: 4 },
  { id: "p7", label: "inspiration", voteCount: 3 },
  { id: "p8", label: "energy", voteCount: 2 },
];

/* ── one word ─────────────────────────────────────────────────────────────── */

/**
 * Framer owns the entire transform (x / y / rotate / scale). Nothing else may
 * write `transform` or the position fights the animation — the wrapper is
 * pinned to the container centre and the offsets already account for the
 * word's own half-size, so no translate(-50%) is needed.
 */
const CloudWord = memo(function CloudWord({ word }: { word: PlacedWord }) {
  const x = word.x - word.boxW / 2;
  const y = word.y - word.boxH / 2;

  return (
    <motion.span
      className="absolute left-1/2 top-1/2 block whitespace-nowrap font-bold leading-none tracking-[-0.03em]"
      style={{ color: word.color, transformOrigin: "center", willChange: "transform" }}
      initial={{ x, y, rotate: word.angle, scale: 0.35, opacity: 0, fontSize: word.fontSize }}
      animate={{ x, y, rotate: word.angle, scale: 1, opacity: 1, fontSize: word.fontSize }}
      exit={{ scale: 0.35, opacity: 0 }}
      transition={{
        x: { type: "spring", stiffness: 170, damping: 24 },
        y: { type: "spring", stiffness: 170, damping: 24 },
        fontSize: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
        rotate: { duration: 0.4, ease: "easeOut" },
        scale: { type: "spring", stiffness: 320, damping: 22 },
        opacity: { duration: 0.28, ease: "easeOut" },
      }}
    >
      {word.text}
    </motion.span>
  );
});

/* ── viewer ───────────────────────────────────────────────────────────────── */

export function WordCloudViewer({
  slide,
  analytics,
  isPreview,
  showQuestion = true,
  muted = false,
  hideResults,
}: Props) {
  const isHidden =
    hideResults !== undefined
      ? hideResults
      : (slide.responseSettings?.hideResultsFromAudience ?? false);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [fontFamily, setFontFamily] = useState(FALLBACK_FONT);

  // Track the stage box and the font actually in use, so measurement matches
  // what the browser will render.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const computed = window.getComputedStyle(el).fontFamily;
    if (computed) setFontFamily(computed);

    const read = () => {
      const { width, height } = el.getBoundingClientRect();
      setStage((prev) =>
        Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
          ? prev
          : { width, height },
      );
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isHidden]);

  /** Normalise whichever analytics shape arrived into {text, value}. */
  const words = useMemo<CloudInput[]>(() => {
    const fromAnalytics = (): CloudInput[] | null => {
      if (analytics?.wordCloud?.length) {
        return (analytics.wordCloud as any[]).map((w) => ({
          text: String(w.text ?? ""),
          value: Number(w.value ?? 0) || 1,
        }));
      }
      if (analytics?.results?.length) {
        return (analytics.results as any[]).map((r) => ({
          text: String(r.label ?? r.text ?? ""),
          value: Number(r.count ?? r.value ?? r.voteCount ?? 0) || 1,
        }));
      }
      if (analytics?.options?.length) {
        return (analytics.options as any[]).map((o) => ({
          text: String(o.label ?? ""),
          value: Number(o.voteCount ?? 0) || 1,
        }));
      }
      return null;
    };

    // An analytics payload that exists but is empty means "this slide has no
    // responses yet" — it must win over the stale options on the slide doc.
    const live = fromAnalytics();
    if (live) return live;
    if (analytics) return [];

    if (slide.options?.length) {
      return slide.options.map((o) => ({
        text: o.label,
        value: o.voteCount || 1,
      }));
    }
    return isPreview
      ? previewWords.map((o) => ({ text: o.label, value: o.voteCount || 1 }))
      : [];
  }, [analytics, slide.options, isPreview]);

  const colors = useMemo(
    () =>
      slide.designSettings.wordCloudColors?.length
        ? slide.designSettings.wordCloudColors
        : DEFAULT_WORD_CLOUD_COLORS,
    [slide.designSettings.wordCloudColors],
  );

  // Layout is the expensive part; keep it off the urgent render path so a burst
  // of incoming responses can never stall interaction.
  const deferredWords = useDeferredValue(words);
  const signature = useMemo(
    () => layoutSignature(deferredWords, Math.round(stage.width), Math.round(stage.height)),
    [deferredWords, stage.width, stage.height],
  );

  const placed = useMemo(
    () =>
      layoutCloud(deferredWords, stage.width, stage.height, {
        colors,
        fontFamily,
        fontWeight: FONT_WEIGHT,
        isPreview,
      }),
    // `signature` already encodes words + stage size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, colors, fontFamily, isPreview],
  );

  const totalResponses = Number(analytics?.totalResponses ?? 0);
  const hasWords = words.length > 0;

  return (
    <section
      className="relative flex h-full w-full select-none flex-col"
      style={{ color: slide.designSettings.textColor || "#17171c" }}
    >
      {showQuestion && (
        <div className="flex w-full flex-col items-center text-center">
          <h2
            className={`shrink-0 font-medium leading-[1.1] tracking-[-0.04em] ${
              isPreview
                ? "mx-auto mb-2 max-w-xl text-xl sm:text-2xl"
                : "mx-auto mb-3 max-w-4xl text-3xl sm:mb-4 sm:text-4xl md:text-5xl lg:text-6xl"
            }`}
          >
            {slide.question || "What word comes to mind?"}
          </h2>

          <div className="mb-2 flex h-6 items-center justify-center">
            <AnimatePresence mode="wait">
              {isHidden ? (
                <motion.div
                  key="hidden"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="inline-flex items-center gap-1.5 rounded-(--hex-radius) border border-(--cf-line-strong) bg-(--cf-cream-2) px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase text-(--cf-ink)"
                >
                  <EyeOff className="h-3 w-3 text-(--cf-ink-soft)" />
                  <span>Responses hidden</span>
                </motion.div>
              ) : totalResponses > 0 && !isPreview ? (
                <motion.span
                  key="count"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="font-mono text-[11px] font-bold tracking-wider uppercase text-(--cf-ink-soft) tabular-nums"
                >
                  {totalResponses.toLocaleString()}{" "}
                  {totalResponses === 1 ? "response" : "responses"}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      )}

      {isHidden ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400">
          <EyeOff className={`mb-3 ${isPreview ? "size-7" : "size-10"}`} />
          <p className={`font-medium ${isPreview ? "text-xs" : "text-sm"}`}>
            Results are hidden from audience
          </p>
        </div>
      ) : (
        <div
          ref={stageRef}
          className={`relative min-h-0 flex-1 overflow-hidden transition-opacity duration-300 ${
            muted ? "opacity-30" : "opacity-100"
          }`}
        >
          <AnimatePresence>
            {placed.map((word) => (
              <CloudWord key={word.key} word={word} />
            ))}
          </AnimatePresence>

          {!hasWords && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400">
              <Cloud className={`mb-3 ${isPreview ? "size-7" : "size-10"}`} />
              <p className={`font-medium ${isPreview ? "text-xs" : "text-sm"}`}>
                Waiting for responses
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
