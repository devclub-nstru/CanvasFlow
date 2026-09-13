/* Redirect targets, shared by the browser helper (`apps/web/lib/utils.ts`)
 * and the server helper (`packages/trpc/server/auth.ts`). Both reduce an
 * attacker-controlled `?redirect=` to something safe; an entry that one accepts
 * and the other rejects is a bug in whichever is more permissive. */

export const safeRelativePaths: string[] = [
  "/dashboard",
  "/forms/abc123",
  "/forms/abc?tab=responses",
  "/forms/abc#section",
  "/",
  "  /dashboard  ",
];

export const openRedirectAttempts: string[] = [
  "https://evil.test",
  "http://evil.test/path",
  "//evil.test",
  "//evil.test/path",
  "/\\evil.test",
  "\\\\evil.test",
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "dashboard",
  "../admin",
  " https://evil.test",
];
