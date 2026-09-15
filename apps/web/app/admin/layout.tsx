"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { isAdminRole, useGetLoggedInUserInfo } from "~/hooks/api/auth";

/* The role gate for everything under /admin.
 *
 * There is no admin sign-in. The middleware already sent anyone with no
 * session at all to the ordinary /signIn (carrying ?redirect=/admin, which
 * survives the OAuth round trip, so a Google or GitHub account can be an admin
 * too). What the middleware could not do is tell an admin from an ordinary
 * signed-in user, because the role lives behind an API call. That is decided
 * here, against the role the server reads fresh from `users` on every session
 * check — so a revoked admin loses this page on their next navigation. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { userInfo, isPending } = useGetLoggedInUserInfo();

  const allowed = isAdminRole(userInfo?.role);
  const signedIn = !!userInfo;

  React.useEffect(() => {
    /* Signed in but not an admin: send them back to their own dashboard.
     * Bouncing them to a sign-in screen would be a lie — there is nothing
     * wrong with their session, they simply are not an admin. */
    if (!isPending && signedIn && !allowed) router.replace("/dashboard");
  }, [isPending, signedIn, allowed, router]);

  if (isPending) return <AdminShell>{null}</AdminShell>;

  /* Render the refusal rather than admin chrome. Flashing the panel at someone
   * about to be redirected out of it is a small leak, but it is a leak. */
  if (!allowed) {
    return (
      <AdminShell>
        <p
          className="hex-mono mb-4 text-[11px] font-bold tracking-[0.2em] uppercase"
          style={{ color: "var(--hex-ink-muted)" }}
        >
          Restricted
        </p>
        <h2 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.03em]">
          Not an admin
          <span style={{ color: "var(--c-blue)" }}>.</span>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
          This account doesn&apos;t have admin access.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold underline underline-offset-2"
        >
          <ArrowLeft className="size-4" />
          Back to your dashboard
        </Link>
      </AdminShell>
    );
  }

  return <AdminShell role={userInfo?.role}>{children}</AdminShell>;
}

function AdminShell({ children, role }: { children: React.ReactNode; role?: string }) {
  return (
    <div className="hex-theme hex-paper relative flex min-h-screen flex-col font-sans">
      <nav
        className="relative z-10 border-b hex-line-soft"
        style={{ borderBottomWidth: 1, background: "var(--hex-nav)" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-10">
          <Link href="/dashboard" className="text-[15px] font-bold tracking-[-0.04em]">
            CanvasFlow
          </Link>
          <p
            className="hex-mono text-[10px] tracking-[0.18em] uppercase"
            style={{ color: "var(--hex-ink-muted)" }}
          >
            {role ?? "Admin"}
          </p>
        </div>
      </nav>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-10">
        <div className="flex w-full max-w-125 flex-col">{children}</div>
      </div>
    </div>
  );
}
