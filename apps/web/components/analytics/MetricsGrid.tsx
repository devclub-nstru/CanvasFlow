"use client";

import React from "react";
import { Activity, Clock, Layers, TrendingUp } from "lucide-react";

interface MetricsGridProps {
  totalResponses: number;
  completionRate: string;
  totalViews: number;
  avgPerDay: number;
}

export function MetricsGrid({
  totalResponses,
  completionRate,
  totalViews,
  avgPerDay,
}: MetricsGridProps) {
  const stats = [
    { title: "Total responses", val: totalResponses, icon: Layers },
    { title: "Completion rate", val: completionRate, icon: TrendingUp },
    { title: "Total views", val: totalViews, icon: Clock },
    { title: "Avg / day", val: avgPerDay.toFixed(1), icon: Activity },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div
            key={idx}
            className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] hover:ring-[color:var(--cf-line-strong)] transition-shadow p-5"
          >
            <div className="flex items-start justify-between">
              <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">{stat.title}</p>
              <Icon className="size-4 text-[color:var(--cf-orange)]" />
            </div>
            <p className="mt-5 cf-display text-[36px] leading-none tabular-nums">{stat.val}</p>
          </div>
        );
      })}
    </div>
  );
}
