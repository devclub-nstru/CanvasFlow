"use client";

import React from "react";
import { Globe, Tag } from "lucide-react";

interface TrafficSourcesProps {
  topReferrers: Array<{ referrer: string; count: number }>;
  utmSources: Array<{ source: string; count: number }>;
}

function SourceBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[12px] gap-3">
        <span className="text-[color:var(--cf-ink)] truncate">{label}</span>
        <span className="font-mono text-[color:var(--cf-ink-soft)] tabular-nums shrink-0">
          {count}
        </span>
      </div>
      <div className="h-1.5 bg-[color:var(--cf-cream)] rounded-full overflow-hidden ring-1 ring-[color:var(--cf-line)]">
        <div
          className="h-full rounded-full bg-[color:var(--cf-orange)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function TrafficSources({ topReferrers, utmSources }: TrafficSourcesProps) {
  const refMax = Math.max(...topReferrers.map((r) => r.count), 1);
  const utmMax = Math.max(...utmSources.map((u) => u.count), 1);
  const hasReferrers = topReferrers.length > 0;
  const hasUtm = utmSources.length > 0;

  if (!hasReferrers && !hasUtm) {
    return (
      <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5">
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Traffic</p>
        <h4 className="mt-2 cf-display text-[20px] leading-tight">Traffic sources</h4>
        <p className="mt-2 text-[13px] text-[color:var(--cf-ink-soft)] leading-relaxed">
          No referrer data yet. Attribution is collected when visitors open the form via a link.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {hasReferrers && (
        <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="size-4 text-[color:var(--cf-orange)]" />
            <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Referrers</p>
          </div>
          <h4 className="cf-display text-[20px] leading-tight">Top referrers</h4>
          <div className="mt-5 space-y-3">
            {topReferrers.map((r, i) => (
              <SourceBar key={i} label={r.referrer} count={r.count} max={refMax} />
            ))}
          </div>
        </div>
      )}

      {hasUtm && (
        <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5">
          <div className="flex items-center gap-2 mb-1">
            <Tag className="size-4 text-[color:var(--cf-orange)]" />
            <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Campaigns</p>
          </div>
          <h4 className="cf-display text-[20px] leading-tight">UTM sources</h4>
          <div className="mt-5 space-y-3">
            {utmSources.map((u, i) => (
              <SourceBar key={i} label={u.source} count={u.count} max={utmMax} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
