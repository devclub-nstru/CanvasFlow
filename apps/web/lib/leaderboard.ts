/**
 * Reveal bookkeeping for leaderboard slides.
 *
 * The presenter unmounts a slide's viewer when the host navigates away, so
 * component state cannot remember that the reveal animation already played.
 * Stepping back to a leaderboard would otherwise replay the whole count-up,
 * which reads as the scores being recalculated.
 *
 * Backed by sessionStorage rather than module state alone. Module state is wiped
 * by dev hot-reload and by a page refresh, both of which made a revisit animate
 * again; sessionStorage survives those and still clears when the tab closes, so
 * a genuinely new presentation run reveals fresh.
 */

export type RevealMode = "animate" | "settled";

const STORAGE_PREFIX = "cf_lb_reveal_";

/** Fast path, and the only store during SSR or when storage is unavailable. */
const memory = new Map<string, string>();

function readSignature(slideId: string): string | undefined {
  const cached = memory.get(slideId);
  if (cached !== undefined) return cached;

  if (typeof window === "undefined") return undefined;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_PREFIX + slideId);
    if (stored !== null) {
      memory.set(slideId, stored);
      return stored;
    }
  } catch {
    // Private mode or storage disabled — the in-memory map still works.
  }
  return undefined;
}

function writeSignature(slideId: string, signature: string): void {
  memory.set(slideId, signature);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + slideId, signature);
  } catch {
    // Non-fatal: the reveal simply replays if the tab is reloaded.
  }
}

/** Identity of a set of standings: who is listed and what they scored. */
export function standingsSignature(
  rows: Array<{ participantId: string; points: number }>,
): string {
  return rows.map((row) => `${row.participantId}:${row.points}`).join("|");
}

/** Whether a reveal has already played, without claiming it. */
export function hasPlayedReveal(slideId: string, signature: string): boolean {
  if (!signature) return false;
  return readSignature(slideId) === signature;
}

/**
 * Decide whether this slide should animate its reveal, recording the claim.
 *
 * Returns "settled" only when these exact standings have already been revealed
 * for this slide. Different standings — the host re-ran the question, or more
 * answers landed — animate again, because there is genuinely new movement.
 *
 * Callers must keep the result stable for the lifetime of a mount (see the ref
 * in LeaderboardViewer): React StrictMode invokes effects twice in development,
 * and re-claiming would report "settled" on the second pass, silently skipping
 * the animation.
 */
export function claimReveal(slideId: string, signature: string): RevealMode {
  if (!signature) return "settled";
  if (readSignature(slideId) === signature) return "settled";

  writeSignature(slideId, signature);
  return "animate";
}

export interface RankedRow {
  participantId: string;
  /** Position in the final standings, 1-based. */
  rank: number;
  /** Position before this question, or null for a player with no prior score. */
  prevRank: number | null;
}

/**
 * The players a leaderboard shows, chosen by FINAL rank.
 *
 * Membership must be decided once and held for the whole reveal. Slicing after
 * the reorder changed who was in the top N mid-animation, so players who dropped
 * out were unmounted while still fading — and those exiting rows kept their place
 * in the flow, briefly pushing the list past N entries. That is what produced
 * duplicated rank badges and overlapping rows.
 */
export function selectVisible<T extends RankedRow>(rows: T[], limit: number): T[] {
  return rows.slice(0, Math.max(0, limit));
}

/**
 * The same players, ordered for the current beat of the reveal.
 *
 * Returns identical membership either way — only the order differs — so the
 * reveal never mounts or unmounts a row.
 */
export function orderForDisplay<T extends RankedRow>(visible: T[], ordered: boolean): T[] {
  if (ordered) return visible;

  return [...visible].sort((a, b) => {
    // Newcomers wait at the bottom until positions move.
    if (a.prevRank === null && b.prevRank === null) return a.rank - b.rank;
    if (a.prevRank === null) return 1;
    if (b.prevRank === null) return -1;
    return a.prevRank - b.prevRank;
  });
}

/** Forget all reveals. Intended for tests. */
export function resetRevealMemory(): void {
  memory.clear();
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) doomed.push(key);
    }
    doomed.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Nothing to clear.
  }
}
