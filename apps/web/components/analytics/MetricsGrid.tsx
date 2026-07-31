"use client";

import React from "react";

interface MetricsGridProps {
  totalResponses: number;
  avgPerDay: number;
}

/**
 * KPI row, laid out like the analytics mock: a large figure, its label, and a
 * mono supporting line.
 *
 * The supporting line carries a real derived number rather than a
 * "↑ 9.7% vs last week" style delta — the free-tier analytics payload has no
 * previous-period figures to compare against, and inventing one would be
 * worse than omitting it.
 *
 * This row used to also show total views and a completion rate. Both were
 * derived from page-view tracking, which no longer exists — peak day and
 * weekly average live in StatsRow, so they're not repeated here.
 */
export function MetricsGrid({ totalResponses, avgPerDay }: MetricsGridProps) {
  const stats = [
    {
      title: "Total responses",
      val: totalResponses.toLocaleString(),
      sub: `${avgPerDay.toFixed(1)} per day on average`,
    },
    {
      title: "Avg / day",
      val: avgPerDay.toFixed(1),
      sub: "Across the last 30 days",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <div key={stat.title} className="cf-panel p-3 sm:p-4">
          <p className="cf-display text-[24px] leading-none tabular-nums sm:text-[32px]">
            {stat.val}
          </p>
          <p className="mt-2 text-[12px] sm:text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
            {stat.title}
          </p>
          <p
            className="mt-1.5 hidden font-mono text-[10px] leading-snug sm:block"
            style={{ color: "var(--cf-orange)" }}
          >
            {stat.sub}
          </p>
        </div>
      ))}
    </div>
  );
}
