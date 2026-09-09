import { safeRedirect } from "~/lib/utils";

const STORAGE_KEY = "cf.pendingSignup";

export const RESEND_COOLDOWN_SECONDS = 60;

export interface PendingSignup {
  email: string;
  redirect: string;
}

export function writePendingSignup(email: string, redirect: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email, redirect }));
  } catch {
    /* Private browsing, or storage disabled. The confirmation screen handles a
     * missing handover by asking the person to start again, which is a far
     * better outcome than throwing here and losing the sign-up entirely. */
  }
}

export function readPendingSignup(): PendingSignup | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { email, redirect } = parsed as Record<string, unknown>;
    if (typeof email !== "string" || !email) return null;
    return { email, redirect: safeRedirect(typeof redirect === "string" ? redirect : null) };
  } catch {
    return null;
  }
}

export function clearPendingSignup(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Nothing to clean up if storage is unavailable. */
  }
}
