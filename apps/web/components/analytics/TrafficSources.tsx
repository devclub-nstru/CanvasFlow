"use client";

import React from "react";
import { Globe } from "lucide-react";

import { seriesColor } from "./palette";

interface TrafficSourcesProps {
  topReferrers: Array<{ referrer: string; count: number }>;
}

export function TrafficSources({ topReferrers }: TrafficSourcesProps) {
  const max = Math.max(...topReferrers.map((r) => r.count), 1);
  const total = topReferrers.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="cf-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <Globe className="size-4" style={{ color: "var(--cf-orange)" }} />
            <p className="cf-meta">Referrers</p>
          </div>
          <h4 className="cf-display text-[18px] leading-tight">Where responses came from</h4>
        </div>
        {total > 0 && (
          <div className="shrink-0 text-right">
            <p className="cf-display text-[20px] leading-none tabular-nums">
              {total.toLocaleString()}
            </p>
            <p className="cf-meta mt-1">attributed</p>
          </div>
        )}
      </div>

      {topReferrers.length === 0 ? (
        <p className="mt-5 text-[13px] leading-relaxed" style={{ color: "var(--cf-ink-soft)" }}>
          No referrer data yet. Attribution is recorded when someone opens the form from a link.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {topReferrers.map((r, i) => {
            const barPct = (r.count / max) * 100;
            const sharePct = total > 0 ? (r.count / total) * 100 : 0;
            return (
              <div key={r.referrer} className="flex items-center gap-3">
                <span
                  className="cf-meta w-5 shrink-0 tabular-nums"
                  style={{ color: "var(--cf-ink-muted)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[12.5px]" title={r.referrer}>
                      {r.referrer}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums">
                      {r.count.toLocaleString()}
                      <span className="ml-1.5" style={{ color: "var(--cf-ink-soft)" }}>
                        {sharePct.toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-2 overflow-hidden"
                    style={{ background: "var(--cf-line)" }}
                  >
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${barPct}%`, background: seriesColor(i) }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
