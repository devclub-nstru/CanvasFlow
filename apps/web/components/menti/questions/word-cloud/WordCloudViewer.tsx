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
  /** px correction applied at render so the ink, not the box, sits on (x, y). */
  inkOffset: number;
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

// Only 0° and ±90° — diagonal angles inflate AABB and look messy.
// Top-2 words are always 0° for impact. ~20% of the rest go vertical.
function pickAngle(rank: number, text: string): 0 | 90 | -90 {
  if (rank < 2) return 0;
  const h = wordHash(text);
  if (h % 5 === 0) return (h >> 4) & 1 ? 90 : -90;
  return 0;
}

/* Fallback advance-width ratio (width per 1px of font size, per character),
 * used only before the real font can be measured — i.e. during SSR and the
 * first paint. Everything visible to a presenter goes through measureText. */
const FALLBACK_CHAR_W = 0.58;
const FALLBACK_LINE_H = 0.78;

/* Breathing room between adjacent word boxes, in px. */
const GAP = 6;

/* The tracking applied to the rendered spans (`tracking-[-0.04em]`). Canvas
 * ignores CSS letter-spacing, so it has to be added back by hand or every word
 * measures wider than it draws. */
const TRACKING_EM = -0.04;

export interface TextMetrics2D {
  /** Rendered width per 1px of font size. */
  widthRatio: number;
  /** Ink height (ascent + descent) per 1px of font size. */
  heightRatio: number;
  /**
   * Signed distance, per 1px of font size, from the element's line-box centre
   * down to the centre of the glyph ink.
   *
   * `translate(-50%)` centres the element BOX. The ink inside it is not
   * centred — ascent is far larger than descent, so the visible letters sit
   * above the box centre. Reserving space around the box centre while drawing
   * ink above it is what pushed tall words past the top edge and left
   * descenders hanging off the bottom. Rendering subtracts this so the ink is
   * what actually gets centred on the packed position.
   */
  offsetRatio: number;
}

export type Measurer = (text: string) => TextMetrics2D;

/**
 * Real text measurement via canvas.
 *
 * The previous estimate — `text.length * size * 0.55` — treated every glyph as
 * the same width. For semibold display type that under-measures wide words
 * ("Collaborative", "Innovation") badly, so their collision boxes were smaller
 * than the glyphs actually drawn: words overlapped each other and ran past the
 * container edge. Measuring the real font removes the guess entirely.
 */
export function createMeasurer(fontFamily: string, fontWeight: number): Measurer {
  const REF = 100; // measure once at a reference size; advance width is linear in size
  const cache = new Map<string, TextMetrics2D>();

  let ctx: CanvasRenderingContext2D | null = null;
  if (typeof document !== "undefined") {
    ctx = document.createElement("canvas").getContext("2d");
    if (ctx) ctx.font = `${fontWeight} ${REF}px ${fontFamily}`;
  }

  return (text: string): TextMetrics2D => {
    const hit = cache.get(text);
    if (hit) return hit;

    let metrics: TextMetrics2D;

    if (ctx) {
      const m = ctx.measureText(text);
      const width = m.width + text.length * TRACKING_EM * REF;

      /* actualBoundingBox* is the real ink extent, which is far tighter than a
       * 1.1 line-height guess — that slack was showing up as ragged vertical
       * gaps between rows. */
      const inkAscent = m.actualBoundingBoxAscent || REF * 0.72;
      const inkDescent = m.actualBoundingBoxDescent || REF * 0.06;
      const ink = inkAscent + inkDescent;

      /* Font em-box metrics, needed to locate the baseline inside the line box.
       * The spans use `leading-none`, so line-box height == font size. */
      const fontAscent = (m.fontBoundingBoxAscent || REF * 0.8) / REF;
      const fontDescent = (m.fontBoundingBoxDescent || REF * 0.2) / REF;

      const halfLeading = (1 - (fontAscent + fontDescent)) / 2;
      const baselineFromTop = halfLeading + fontAscent;
      const inkCentreFromTop = baselineFromTop - (inkAscent - inkDescent) / 2 / REF;

      metrics = {
        widthRatio: Math.max(width, 1) / REF,
        heightRatio: ink / REF,
        offsetRatio: inkCentreFromTop - 0.5,
      };
    } else {
      metrics = {
        widthRatio: text.length * FALLBACK_CHAR_W,
        heightRatio: FALLBACK_LINE_H,
        offsetRatio: -0.08,
      };
    }

    cache.set(text, metrics);
    return metrics;
  };
}

/**
 * AABB half-extents for a word at a given rotation.
 * For 0°  → hw = textW/2,   hh = textH/2
 * For 90° → hw = textH/2,   hh = textW/2
 */
