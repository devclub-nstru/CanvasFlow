const EXPANDED_DECIMALS = 20;

export function formatIndex(value: number): string {
  const s = String(value);
  if (!s.includes("e") && !s.includes("E")) return s;
  return value.toFixed(EXPANDED_DECIMALS).replace(/0+$/, "").replace(/\.$/, "");
}

export function parseIndex(value: unknown): number {
  return Number.parseFloat(String(value));
}

export function indexBetween(before: number | null, after: number | null): string | null {
  const hasBefore = before !== null && Number.isFinite(before);
  const hasAfter = after !== null && Number.isFinite(after);

  if (!hasBefore && !hasAfter) return null;

  if (!hasAfter) return formatIndex(before! + 1);

  if (!hasBefore) {
    const head = after!;
    return formatIndex(head > 0 ? head / 2 : head - 1);
  }

  const lo = before!;
  const hi = after!;
  if (lo >= hi) return null;

  const mid = lo + (hi - lo) / 2;
  if (mid <= lo || mid >= hi) return null;
  return formatIndex(mid);
}

export function isBetween(index: number, before: number | null, after: number | null): boolean {
  if (!Number.isFinite(index)) return false;
  const lo = before !== null && Number.isFinite(before) ? before : Number.NEGATIVE_INFINITY;
  const hi = after !== null && Number.isFinite(after) ? after : Number.POSITIVE_INFINITY;
  return index > lo && index < hi;
}
