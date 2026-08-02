"use client";

import React from "react";

interface MetricsGridProps {
  totalResponses: number;
  avgPerDay: number;
}

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
