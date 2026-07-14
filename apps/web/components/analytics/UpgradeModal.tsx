"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Sparkles, Target, TrendingUp, X, Zap } from "lucide-react";

interface UpgradeModalProps {
  onClose: () => void;
}

const PRO_FEATURES = [
  { icon: BarChart3, label: "Per-question response distribution" },
  { icon: TrendingUp, label: "30 / 60 / 90 day trend comparison" },
  { icon: Target, label: "Response velocity (first 24h spike)" },
  { icon: Zap, label: "Day-of-week engagement breakdown" },
];

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[color:var(--cf-ink)]/55 backdrop-blur-sm p-4">
      <div className="bg-[color:var(--cf-cream-2)] rounded-2xl ring-1 ring-[color:var(--cf-line-strong)] max-w-md w-full overflow-hidden shadow-[0_40px_80px_-30px_rgba(22,19,17,0.4)]">
        <div className="relative px-6 pt-6 pb-5 border-b border-[color:var(--cf-line)]">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-md text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-center gap-2 text-[color:var(--cf-orange)]">
            <Sparkles className="size-4 fill-current" />
            <p className="cf-eyebrow">Pro+ feature</p>
          </div>
          <h3 className="mt-3 cf-display text-[26px] leading-tight">Detailed analytics</h3>
          <p className="mt-2 text-[13.5px] text-[color:var(--cf-ink-soft)] leading-relaxed">
            Available on Pro+ and Business plans. Unlock deeper per-question insights and engagement
            breakdowns.
          </p>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">What you&apos;ll get</p>
          {PRO_FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="size-7 rounded-md bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] flex items-center justify-center shrink-0">
                  <Icon className="size-3.5 text-[color:var(--cf-orange)]" />
                </div>
                <span className="text-[13.5px] text-[color:var(--cf-ink)]">{f.label}</span>
              </div>
            );
          })}
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium rounded-full text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] transition-colors cursor-pointer"
          >
            Later
          </button>
          <Link
            href="/dashboard/pricing"
            onClick={onClose}
            className="group inline-flex items-center gap-1.5 px-5 py-2 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white rounded-full text-[13px] font-medium tracking-tight transition-colors"
          >
            Upgrade to Pro+
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
