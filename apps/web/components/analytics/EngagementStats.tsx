"use client";

import React from "react";
import { Repeat, Timer, TrendingUp, Zap } from "lucide-react";

import { SERIES } from "./palette";

interface EngagementStatsProps {
  avgTimeSpentMs: number | null;
  medianResponseTime: number | null;
  returningRate: number;
  velocityFirst24h: number;
}

const formatDuration = (ms: number | null) => {
  if (ms == null || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
};

const formatLag = (minutes: number | null) => {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = minutes / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
};

/**
 * Four engagement figures the Pro payload already returned but nothing rendered
 * after the standalone detailed page was removed.
 */
export function EngagementStats({
  avgTimeSpentMs,
  medianResponseTime,
  returningRate,
  velocityFirst24h,
}: EngagementStatsProps) {
  const stats = [
    {
      label: "Avg time to complete",
      value: formatDuration(avgTimeSpentMs),
      hint: "from open to submit",
      icon: Timer,
      colour: SERIES[0],
    },
    {
      label: "First 24h",
      value: velocityFirst24h.toLocaleString(),
      hint: "responses just after publish",
      icon: Zap,
      colour: SERIES[1],
    },
    {
      label: "Median lag",
      value: formatLag(medianResponseTime),
      hint: "publish to typical response",
      icon: TrendingUp,
      colour: SERIES[2],
    },
    {
      label: "Returning",
      value: `${returningRate}%`,
      hint: "repeat respondents (est.)",
      icon: Repeat,
      colour: SERIES[3],
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="cf-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="cf-meta">{s.label}</p>
              <Icon className="size-4 shrink-0" style={{ color: s.colour }} />
            </div>
            <p className="cf-display mt-3 text-[22px] leading-none tabular-nums sm:text-[26px]">
              {s.value}
            </p>
            <p
              className="mt-1.5 font-mono text-[10px] leading-snug"
              style={{ color: "var(--cf-ink-soft)" }}
            >
              {s.hint}
            </p>
          </div>
        );
      })}
    </div>
  );
}
