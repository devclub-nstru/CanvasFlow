"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronRight, Compass, Menu, PencilRuler, Plus, Presentation, X } from "lucide-react";

import { useDashboard } from "~/providers/dashboard-provider";
import { useGetLoggedInUserInfo } from "~/hooks/api/auth";
import { useGetMe } from "~/hooks/api/user";
import { avatarSeed, GlyphAvatar, resolvePreset } from "~/components/profile/GlyphAvatar";

const LINKS = [
  { href: "/dashboard", label: "Studio", icon: Compass },
  { href: "/dashboard/sketches", label: "Forms", icon: PencilRuler },
  { href: "/dashboard/menti", label: "Menti", icon: Presentation },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const { openCreateFormModal } = useDashboard();
  const { userInfo } = useGetLoggedInUserInfo();
  const { me } = useGetMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasScrim, setHasScrim] = useState(false);

  useEffect(() => {
    const checkScrim = () => {
      setHasScrim(!!document.querySelector(".cf-scrim"));
    };

    checkScrim();

    const observer = new MutationObserver(checkScrim);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  const fullName = me?.name || userInfo?.fullName || "";
  const email = me?.email || userInfo?.email || "";

  const seed = avatarSeed(me ?? userInfo);
  const avatarPreset = resolvePreset(me?.image, seed);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  if (hasScrim) return null;

  return (
    <>
      <div aria-hidden className="h-2 w-full" style={{ background: "var(--cf-ink)" }} />
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
                    active ? { background: "var(--cf-ink)", color: "var(--cf-cream)" } : undefined
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

              <div className="mt-4 border-t pt-4" style={{ borderTopColor: "var(--cf-line)" }}>
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
                    <p className="truncate text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
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
