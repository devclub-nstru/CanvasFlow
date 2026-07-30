"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Compass,
  LogOut,
  Menu,
  PencilRuler,
  Plus,
  Wallet,
  X,
} from "lucide-react";

import { useDashboard } from "~/providers/dashboard-provider";
import { useGetLoggedInUserInfo, useSignOut } from "~/hooks/api/auth";

/**
 * Dashboard top navigation.
 *
 * Replaces the previous fixed sidebar. The reference puts the whole app on a
 * single centred column under one horizontal bar, which gives the forms grid
 * the full page width instead of surrendering 256px of it to a rail that only
 * ever held four links.
 */

const LINKS = [
  { href: "/dashboard", label: "Studio", icon: Compass },
  { href: "/dashboard/sketches", label: "Forms", icon: PencilRuler },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/pricing", label: "Pricing", icon: Wallet },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const { openCreateFormModal } = useDashboard();
  const { userInfo } = useGetLoggedInUserInfo();
  const { signOutAsync } = useSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = async () => {
    await signOutAsync();
    window.location.href = "/";
  };

  const fullName = userInfo?.fullName ?? "";
  const email = userInfo?.email ?? "";
  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Slim black rule across the very top — the printed edge of the sheet,
          and what visually separates the app from the browser chrome. */}
      <div aria-hidden className="h-2 w-full" style={{ background: "var(--cf-ink)" }} />

      {/* The bar itself is near-white rather than the page grey. In the
          reference it reads as a separate strip laid over the sheet, and
          matching the page tone would lose that edge. */}
      <nav
        className="sticky top-0 z-40 border-b"
        style={{
          borderBottomColor: "var(--cf-line-strong)",
          background: "#fafafa",
        }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <Image src="/logo.svg" alt="" width={24} height={24} className="object-contain" />
            <span className="cf-display text-[18px] leading-none">CanvasFlow</span>
          </Link>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 lg:flex">
            {LINKS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="cf-btn-outline h-8 gap-1.5 px-3 text-[10px] font-bold tracking-[0.16em] uppercase"
                  style={
                    active
                      ? { background: "var(--cf-ink)", color: "var(--cf-cream)" }
                      : undefined
                  }
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}

            <button
              onClick={openCreateFormModal}
              className="cf-btn cf-raised cf-press ml-1 h-8 px-4 text-[11px] font-semibold tracking-[0.02em]"
            >
              <Plus className="size-4" />
              New form
            </button>

            <div
              className="ml-1 flex size-8 shrink-0 items-center justify-center border text-[10px] font-semibold"
              style={{
                borderColor: "var(--cf-line-strong)",
                background: "var(--cf-ink)",
                color: "var(--cf-cream)",
              }}
              title={email}
            >
              {initials}
            </div>

            <button
              onClick={() => setConfirmLogout(true)}
              aria-label="Log out"
              className="cf-btn-outline size-8 shrink-0"
            >
              <LogOut className="size-4" />
            </button>
          </div>

          {/* Mobile: the primary action stays reachable, everything else folds
              into the panel. */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={openCreateFormModal}
              className="cf-btn h-8 px-3 text-[11px]"
              aria-label="New form"
            >
              <Plus className="size-4" />
            </button>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="dashboard-nav-panel"
              className="cf-btn-outline size-8"
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="dashboard-nav-panel"
            className="border-t lg:hidden"
            style={{ borderTopColor: "var(--cf-line-strong)", background: "var(--cf-cream-2)" }}
          >
            <div className="space-y-2 px-4 py-4">
              {LINKS.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className="cf-btn-outline h-10 w-full justify-start gap-2.5 px-3 text-[11px] font-bold tracking-[0.14em] uppercase"
                    style={
                      active ? { background: "var(--cf-ink)", color: "var(--cf-cream)" } : undefined
                    }
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}

              <div
                className="mt-4 flex items-center justify-between border-t pt-4"
                style={{ borderTopColor: "var(--cf-line)" }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center border text-[11px] font-medium"
                    style={{
                      borderColor: "var(--cf-line-strong)",
                      background: "var(--cf-ink)",
                      color: "var(--cf-cream)",
                    }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{fullName}</p>
                    <p
                      className="truncate text-[11px]"
                      style={{ color: "var(--cf-ink-soft)" }}
                    >
                      {email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmLogout(true);
                  }}
                  aria-label="Log out"
                  className="cf-btn-outline size-8 shrink-0"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {confirmLogout && (
        <div className="cf-scrim z-[100]">
          <div className="cf-dark cf-crop w-full max-w-md">
            <div className="relative z-[1] p-6 sm:p-8">
              <p className="cf-dark-meta">Session</p>
              <h3 className="cf-display mt-3 text-[26px] leading-none uppercase sm:text-[32px]">
                Log out
                <span style={{ color: "var(--cf-orange)" }}>.</span>
              </h3>
              <p
                className="mt-3 mb-7 text-[13.5px] leading-relaxed"
                style={{ color: "var(--cfd-text-soft)" }}
              >
                You&apos;ll be signed out of CanvasFlow.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmLogout(false)}
                  className="cf-dark-btn-outline px-4 py-2 text-[13px]"
                >
                  Cancel
                </button>
                <button onClick={handleLogout} className="cf-btn px-5 py-2 text-[13px]">
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
