/**
 * Word cloud layout engine.
 *
 * Pure geometry — no React, no DOM mutation. Given words + a container box it
 * returns absolute positions, font sizes and rotations.
 *
 * Design notes:
 *  - Text is measured once per word with Canvas2D at a base size and scaled
 *    linearly, so "iiii" and "WWWW" get honest widths (a fixed per-character
 *    estimate makes both packing and collision detection wrong).
 *  - Collisions use a spatial hash grid, turning each placement probe from
 *    O(placed) into roughly O(1).
 *  - The global scale is binary searched instead of stepped linearly.
 *  - A word's spiral start angle is derived from a hash of its text, not its
 *    index, so a word keeps roughly the same region of the canvas as its rank
 *    drifts. That is what makes live updates read as movement rather than a
 *    full reshuffle.
 */

export type WordAngle = 0 | 90 | -90;

export interface CloudInput {
  text: string;
  value: number;
}

export interface PlacedWord {
  key: string;
  text: string;
  value: number;
  rank: number;
  /** Offset of the word's centre from the container centre, in px. */
  x: number;
  y: number;
  /** Rendered box size after rotation, in px. */
  boxW: number;
  boxH: number;
  fontSize: number;
  angle: WordAngle;
  color: string;
}

export interface LayoutOptions {
  colors: string[];
  fontFamily: string;
  fontWeight: number | string;
  isPreview?: boolean;
  maxWords?: number;
}

/* ── text metrics ─────────────────────────────────────────────────────────── */

const BASE_PX = 100;
const metricCache = new Map<string, { w: number; h: number }>();
let measureCtx: CanvasRenderingContext2D | null | undefined;

function getCtx(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  if (typeof document === "undefined") {
    measureCtx = null;
    return null;
  }
  const canvas = document.createElement("canvas");
  measureCtx = canvas.getContext("2d");
  return measureCtx;
}

/**
 * Width/height of `text` rendered at BASE_PX. Both scale linearly with font
 * size, so one measurement per word serves every scale we try.
 */
function baseMetrics(text: string, family: string, weight: number | string) {
  const cacheKey = `${weight}|${family}|${text}`;
  const hit = metricCache.get(cacheKey);
  if (hit) return hit;

  let metrics: { w: number; h: number };
  const ctx = getCtx();

  if (ctx) {
    ctx.font = `${weight} ${BASE_PX}px ${family}`;
    const m = ctx.measureText(text);
    const ascent = m.actualBoundingBoxAscent;
    const descent = m.actualBoundingBoxDescent;
    const h =
      Number.isFinite(ascent) && Number.isFinite(descent) && ascent + descent > 0
        ? ascent + descent
        : BASE_PX * 0.72;
    metrics = { w: m.width, h };
  } else {
    // SSR / no canvas: rough estimate, replaced on the client's first measure.
    metrics = { w: text.length * BASE_PX * 0.56, h: BASE_PX * 0.72 };
  }

  metricCache.set(cacheKey, metrics);
  return metrics;
}

/* ── deterministic per-word randomness ───────────────────────────────────── */

