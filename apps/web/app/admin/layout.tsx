"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";

import { isAdminRole, useGetLoggedInUserInfo } from "~/hooks/api/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { userInfo, isPending } = useGetLoggedInUserInfo();

  const allowed = isAdminRole(userInfo?.role);
  const signedIn = !!userInfo;

  React.useEffect(() => {
    if (!isPending && signedIn && !allowed) router.replace("/dashboard");
  }, [isPending, signedIn, allowed, router]);

  if (isPending) {
    return (
      <AdminShell>
        <p className="cf-meta opacity-50">Checking access…</p>
      </AdminShell>
    );
  }

  if (!allowed) {
    return (
      <AdminShell>
        <div className="max-w-125">
          <p className="cf-meta">Restricted</p>
          <h1 className="cf-display mt-4 text-[32px] leading-none">
            Not an admin
            <span style={{ color: "var(--cf-orange)" }}>.</span>
          </h1>
          <p className="mt-3 text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
            This account doesn&apos;t have admin access.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold underline underline-offset-2"
          >
            <ArrowLeft className="size-4" />
            Back to your dashboard
          </Link>
        </div>
      </AdminShell>
    );
  }

  return <AdminShell role={userInfo?.role}>{children}</AdminShell>;
}

function AdminShell({ children, role }: { children: React.ReactNode; role?: string }) {
  return (
    <div className="relative flex min-h-screen flex-col font-sans">
      <nav
        className="sticky top-0 z-40 border-b"
        style={{ borderBottomColor: "var(--cf-line-strong)", background: "#fafafa" }}
      >
        <div className="mx-auto flex max-w-350 items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Shield className="size-4" style={{ color: "var(--cf-orange)" }} />
            <span className="cf-display text-[18px] leading-none">Admin</span>
            {role && (
              <span className="cf-meta hidden sm:inline" style={{ color: "var(--cf-ink-soft)" }}>
                {role}
              </span>
            )}
          </div>

          <Link
            href="/dashboard"
            className="cf-btn-outline h-8 gap-1.5 px-3 text-[10px] font-bold tracking-[0.16em] uppercase"
          >
            <ArrowLeft className="size-3.5" />
            Dashboard
          </Link>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-350 flex-1 px-4 py-8 sm:px-8">{children}</div>
    </div>
  );
}
