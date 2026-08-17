"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Cloud, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MentiOption, MentiSlide } from "~/lib/menti";

interface Props {
  slide: MentiSlide;
  analytics?: any;
  isPreview?: boolean;
  showQuestion?: boolean;
  muted?: boolean;
  hideResults?: boolean;
}

interface CloudWord {
  text: string;
  value: number;
  color: string;
  angle: 0 | 90 | -90;
}

interface PositionedWord extends CloudWord {
  x: number;
  y: number;
  size: number;
  hw: number;
  hh: number;
}

interface PackResult {
  words: PositionedWord[];
  centerX: number;
  centerY: number;
  cloudWidth: number;
  cloudHeight: number;
  fitScale: number;
}

export const DEFAULT_WORD_CLOUD_COLORS = [
  "#5268e8",
  "#ff7378",
  "#313c8e",
  "#9189eb",
  "#43b7a6",
  "#e4a23e",
];

const previewWords: MentiOption[] = [
  { id: "p1", label: "creative", voteCount: 12 },
  { id: "p2", label: "leader", voteCount: 8 },
  { id: "p3", label: "focus", voteCount: 7 },
  { id: "p4", label: "bold", voteCount: 5 },
  { id: "p5", label: "collaboration", voteCount: 4 },
  { id: "p6", label: "inspiration", voteCount: 3 },
  { id: "p7", label: "growth", voteCount: 6 },
  { id: "p8", label: "energy", voteCount: 2 },
];

/** Deterministic per-word hash — stable across renders. */
function wordHash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

// Top 3 words are always horizontal (0°) for impact. ~15% of the rest go vertical.
function pickAngle(rank: number, text: string): 0 | 90 | -90 {
  if (rank < 3) return 0;
  const h = wordHash(text);
  if (h % 6 === 0) return (h >> 4) & 1 ? 90 : -90;
  return 0;
}

const CHAR_W = 0.58;
const LINE_H = 1.15;
const WORD_GAP = 5;