function hashText(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/** Top words stay horizontal; the rest lean on a stable hash of their text. */
function angleFor(rank: number, hash: number): WordAngle {
  if (rank < 3) return 0;
  if (hash % 100 < 72) return 0;
  return (hash >>> 7) & 1 ? 90 : -90;
}

/* ── spatial hash grid ───────────────────────────────────────────────────── */

interface Box {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

const GAP = 5;

class SpatialGrid {
  private cells = new Map<number, Box[]>();

  constructor(private readonly cell: number) {}

  private key(gx: number, gy: number): number {
    // Pack two signed cell coords into one integer key.
    return ((gx + 4096) << 13) | (gy + 4096);
  }

  insert(box: Box): void {
    const x0 = Math.floor((box.x - box.hw) / this.cell);
    const x1 = Math.floor((box.x + box.hw) / this.cell);
    const y0 = Math.floor((box.y - box.hh) / this.cell);
    const y1 = Math.floor((box.y + box.hh) / this.cell);

    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const k = this.key(gx, gy);
        const bucket = this.cells.get(k);
        if (bucket) bucket.push(box);
        else this.cells.set(k, [box]);
      }
    }
  }

  /** True if `box` (grown by GAP) overlaps anything already inserted. */
  collides(box: Box): boolean {
    const x0 = Math.floor((box.x - box.hw - GAP) / this.cell);
    const x1 = Math.floor((box.x + box.hw + GAP) / this.cell);
    const y0 = Math.floor((box.y - box.hh - GAP) / this.cell);
    const y1 = Math.floor((box.y + box.hh + GAP) / this.cell);

    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const bucket = this.cells.get(this.key(gx, gy));
        if (!bucket) continue;
        for (const other of bucket) {
          if (
            Math.abs(box.x - other.x) < box.hw + other.hw + GAP &&
            Math.abs(box.y - other.y) < box.hh + other.hh + GAP
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

/* ── ellipse containment ─────────────────────────────────────────────────── */

/** Every corner of the box must sit inside the ellipse with semi-axes a, b. */
function insideEllipse(box: Box, a: number, b: number): boolean {
  const right = box.x + box.hw;
  const left = box.x - box.hw;
  const bottom = box.y + box.hh;
  const top = box.y - box.hh;

  const ra = 1 / (a * a);
  const rb = 1 / (b * b);

  return (
    right * right * ra + bottom * bottom * rb <= 1 &&
    right * right * ra + top * top * rb <= 1 &&
    left * left * ra + bottom * bottom * rb <= 1 &&
    left * left * ra + top * top * rb <= 1
  );
}

/* ── main layout ─────────────────────────────────────────────────────────── */

interface Prepared {
  text: string;
  value: number;
  rank: number;
  hash: number;
  angle: WordAngle;
  color: string;
  /** Unscaled width/height at font size 1. */
  unitW: number;
  unitH: number;
  /** Font size at scale 1. */
  baseFont: number;
}

/** Arc-length between samples on the shared spiral, in px. */
const SPIRAL_STEP = 10;
/**
 * Ceiling on placement probes for a single word, bounding worst-case cost.
 * Keep this generous: a small word hunting a gap far from the centre covers
 * little radial ground per probe, and starving it produces spurious drops.
 */
const MAX_PROBES_PER_WORD = 2000;

export function layoutCloud(
  input: CloudInput[],
  width: number,
  height: number,
  options: LayoutOptions,
): PlacedWord[] {
  const { colors, fontFamily, fontWeight, isPreview = false } = options;
  const maxWords = options.maxWords ?? (isPreview ? 14 : 45);

  if (!input.length || width < 40 || height < 40 || !colors.length) return [];

  // Highest count first; alphabetical tiebreak keeps ordering stable between
  // updates so equal-count words don't swap places on every broadcast.
  const words = [...input]
    .filter((w) => w.text && w.text.trim().length > 0)
    .sort((a, b) => b.value - a.value || a.text.localeCompare(b.text))
    .slice(0, maxWords);

  if (!words.length) return [];

  const n = words.length;
  const maxValue = Math.max(...words.map((w) => w.value), 1);
  const minValue = Math.min(...words.map((w) => w.value));
  const valueSpread = maxValue - minValue;

  // Font size envelope, relative to the container so it scales with the stage.
  const ceiling = Math.min(isPreview ? 44 : 104, height * (isPreview ? 0.3 : 0.34));
  /*
   * Compress the range when there are only a handful of words — with two words
   * a full-width envelope makes the runner-up look like a footnote.
   */
  const floorRatio = n <= 2 ? 0.62 : n <= 4 ? 0.48 : n <= 8 ? 0.34 : 0.16;
  const floor = Math.max(isPreview ? 10 : 13, ceiling * floorRatio);

  /**
   * Blend value-driven and rank-driven weighting.
   *
   * With many participants and a wide vocabulary the raw counts bunch up
   * (every word lands within a few votes of the others), which renders as a
   * wall of identically sized text. The rank term guarantees a readable
   * hierarchy no matter how flat the distribution is, while the value term
   * keeps the result honest when counts genuinely differ.
   */
  const sizeFor = (value: number, rank: number): number => {
    const byValue = valueSpread > 0 ? (value - minValue) / valueSpread : 0;
    const byRank = n > 1 ? 1 - rank / (n - 1) : 1;
    const blended = 0.45 * byValue + 0.55 * byRank;
    const curved = Math.pow(blended, 1.3);
    return floor + (ceiling - floor) * curved;
  };

  const prepared: Prepared[] = words.map((word, rank) => {
    const hash = hashText(word.text.toLowerCase());
    const angle = angleFor(rank, hash);
    const baseFont = sizeFor(word.value, rank);
    const m = baseMetrics(word.text, fontFamily, fontWeight);
    const unitW = m.w / BASE_PX;
    const unitH = m.h / BASE_PX;

    return {
      text: word.text,
      value: word.value,
      rank,
      hash,
      angle,
      color: colors[hash % colors.length]!,
      // A rotated word swaps its width and height.
      unitW: angle === 0 ? unitW : unitH,
      unitH: angle === 0 ? unitH : unitW,
      baseFont,
    };
  });

  const ellipseA = (width / 2) * 0.97;
  const ellipseB = (height / 2) * 0.97;
  const spiralLimit = Math.hypot(ellipseA, ellipseB);
  // Landscape stages read better with the cloud slightly wider than tall.
  const xBias = 1.16;
  const yBias = 0.78;

  /*
   * One unit spiral, precomputed and shared by every word and every scale
   * attempt. Sampling it costs a few multiplies per probe instead of two trig
   * calls, and each word reuses it via:
   *   - a rotation matrix built from its hash (its personal start angle)
   *   - a stride, so large words sample coarsely and small words finely
   */
  const spiralGrowth = SPIRAL_STEP / (2 * Math.PI);
  const spiralX: number[] = [];
  const spiralY: number[] = [];
  const spiralR: number[] = [];
  {
    let theta = 0;
    for (;;) {
      const r = spiralGrowth * theta;
      if (r > spiralLimit) break;
      spiralX.push(Math.cos(theta) * r);
      spiralY.push(Math.sin(theta) * r);
      spiralR.push(r);
      theta += SPIRAL_STEP / Math.max(r, SPIRAL_STEP);
    }
  }
  const spiralLen = spiralR.length;

  /** First spiral index at or beyond `radius` (spiralR is ascending). */
  const indexAtRadius = (radius: number): number => {
    if (radius <= 0) return 0;
    let lo = 0;
    let hi = spiralLen - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (spiralR[mid]! < radius) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const attempt = (scale: number) => {
    const avgFont = (floor + ceiling) * 0.5 * scale;
    const grid = new SpatialGrid(Math.max(20, Math.min(90, avgFont)));
    const placed: PlacedWord[] = [];
    /** Outer radius already claimed, used to skip the saturated core. */
    let frontier = 0;

    for (let i = 0; i < prepared.length; i++) {
      const word = prepared[i]!;
      const fontSize = word.baseFont * scale;
      const boxW = word.unitW * fontSize;
      const boxH = word.unitH * fontSize;
      const hw = boxW / 2;
      const hh = boxH / 2;

      const stride = Math.max(1, Math.round(Math.min(hw, hh) / SPIRAL_STEP));
      /*
       * The biggest words earn the centre; later ones begin their search near
       * the current frontier instead of grinding through occupied positions.
       * 0.7 was measured against 0.4 / 0.55 / 0.85: it simultaneously seats the
       * most words, fills the most canvas (the cloud spreads into the outer
       * ring instead of crowding the middle) and runs ~13× faster than 0.4.
       * Pushing it to 0.85 starts past valid gaps and drops half the words.
       */
      const start = i < 6 ? 0 : indexAtRadius(frontier * 0.7);

      const angle = ((word.hash % 3600) / 3600) * Math.PI * 2;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);

      let found: Box | null = null;
      let probes = 0;

      for (let k = start; k < spiralLen; k += stride) {
        if (++probes > MAX_PROBES_PER_WORD) break;

        const px = spiralX[k]!;
        const py = spiralY[k]!;
        const candidate: Box = {
          x: (px * ca - py * sa) * xBias,
          y: (px * sa + py * ca) * yBias,
          hw,
          hh,
        };

        if (insideEllipse(candidate, ellipseA, ellipseB) && !grid.collides(candidate)) {
          found = candidate;
          break;
        }
      }

      // Words that cannot fit are dropped rather than shrinking everything —
      // one missing rare word beats an unreadable cloud.
      if (!found) continue;

      grid.insert(found);
      frontier = Math.max(frontier, Math.hypot(found.x, found.y) + Math.max(hw, hh));

      placed.push({
        key: word.text.toLowerCase(),
        text: word.text,
        value: word.value,
        rank: word.rank,
        x: found.x,
        y: found.y,
        boxW,
        boxH,
        fontSize,
        angle: word.angle,
        color: word.color,
      });
    }

    return { placed, ratio: placed.length / n };
  };

  // Largest scale that still seats almost every word. Placement ratio rises as
  // scale falls, so a binary search converges. The lower bound is deliberately
  // high: below it text stops being legible from the back of a room, and
  // dropping the rarest words is the better trade.
  const TARGET_RATIO = 0.88;
  let best = attempt(1);

  if (best.ratio < TARGET_RATIO) {
    let lo = 0.5;
    let hi = 1;
    for (let i = 0; i < 3; i++) {
      const mid = (lo + hi) / 2;
      const result = attempt(mid);
      if (result.ratio >= TARGET_RATIO) {
        best = result;
        lo = mid;
      } else {
        hi = mid;
        // Keep the fullest layout seen in case nothing hits the target.
        if (result.ratio > best.ratio) best = result;
      }
    }
  }

  const placed = best.placed;
  if (!placed.length) return [];

  /*
   * Recentre on the real bounding box, then grow (or shrink) the whole cloud to
   * fill the stage. Scaling positions and font sizes by one factor about the
   * origin preserves every gap proportionally, so this cannot introduce an
   * overlap — it just stops the cloud from floating small in the middle.
   */
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const word of placed) {
    minX = Math.min(minX, word.x - word.boxW / 2);
    maxX = Math.max(maxX, word.x + word.boxW / 2);
    minY = Math.min(minY, word.y - word.boxH / 2);
    maxY = Math.max(maxY, word.y + word.boxH / 2);
  }

  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  const fill = Math.min(
    (width * 0.98) / Math.max(spanX, 1),
    (height * 0.98) / Math.max(spanY, 1),
    1.55,
  );

  const maxFont = isPreview ? 52 : 118;

  return placed.map((word) => ({
    ...word,
    x: (word.x - centreX) * fill,
    y: (word.y - centreY) * fill,
    boxW: word.boxW * fill,
    boxH: word.boxH * fill,
    fontSize: Math.min(maxFont, word.fontSize * fill),
  }));
}

/** Cheap identity for a word set + stage size, used to memoise layout runs. */
export function layoutSignature(
  input: CloudInput[],
  width: number,
  height: number,
): string {
  let signature = `${width}x${height}|`;
  for (const word of input) signature += `${word.text}:${word.value};`;
  return signature;
}
