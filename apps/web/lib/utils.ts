import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Where to go after signing in, taken from a `?redirect=` parameter.
 *
 * Exists because a respondent sent to sign-in from a gated form has to come
 * back to *that form*, not to the dashboard. Without it the sign-in wall is a
 * dead end: they authenticate and land somewhere unrelated, with no obvious way
 * back to the thing they were asked to fill in.
 *
 * Only same-origin paths are honoured, and the check is a whitelist rather than
 * a blacklist. An unvalidated `redirect` is an open redirect — an attacker links
 * to our sign-in page with `?redirect=https://look-alike.example`, the victim
 * signs in for real, and we hand them to the impostor with our domain in the
 * referrer chain. So:
 *
 *   - must begin with a single `/`, which rules out absolute URLs entirely
 *   - `//host` and `/\host` are rejected: both are protocol-relative and would
 *     leave the origin despite starting with a slash
 *   - anything else falls back to `fallback`, never to the raw input
 */
export function safeRedirect(target: string | null | undefined, fallback = "/dashboard"): string {
  if (!target) return fallback;

  const path = target.trim();
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;

  return path;
}