function packWordsWithAutoZoom(
  words: CloudWord[],
  containerWidth: number,
  containerHeight: number,
  isPreview: boolean
): PackResult {
  if (!words.length) {
    return { words: [], centerX: 0, centerY: 0, cloudWidth: 0, cloudHeight: 0, fitScale: 1 };
  }

  const maxValue = Math.max(...words.map((w) => w.value), 1);
  
  // Base sizing spectrum
  const minSize = isPreview ? 11 : 16;
  const maxSize = isPreview ? 38 : 72;

  const boxes: { x: number; y: number; hw: number; hh: number }[] = [];
  const placed: PositionedWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    // Power curve gives prominence to top words while keeping rare words legible
    const ratio = Math.pow(word.value / maxValue, 0.48);
    const size = Math.round(minSize + (maxSize - minSize) * ratio);

    const textW = word.text.length * size * CHAR_W + 6;
    const textH = size * LINE_H;
    const isVertical = word.angle !== 0;
    const hw = isVertical ? textH / 2 : textW / 2;
    const hh = isVertical ? textW / 2 : textH / 2;

    let x = 0;
    let y = 0;
    let found = i === 0;

    // Spiral outwards from center until finding an open spot
    const spiralStep = 3.5;
    const angleStep = 0.22;
    const aspectY = 0.65; // Elliptical aspect ratio to favor 16:9 widescreen presentation

    for (let t = 0; !found && t < 3000; t++) {
      const angle = t * angleStep + (i * 1.618);
      const r = t * spiralStep * 0.45;
      const nx = Math.cos(angle) * r;
      const ny = Math.sin(angle) * r * aspectY;

      let collides = false;
      for (let b = 0; b < boxes.length; b++) {
        const box = boxes[b]!;
        if (
          Math.abs(nx - box.x) < hw + box.hw + WORD_GAP &&
          Math.abs(ny - box.y) < hh + box.hh + WORD_GAP
        ) {
          collides = true;
          break;
        }
      }

      if (!collides) {
        x = nx;
        y = ny;
        found = true;
        break;
      }
    }

    boxes.push({ x, y, hw, hh });
    placed.push({ ...word, x, y, size, hw, hh });
  }

  // Calculate overall bounding box of the entire word cloud cluster
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of placed) {
    if (p.x - p.hw < minX) minX = p.x - p.hw;
    if (p.x + p.hw > maxX) maxX = p.x + p.hw;
    if (p.y - p.hh < minY) minY = p.y - p.hh;
    if (p.y + p.hh > maxY) maxY = p.y + p.hh;
  }

  const cloudWidth = Math.max(maxX - minX, 1);
  const cloudHeight = Math.max(maxY - minY, 1);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Safe viewable area (leaves ~10% margin on all edges so words never clip or touch bounds)
  const safeWidth = Math.max((containerWidth || 800) * 0.88 - 24, 100);
  const safeHeight = Math.max((containerHeight || 500) * 0.84 - 24, 80);

  const scaleX = safeWidth / cloudWidth;
  const scaleY = safeHeight / cloudHeight;
  
  // Dynamic smooth zoom-out factor: never scale up beyond 1.0, but smoothly scale down as cloud grows
  const fitScale = Math.min(1.0, scaleX, scaleY);

  return {
    words: placed,
    centerX,
    centerY,
    cloudWidth,
    cloudHeight,
    fitScale,
  };
}

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

  const hostRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<[number, number]>(
    isPreview ? [360, 200] : [1200, 650]
  );

  const source = useMemo<MentiOption[]>(() => {
    if (analytics?.wordCloud && Array.isArray(analytics.wordCloud) && analytics.wordCloud.length > 0) {
      return analytics.wordCloud.map((w: any, idx: number) => ({
        id: `word-${idx}-${w.text}`,
        label: w.text,
        voteCount: w.value || 0,
      }));
    }
    if (analytics?.options && Array.isArray(analytics.options) && analytics.options.length > 0) {
      return analytics.options;
    }
    if (analytics?.results && Array.isArray(analytics.results) && analytics.results.length > 0) {
      return analytics.results.map((r: any, idx: number) => ({
        id: r.id || `word-${idx}-${r.label || r.text}`,
        label: r.label || r.text,
        voteCount: r.count || r.value || r.voteCount || 0,
      }));
    }
    if (slide.options && slide.options.length > 0) {
      return slide.options;
    }
    return isPreview ? previewWords : [];
  }, [analytics, slide.options, isPreview]);

  const colors = slide.designSettings.wordCloudColors?.length
    ? slide.designSettings.wordCloudColors
    : DEFAULT_WORD_CLOUD_COLORS;

  const words = useMemo<CloudWord[]>(
    () =>
      [...source]
        .sort(
          (a, b) =>
            (b.voteCount || 0) - (a.voteCount || 0) ||
            a.label.localeCompare(b.label)
        )
        .slice(0, 60)
        .map((w, i) => ({
          text: w.label,
          value: w.voteCount || 0,
          color: w.color || colors[i % colors.length]!,
          angle: pickAngle(i, w.label),
        })),
    [source, colors]
  );

  const packResult = useMemo(
    () => packWordsWithAutoZoom(words, containerSize[0], containerSize[1], !!isPreview),
    [words, containerSize, isPreview]
  );

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      if (width > 0 && height > 0) {
        setContainerSize([Math.floor(width), Math.floor(height)]);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section
      className="flex h-full w-full flex-col select-none relative"
      style={{ color: slide.designSettings.textColor || "#17171c" }}
    >
      {showQuestion && (
        <div className="w-full flex flex-col items-center text-center">
          <h2
            className={`shrink-0 font-medium leading-[1.1] tracking-[-0.04em] ${
              isPreview
                ? "mb-2 text-xl sm:text-2xl max-w-xl mx-auto"
                : "mb-3 sm:mb-4 text-3xl sm:text-4xl md:text-5xl lg:text-6xl max-w-4xl mx-auto"
            }`}
          >
            {slide.question || "What word comes to mind?"}
          </h2>

          {/* Fixed height reservation for status badge */}
          <div className="h-6 flex items-center justify-center mb-2">
            <AnimatePresence>
              {isHidden && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-(--cf-cream-2) border border-(--cf-line-strong) rounded-(--hex-radius) text-[10px] font-mono font-bold tracking-wider uppercase text-(--cf-ink)"
                >
                  <EyeOff className="w-3 h-3 text-(--cf-ink-soft)" />
                  <span>Responses hidden</span>
                </motion.div>
              )}
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
      ) : words.length ? (
        <div
          ref={hostRef}
          className={`relative min-h-0 flex-1 w-full overflow-hidden flex items-center justify-center transition-opacity duration-300 ${
            muted ? "opacity-30" : "opacity-100"
          }`}
        >
          {/* Centered auto-scaling canvas viewport */}
          <div
            className="relative will-change-transform pointer-events-none"
            style={{
              width: 0,
              height: 0,
              transform: `translate(${-packResult.centerX * packResult.fitScale}px, ${-packResult.centerY * packResult.fitScale}px) scale(${packResult.fitScale})`,
              transition:
                "transform 700ms cubic-bezier(0.2, 0, 0.2, 1)",
            }}
          >
            {packResult.words.map((word) => (
              <span
                key={word.text}
                className="absolute whitespace-nowrap font-bold leading-none tracking-[-0.03em] select-none"
                style={{
                  left: word.x,
                  top: word.y,
                  color: word.color,
                  fontSize: `${word.size}px`,
                  transform: `translate(-50%, -50%) rotate(${word.angle}deg)`,
                  transition:
                    "font-size 600ms cubic-bezier(0.2, 0, 0.2, 1), transform 600ms cubic-bezier(0.2, 0, 0.2, 1), color 400ms ease, opacity 400ms ease",
                }}
              >
                {word.text}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400">
          <Cloud className={`mb-3 ${isPreview ? "size-7" : "size-10"}`} />
          <p className={`font-medium ${isPreview ? "text-xs" : "text-sm"}`}>
            Waiting for responses
          </p>
        </div>
      )}
    </section>
  );
}

