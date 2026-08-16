"use client";

import React from "react";
import { Cloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MentiOption, MentiSlide } from "~/lib/menti";

interface Props {
  slide: MentiSlide;
  isPreview?: boolean;
  showQuestion?: boolean;
  muted?: boolean;
}
interface CloudWord { text: string; value: number; color: string; angle: 0 | 90 | -90; }
interface PositionedWord extends CloudWord { x: number; y: number; size: number; }

export const DEFAULT_WORD_CLOUD_COLORS = ["#5268e8", "#ff7378", "#313c8e", "#9189eb", "#43b7a6", "#e4a23e"];

const previewWords: MentiOption[] = [
  { id: "p1", label: "creative",      voteCount: 12 },
  { id: "p2", label: "leader",        voteCount: 8  },
  { id: "p3", label: "focus",         voteCount: 7  },
  { id: "p4", label: "bold",          voteCount: 5  },
  { id: "p5", label: "collaboration", voteCount: 4  },
  { id: "p6", label: "inspiration",   voteCount: 3  },
  { id: "p7", label: "growth",        voteCount: 6  },
  { id: "p8", label: "energy",        voteCount: 2  },
];

/** Deterministic per-word hash — stable across renders. */
function wordHash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

// Only 0° and ±90° — diagonal angles inflate AABB and look messy.
// Top-2 words are always 0° for impact. ~20 % of the rest go vertical.
function pickAngle(rank: number, text: string): 0 | 90 | -90 {
  if (rank < 2) return 0;
  const h = wordHash(text);
  if (h % 5 === 0) return (h >> 4) & 1 ? 90 : -90;
  return 0;
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

const CHAR_W = 0.55;
const LINE_H = 1.10;
const GAP = 1.5;

function packWords(words: CloudWord[], width: number, height: number, isPreview: boolean): PositionedWord[] {
  if (!words.length) return [];

  const maxValue = Math.max(...words.map((w) => w.value), 1);
  const crowdFactor = Math.max(0.52, 1 - (words.length - 1) * 0.011);
  const maxSize = Math.min(
    isPreview ? 52 : 92,
    (isPreview ? height / 2.8 : height / 2.4) * crowdFactor,
  );
  const minSize = Math.max(isPreview ? 10 : 14, maxSize * 0.21);

  const wordSize = (value: number, scale: number) =>
    (minSize + (maxSize - minSize) * Math.pow(value / maxValue, 0.55)) * scale;

  const limit = Math.hypot(width, height) / 2;

  const tryPack = (scale: number): PositionedWord[] | null => {
    const boxes: { x: number; y: number; hw: number; hh: number }[] = [];
    const placed: PositionedWord[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i]!;
      const size  = wordSize(word.value, scale);
      const textW = word.text.length * size * CHAR_W;
      const textH = size * LINE_H;
      const { hw, hh } = aabb(textW, textH, word.angle);

      let x = 0, y = 0, found = i === 0;

      for (let radius = 1; !found && radius < limit; radius += 1) {
        const steps = Math.max(32, Math.ceil((2 * Math.PI * radius) / 4));
        const startAngle = i * 2.399;

        for (let s = 0; s < steps; s++) {
          const a = startAngle + (s / steps) * 2 * Math.PI;
          const nx = Math.cos(a) * radius;
          const ny = Math.sin(a) * radius * 0.72;

          if (Math.abs(nx) + hw + GAP > width  / 2 - 2) continue;
          if (Math.abs(ny) + hh + GAP > height / 2 - 2) continue;

          let collides = false;
          for (const b of boxes) {
            if (
              Math.abs(nx - b.x) < hw + GAP + b.hw &&
              Math.abs(ny - b.y) < hh + GAP + b.hh
            ) {
              collides = true;
              break;
            }
          }

          if (!collides) { x = nx; y = ny; found = true; break; }
        }
      }

      if (!found) return null;
      boxes.push({ x, y, hw, hh });
      placed.push({ ...word, x, y, size });
    }
    return placed;
  };

  for (let s = 1.0; s >= 0.40; s -= 0.04) {
    const result = tryPack(s);
    if (result) return result;
  }
  return tryPack(0.36) ?? [];
}

export function WordCloudViewer({ slide, isPreview, showQuestion = true, muted = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>(isPreview ? [360, 200] : [1200, 650]);

  const source = slide.options.length ? slide.options : isPreview ? previewWords : [];
  const colors = slide.designSettings.wordCloudColors?.length
    ? slide.designSettings.wordCloudColors
    : DEFAULT_WORD_CLOUD_COLORS;

  const words = useMemo<CloudWord[]>(
    () =>
      [...source]
        .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0) || a.label.localeCompare(b.label))
        .slice(0, 40)
        .map((w, i) => ({
          text:  w.label,
          value: w.voteCount || 0,
          color: w.color || colors[i % colors.length]!,
          angle: pickAngle(i, w.label),
        })),
    [source, colors],
  );

  const positionedWords = useMemo(
    () => packWords(words, size[0], size[1], !!isPreview),
    [words, size, isPreview],
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
      className="flex h-full w-full flex-col select-none"
      style={{ color: slide.designSettings.textColor || "#17171c" }}
    >
      {showQuestion && (
        <h2
          className={`shrink-0 font-medium leading-[1.1] tracking-[-0.04em] text-center ${
            isPreview
              ? "mb-4 text-2xl sm:text-3xl max-w-2xl mx-auto"
              : "mb-6 sm:mb-8 text-3xl sm:text-4xl md:text-5xl lg:text-6xl max-w-4xl mx-auto"
          }`}
        >
          {slide.question || "What word comes to mind?"}
        </h2>
      )}

      {words.length ? (
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
                color:      word.color,
                fontSize:   word.size,
                transition: "font-size 600ms ease-out, transform 600ms ease-out, color 400ms ease",
                transform:  `translate(calc(-50% + ${word.x}px), calc(-50% + ${word.y}px)) rotate(${word.angle}deg)`,
              }}
            >
              {word.text}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400">
          <Cloud className={`mb-3 ${isPreview ? "size-7" : "size-10"}`} />
          <p className={`font-medium ${isPreview ? "text-xs" : "text-sm"}`}>Waiting for responses</p>
        </div>
      )}
    </section>
  );
}
