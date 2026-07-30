/**
 * Chart palette for the analytics widgets.
 *
 * Recharts needs real colour strings for SVG fills and strokes — it cannot
 * resolve `var(--c-teal)` in every position (gradient stops and the `fill` on
 * generated cells in particular), so the hues are duplicated here as literals
 * that mirror the `--c-*` tokens in globals.css. Keep the two in step.
 *
 * Before this existed each widget hardcoded its own colours, and they were all
 * still on the old warm theme (#f66f00 orange, #56504a warm grey) long after
 * the app moved to cool grey and blue — the charts visibly belonged to a
 * previous design. One list means that cannot drift again.
 */

/** Categorical series colours, in the order they should be handed out. */
export const SERIES = [
  "#2d5cf6", // accent blue — first series, matches the primary action
  "#3aa793", // teal
  "#e3b23c", // yellow
  "#6c5ce7", // purple
  "#e0834a", // orange
  "#dd6459", // red
  "#a79ae4", // lavender
] as const;

/** Pick a series colour by index, wrapping so any length is safe. */
export const seriesColor = (i: number) => SERIES[i % SERIES.length] as string;

/** Semantic colours for rates and deltas. */
export const SEMANTIC = {
  good: "#3aa793",
  warn: "#e3b23c",
  bad: "#dd6459",
  accent: "#2d5cf6",
} as const;

/**
 * Completion-rate colour. Banded rather than a continuous gradient so two
 * fields in the same band read as comparable at a glance.
 */
export const rateColor = (rate: number) => {
  if (rate >= 75) return SEMANTIC.good;
  if (rate >= 40) return SEMANTIC.warn;
  return SEMANTIC.bad;
};

/** Neutral chrome for axes, grids and tooltips, matching the cool grey theme. */
export const CHROME = {
  axis: "#5b6070",
  grid: "rgba(26,29,41,0.10)",
  ink: "#1a1d29",
  surface: "#e8e8e8",
} as const;

/**
 * Device breakdown keeps a fixed mapping so a device is always one colour.
 *
 * Declared with literal keys rather than `Record<string, string>`: the project
 * builds with `noUncheckedIndexedAccess`, so a string-indexed record would make
 * every lookup `string | undefined` and force a non-null assertion at each use.
 */
export const DEVICE_COLORS = {
  Desktop: "#2d5cf6",
  Mobile: "#3aa793",
  Tablet: "#e3b23c",
} as const;
