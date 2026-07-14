"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Plus, Compass, PencilRuler, BarChart3, X, Wallet, LogOut } from "lucide-react";

import { useDashboard } from "~/providers/dashboard-provider";
import { useGetLoggedInUserInfo, useSignOut } from "~/hooks/api/auth";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const LINKS = [
  { href: "/dashboard", label: "Studio", icon: Compass },
  { href: "/dashboard/sketches", label: "My forms", icon: PencilRuler },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/pricing", label: "Pricing", icon: Wallet },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { openCreateFormModal } = useDashboard();
  const { userInfo } = useGetLoggedInUserInfo();
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const { signOutAsync } = useSignOut();

  const handleLogout = async () => {
    await signOutAsync();
    window.location.href = "/";
  };

  const isUserLoading = !userInfo;
  const fullName = userInfo?.fullName || "";
  const email = userInfo?.email || "";
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-screen bg-[color:var(--cf-cream-2)] border-r border-[color:var(--cf-line)] flex flex-col justify-between p-6 transform transition-transform duration-300 md:translate-x-0 md:sticky md:top-0 overflow-hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-8">
          {/* brand */}
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
              <Image src="/logo.svg" alt="" width={28} height={28} className="object-contain" />
              <span className="cf-display text-[20px] leading-none text-[color:var(--cf-ink)]">
                CanvasFlow
              </span>
            </Link>
            <button
              className="md:hidden p-1 text-[color:var(--cf-ink)]"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* primary CTA */}
          <button
            onClick={openCreateFormModal}
            className="w-full inline-flex items-center justify-center gap-1.5 h-[42px] px-5 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white rounded-full text-[13px] font-medium tracking-tight transition-colors"
          >
            <Plus className="size-4" />
            New form
          </button>

          {/* nav */}
          <nav className="space-y-0.5">
            <p className="cf-eyebrow text-[color:var(--cf-ink-soft)] px-3 mb-2">Workspace</p>
            {LINKS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2 text-[13.5px] rounded-md transition-colors ${
                    isActive
                      ? "bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] ring-1 ring-[color:var(--cf-line-strong)]"
                      : "text-[color:var(--cf-ink-soft)] hover:bg-[color:var(--cf-cream)]/60 hover:text-[color:var(--cf-ink)]"
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[color:var(--cf-orange)]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* user */}
        <div className="border-t border-[color:var(--cf-line)] pt-4 mt-auto">
          <div className="flex items-center justify-between p-2 rounded-md hover:bg-[color:var(--cf-cream)]/60 transition-colors">
            <div className="flex items-center gap-3 overflow-hidden">
              {isUserLoading ? (
                <>
                  <div className="w-9 h-9 rounded-full bg-[color:var(--cf-line-strong)] animate-pulse shrink-0" />
                  <div className="space-y-1.5 overflow-hidden">
                    <div className="h-3 w-24 bg-[color:var(--cf-line-strong)] rounded animate-pulse" />
                    <div className="h-2.5 w-32 bg-[color:var(--cf-line)] rounded animate-pulse" />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full bg-[color:var(--cf-ink)] text-white flex items-center justify-center text-[12px] font-medium shrink-0">
                    {initials || "?"}
                  </div>
                  <div className="text-left overflow-hidden">
                    <p className="text-[13px] font-medium truncate text-[color:var(--cf-ink)]">
                      {fullName}
                    </p>
                    <p className="text-[11px] text-[color:var(--cf-ink-soft)] truncate">{email}</p>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowConfirmLogout(true)}
              title="Log out"
              className="p-1.5 rounded-md hover:bg-[color:var(--cf-orange)]/10 text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-orange)] transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* logout confirm */}
      {showConfirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[color:var(--cf-ink)]/45 backdrop-blur-sm p-4">
          <div className="bg-[color:var(--cf-cream-2)] rounded-2xl ring-1 ring-[color:var(--cf-line-strong)] p-6 max-w-sm w-full shadow-[0_30px_80px_-30px_rgba(22,19,17,0.35)]">
            <h3 className="cf-display text-[22px] leading-snug text-[color:var(--cf-ink)] mb-2">
              Log out?
            </h3>
            <p className="text-[13.5px] text-[color:var(--cf-ink-soft)] mb-6 leading-relaxed">
              You&apos;ll be signed out of your CanvasFlow studio.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmLogout(false)}
                className="px-4 py-2 text-[13px] font-medium rounded-full text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream-2)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-5 py-2 text-[13px] font-medium rounded-full bg-[color:var(--cf-ink)] hover:bg-black text-white transition-colors cursor-pointer"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