function aabb(textW: number, textH: number, angleDeg: number) {
  if (angleDeg === 0) return { hw: textW / 2, hh: textH / 2 };
  return { hw: textH / 2, hh: textW / 2 };
}

/**
 * Is this word's box fully inside the cloud silhouette?
 *
 * The old test was rectangular, which is why a full board looked like a solid
 * block of text rather than a cloud. Containment is now elliptical, with a
 * gentle per-angle wobble so the outline is organic instead of a perfect oval.
 */
function fitsInCloud(x: number, y: number, hw: number, hh: number, rx: number, ry: number) {
  const angle = Math.atan2(y, x);
  /* ±4% radius wobble on two frequencies — enough to break the oval, not
   * enough to let a word poke out of the container. */
  const wobble = 1 + 0.04 * Math.sin(angle * 3) + 0.025 * Math.cos(angle * 5);

  const ex = rx * wobble;
  const ey = ry * wobble;

  /* Test the far corner of the box, so no glyph crosses the boundary. */
  const nx = (Math.abs(x) + hw) / ex;
  const ny = (Math.abs(y) + hh) / ey;

  return nx * nx + ny * ny <= 1;
}

function packWords(
  words: CloudWord[],
  width: number,
  height: number,
  isPreview: boolean,
  measure: Measurer
): PositionedWord[] {
  if (!words.length) return [];

  const maxValue = Math.max(...words.map((w) => w.value), 1);
  const count = words.length;

  const crowdFactor = Math.max(0.52, 1 - (count - 1) * 0.011);
  const maxSize = Math.min(
    isPreview ? 52 : 92,
    (isPreview ? height / 2.8 : height / 2.4) * crowdFactor
  );
  const minSize = Math.max(isPreview ? 10 : 14, maxSize * 0.2);

  /**
   * Size blends vote share with rank.
   *
   * Vote share alone collapses when responses are spread evenly — 1000 people
   * across 30 words gives every word ~3% and `value / maxValue` ≈ 1, so every
   * word rendered at maximum size and the cloud became an unreadable slab.
   * Mixing in rank guarantees a visible hierarchy no matter how flat the vote
   * distribution is, and because words are placed most-popular-first from the
   * centre outward, it also produces the large-centre / small-edge shape.
   */
  const wordSize = (value: number, rank: number, scale: number) => {
    const valueWeight = Math.pow(value / maxValue, 0.6);
    const rankWeight = count > 1 ? 1 - rank / (count - 1) : 1;
    const t = 0.5 * valueWeight + 0.5 * rankWeight;
    return (minSize + (maxSize - minSize) * t) * scale;
  };

  const rx = width / 2 - 4;
  const ry = height / 2 - 4;
  const limit = Math.hypot(width, height) / 2;

  /** Places what it can; reports which words did not fit. */
  const tryPack = (scale: number): { placed: PositionedWord[]; dropped: number } => {
    const boxes: { x: number; y: number; hw: number; hh: number }[] = [];
    const placed: PositionedWord[] = [];
    let dropped = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i]!;
      const size = wordSize(word.value, i, scale);
      const { widthRatio, heightRatio, offsetRatio } = measure(word.text);
      const textW = widthRatio * size;
      const textH = heightRatio * size;
      const { hw, hh } = aabb(textW, textH, word.angle);

      let x = 0;
      let y = 0;
      let found = false;

      /* The first word anchors the centre, but only if it actually fits. */
      if (i === 0 && fitsInCloud(0, 0, hw, hh, rx, ry)) {
        found = true;
      }

      for (let radius = 1; !found && radius < limit; radius += 1) {
        const steps = Math.max(32, Math.ceil((2 * Math.PI * radius) / 4));
        /* Golden-angle offset per word so successive rings do not all start
         * from the same bearing and comb the words into visible rows. */
        const startAngle = i * 2.399;

        for (let s = 0; s < steps; s++) {
          const a = startAngle + (s / steps) * 2 * Math.PI;
          const nx = Math.cos(a) * radius;
          /* Squashed vertically so the spiral tracks the container's aspect
           * ratio rather than spiralling out in a circle inside a wide box. */
          const ny = Math.sin(a) * radius * (ry / rx);

          if (!fitsInCloud(nx, ny, hw, hh, rx, ry)) continue;

          let collides = false;
          for (const b of boxes) {
            if (Math.abs(nx - b.x) < hw + GAP + b.hw && Math.abs(ny - b.y) < hh + GAP + b.hh) {
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
      }

      if (!found) {
        /* Skip rather than abandon the layout. Words arrive most-popular-first,
         * so anything that cannot be placed is among the least popular — far
         * better to drop it than to return nothing, which is what the previous
         * all-or-nothing pack did on a crowded board. */
        dropped++;
        continue;
      }

      boxes.push({ x, y, hw, hh });
      placed.push({ ...word, x, y, size, inkOffset: offsetRatio * size });
    }

    return { placed, dropped };
  };

  /* Shrink until everything fits, then keep the best attempt. */
  let best: PositionedWord[] = [];
  for (let scale = 1.0; scale >= 0.4; scale -= 0.05) {
    const { placed, dropped } = tryPack(scale);
    if (dropped === 0) {
      best = placed;
      break;
    }
    if (placed.length > best.length) best = placed;
  }

  return fitToBounds(best, width, height, measure);
}

/**
 * Last line of defence against a word crossing the container edge.
 *
 * The elliptical containment test above works off measured metrics, but a
 * webfont that swaps in after measurement, a subpixel rounding difference, or a
 * rotated glyph whose ink is wider than reported can each leave a word a few
 * pixels out. Rather than clip it — which is what the presenter was seeing —
 * measure the real extent of the finished layout and, if it overflows, scale
 * the whole cloud (positions AND font sizes) down to fit. The composition is
 * preserved; it just reshapes to the space available.
 */
function fitToBounds(
  placed: PositionedWord[],
  width: number,
  height: number,
  measure: Measurer
): PositionedWord[] {
  if (!placed.length) return placed;

  const halfW = width / 2;
  const halfH = height / 2;

  let extentX = 0;
  let extentY = 0;

  for (const word of placed) {
    const { widthRatio, heightRatio } = measure(word.text);
    const { hw, hh } = aabb(widthRatio * word.size, heightRatio * word.size, word.angle);

    /* Measured against the ink centre, which is where the word is actually
     * drawn once inkOffset is applied. */
    extentX = Math.max(extentX, Math.abs(word.x) + hw);
    extentY = Math.max(extentY, Math.abs(word.y) + hh);
  }

  const ratio = Math.min(halfW / (extentX || 1), halfH / (extentY || 1), 1);
  if (ratio >= 0.999) return placed;

  return placed.map((word) => ({
    ...word,
    x: word.x * ratio,
    y: word.y * ratio,
    size: word.size * ratio,
    inkOffset: word.inkOffset * ratio,
  }));
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
  const [size, setSize] = useState<[number, number]>(
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
        .slice(0, 40)
        .map((w, i) => ({
          text: w.label,
          value: w.voteCount || 0,
          color: w.color || colors[i % colors.length]!,
          angle: pickAngle(i, w.label),
        })),
    [source, colors]
  );

  /* The spans render at the inherited family and `font-semibold`, so the
   * measurer has to use the same. Read it off the live container rather than
   * hardcoding a stack that would drift from the app's fonts. */
  const [fontFamily, setFontFamily] = useState<string>(
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
  );

  /* Bumped once webfonts finish loading, to force a re-measure. */
  const [fontsReady, setFontsReady] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const resolved = window.getComputedStyle(el).fontFamily;
    if (resolved) setFontFamily(resolved);

    /* Canvas measures whatever font is loaded at the time. If a webfont swaps
     * in afterwards, every cached width is from the fallback face and the
     * layout is built on stale numbers — which shows up as words overlapping or
     * running past the edge. Re-measure once the real faces are in. */
    let cancelled = false;
    document.fonts?.ready
      .then(() => {
        if (!cancelled) setFontsReady((n) => n + 1);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const measure = useMemo(
    () => createMeasurer(fontFamily, 600),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fontFamily, fontsReady]
  );

  const positionedWords = useMemo(
    () => packWords(words, size[0], size[1], !!isPreview, measure),
    [words, size, isPreview, measure]
  );

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      if (width && height) setSize([Math.floor(width), Math.floor(height)]);
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
            className={`shrink-0 font-medium leading-snug tracking-[-0.035em] break-words ${
              isPreview
                ? "mb-1.5 text-base sm:text-lg max-w-lg mx-auto"
                : "mb-2 sm:mb-3 text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] max-w-4xl mx-auto"
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
          className={`relative min-h-0 flex-1 overflow-hidden transition-opacity duration-300 ${
            muted ? "opacity-30" : "opacity-100"
          }`}
        >
          {positionedWords.map((word) => (
            <span
              key={word.text}
              className="absolute left-1/2 top-1/2 whitespace-nowrap font-semibold leading-none tracking-[-0.04em]"
              style={{
                color: word.color,
                fontSize: word.size,
                transition:
                  "font-size 600ms ease-out, transform 600ms ease-out, color 400ms ease",
                /* The trailing translate runs in the element's own frame, after
                 * the rotation, so the ink correction stays vertical relative to
                 * the glyphs whether the word is upright or turned 90°. */
                transform:
                  `translate(calc(-50% + ${word.x}px), calc(-50% + ${word.y}px)) ` +
                  `rotate(${word.angle}deg) translate(0px, ${-word.inkOffset}px)`,
              }}
            >
              {word.text}
            </span>
          ))}
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
