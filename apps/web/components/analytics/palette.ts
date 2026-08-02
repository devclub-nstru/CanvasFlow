export const SERIES = [
  "#2d5cf6", // accent blue — first series, matches the primary action
  "#3aa793", // teal
  "#e3b23c", // yellow
  "#6c5ce7", // purple
  "#e0834a", // orange
  "#dd6459", // red
  "#a79ae4", // lavender
] as const;

export const seriesColor = (i: number) => SERIES[i % SERIES.length] as string;

export const SEMANTIC = {
  good: "#3aa793",
  warn: "#e3b23c",
  bad: "#dd6459",
  accent: "#2d5cf6",
} as const;

export const rateColor = (rate: number) => {
  if (rate >= 75) return SEMANTIC.good;
  if (rate >= 40) return SEMANTIC.warn;
  return SEMANTIC.bad;
};

export const CHROME = {
  axis: "#5b6070",
  grid: "rgba(26,29,41,0.10)",
  ink: "#1a1d29",
  surface: "#e8e8e8",
} as const;

export const DEVICE_COLORS = {
  Desktop: "#2d5cf6",
  Mobile: "#3aa793",
  Tablet: "#e3b23c",
} as const;
