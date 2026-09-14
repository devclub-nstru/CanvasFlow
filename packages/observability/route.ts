/* Turning a request path into a bounded label.
 *
 * `/api/forms/9f3c…/submit` must become `/api/forms/:id/submit`, or every form
 * that has ever been submitted becomes its own permanent time series. The
 * substitutions below are deliberately aggressive: a wrong label is a cosmetic
 * problem, an unbounded one is an operational one.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^[0-9a-f]{16,}$/i;
const DIGITS = /^\d+$/;
/* nanoid/cuid/ULID-style keys. Two signatures rather than one, because the
 * obvious rule — "long and contains a digit" — also matches real route words
 * like `oauth2-callback`, and a mislabelled route is a panel that silently
 * measures the wrong thing.
 *
 * MIXED: a digit plus both cases, which generated keys have and slugs do not.
 * LONG:  a digit and long enough that no route word plausibly reaches it. */
const MIXED = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[A-Za-z0-9_-]{10,}$/;
const LONG = /^(?=.*\d)[A-Za-z0-9_-]{20,}$/;

function isIdentifier(segment: string): boolean {
  return (
    UUID.test(segment) ||
    HEX.test(segment) ||
    DIGITS.test(segment) ||
    MIXED.test(segment) ||
    LONG.test(segment)
  );
}

/* Beyond this many distinct templates we stop inventing new ones. Normalising
 * should keep us far below it; the cap exists so that a path shape nobody
 * anticipated cannot grow the series count without limit. */
const MAX_ROUTES = 120;
const seen = new Set<string>();

export function normalizeRoute(rawPath: string): string {
  const path = (rawPath.split("?")[0] ?? "/").replace(/\/+$/, "") || "/";

  /* tRPC carries the procedure in the path, which is already the perfect
   * label — low cardinality and named the way the code is. Batched calls
   * arrive comma-separated, and every subset of procedures the client happens
   * to batch would be a distinct value, so they collapse to one. */
  if (path.startsWith("/trpc/")) {
    const procedure = path.slice("/trpc/".length);
    if (!procedure) return "/trpc";
    if (procedure.includes(",")) return "/trpc/:batch";
    return `/trpc/${procedure}`;
  }

  const segments = path.split("/").filter(Boolean).slice(0, 8);
  const template = `/${segments.map((s) => (isIdentifier(s) ? ":id" : s)).join("/")}`;

  if (seen.has(template)) return template;
  if (seen.size >= MAX_ROUTES) return "/other";

  seen.add(template);
  return template;
}

/** Test seam — the cap is process-wide state. */
export function resetRouteCache(): void {
  seen.clear();
}

export function statusClass(status: number): string {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  if (status >= 200) return "2xx";
  return "1xx";
}
