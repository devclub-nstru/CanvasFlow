"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronRight,
  Compass,
  Menu,
  PencilRuler,
  Plus,
  Wallet,
  X,
} from "lucide-react";

import { useDashboard } from "~/providers/dashboard-provider";
import { useGetLoggedInUserInfo } from "~/hooks/api/auth";
import { useGetMe } from "~/hooks/api/user";
import { avatarSeed, GlyphAvatar, resolvePreset } from "~/components/profile/GlyphAvatar";

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
  // The avatar preset lives on the user row, which the better-auth session
  // doesn't carry. Cached for 5 minutes and shared with the profile page
  // through the react-query cache, so this is not a second network trip.
  const { me } = useGetMe();
  const [menuOpen, setMenuOpen] = useState(false);

  // `getMe` reads the user row and wins where the two disagree: the session's
  // `name` is blank for social sign-ups, and it never reflects a rename made on
  // the profile page until the session is refreshed.
  const fullName = me?.name || userInfo?.fullName || "";
  const email = me?.email || userInfo?.email || "";

  const seed = avatarSeed(me ?? userInfo);
  const avatarPreset = resolvePreset(me?.image, seed);

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
        <div className="mx-auto flex max-w-350 items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
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

            {/* Way into the profile, carrying the same generated mark the
                profile page shows. Initials were the obvious thing here, but
                the session's `name` comes back empty for social sign-ups,
                which left this rendering a bare "?".

                The avatar draws its own edge, so the wrapper contributes only
                the active-state ring. */}
            <Link
              href="/dashboard/profile"
              aria-label="Your profile"
              aria-current={isActive("/dashboard/profile") ? "page" : undefined}
              className="ml-1 flex shrink-0 transition-opacity hover:opacity-80"
              style={
                isActive("/dashboard/profile")
                  ? { outline: "2px solid var(--cf-orange)", outlineOffset: 1 }
                  : undefined
              }
              title={email ? `Your profile — ${email}` : "Your profile"}
            >
              <GlyphAvatar seed={seed} preset={avatarPreset} size={32} />
            </Link>
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

              {/* Signing out lives on the profile page now, so this row is
                  purely the way there — full width, no trailing action. */}
              <div
                className="mt-4 border-t pt-4"
                style={{ borderTopColor: "var(--cf-line)" }}
              >
                <Link
                  href="/dashboard/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full min-w-0 items-center gap-3"
                >
                  <div className="shrink-0">
                    <GlyphAvatar seed={seed} preset={avatarPreset} size={36} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{fullName}</p>
                    <p
                      className="truncate text-[11px]"
                      style={{ color: "var(--cf-ink-soft)" }}
                    >
                      {email}
                    </p>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0"
                    style={{ color: "var(--cf-ink-soft)" }}
                    aria-hidden
                  />
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
