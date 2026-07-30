/**
 * Fractional indexing helpers for the form builder.
 *
 * Fields are ordered by a `numeric` column with UNIQUE(form_id, index).
 * Fractional indexing is what lets a reorder write a single row: to move a
 * field between two neighbours you give it a value strictly between theirs,
 * and nothing else has to change. That matters here because the builder saves
 * every field with an independent, concurrent UPDATE — a scheme that had to
 * renumber the whole list would pass through states where two rows hold the
 * same index and trip the unique constraint.
 *
 * The invariant the whole scheme rests on: the value handed back is strictly
 * between the two neighbours. The previous implementation rounded midpoints
 * with `.toFixed(2)`, which breaks that invariant once a gap gets narrower
 * than 0.01 — `(1.00 + 1.01) / 2` became `"1.00"`, a duplicate of the
 * neighbour, and the save failed on the unique constraint. Nothing here
 * rounds.
 */

/** Decimal places used only when a value is small enough that
 *  `Number#toString` would switch to exponent notation. */
const EXPANDED_DECIMALS = 20;

/**
 * Serialise an index for the `numeric` column.
 *
 * `Number#toString` gives the shortest string that round-trips to the same
 * double, which keeps stored values tidy ("1.5" rather than
 * "1.50000000000000000000"). It does switch to exponent form below ~1e-6;
 * Postgres `numeric` would accept `5e-7`, but a plain decimal is easier to
 * read and diff, so those get expanded.
 */
export function formatIndex(value: number): string {
  const s = String(value);
  if (!s.includes("e") && !s.includes("E")) return s;
  return value.toFixed(EXPANDED_DECIMALS).replace(/0+$/, "").replace(/\.$/, "");
}

/** Parse a stored index. Returns NaN for unparseable input so callers can
 *  decide, rather than silently coercing to 0 and reordering the form. */
export function parseIndex(value: unknown): number {
  return Number.parseFloat(String(value));
}

/**
 * A value strictly between `before` and `after`, either of which may be null
 * to mean "no neighbour on that side".
 *
 * Returns null when no such value can be produced:
 *  - both neighbours are null (nothing to position against), or
 *  - the gap is exhausted, i.e. the two neighbours are adjacent doubles so no
 *    representable value sits between them. Reaching this needs roughly 50
 *    consecutive drops into the same gap; callers should treat it as a signal
 *    to renumber rather than as an error.
 */
export function indexBetween(before: number | null, after: number | null): string | null {
  const hasBefore = before !== null && Number.isFinite(before);
  const hasAfter = after !== null && Number.isFinite(after);

  if (!hasBefore && !hasAfter) return null;

  // Appending past the last field.
  if (!hasAfter) return formatIndex(before! + 1);

  // Inserting above the first field. Halving keeps the value positive, which
  // matters because indices are conventionally > 0 here; if the head is
  // already at or below zero, step down instead.
  if (!hasBefore) {
    const head = after!;
    return formatIndex(head > 0 ? head / 2 : head - 1);
  }

  const lo = before!;
  const hi = after!;
  // Out-of-order neighbours mean the caller's list wasn't sorted; refuse
  // rather than invent a value that breaks the ordering.
  if (lo >= hi) return null;

  // `lo + (hi - lo) / 2` rather than `(lo + hi) / 2`: no intermediate
  // overflow, and it stays accurate when the two are very close.
  const mid = lo + (hi - lo) / 2;
  if (mid <= lo || mid >= hi) return null;
  return formatIndex(mid);
}

/**
 * Whether `index` already sits strictly between its neighbours, i.e. the
 * field is correctly placed and needs no write. A null neighbour is treated
 * as unbounded on that side.
 */
export function isBetween(index: number, before: number | null, after: number | null): boolean {
  if (!Number.isFinite(index)) return false;
  const lo = before !== null && Number.isFinite(before) ? before : Number.NEGATIVE_INFINITY;
  const hi = after !== null && Number.isFinite(after) ? after : Number.POSITIVE_INFINITY;
  return index > lo && index < hi;
}
