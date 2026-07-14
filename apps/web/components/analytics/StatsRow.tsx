"use client";

import React from "react";
import { BarChart2, Calendar, CheckCircle, RefreshCw, Zap } from "lucide-react";

interface StatsRowProps {
  peakDay: string | null;
  avgPerWeek: number;
  completionRate: number;
  velocityFirst24h?: number;
  returningRate?: number;
}

interface ChipDef {
  label: string;
  value: string;
  icon: React.ElementType;
}

export function StatsRow({
  peakDay,
  avgPerWeek,
  completionRate,
  velocityFirst24h,
  returningRate,
}: StatsRowProps) {
  const chips: ChipDef[] = [
    { label: "Peak day", value: peakDay ?? "—", icon: Calendar },
    { label: "Avg / week", value: avgPerWeek.toFixed(1), icon: BarChart2 },
    {
      label: "Completion",
      value: completionRate > 0 ? completionRate.toFixed(1) + "%" : "—",
      icon: CheckCircle,
    },
    ...(velocityFirst24h !== undefined
      ? [
          {
            label: "Launch velocity",
            value: velocityFirst24h.toLocaleString(),
            icon: Zap,
          },
        ]
      : []),
    ...(returningRate !== undefined
      ? [
          {
            label: "Returning",
            value: returningRate > 0 ? returningRate.toFixed(1) + "%" : "—",
            icon: RefreshCw,
          },
        ]
      : []),
  ];

  return (
    <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] px-4 py-3">
      <div className="flex flex-wrap gap-2.5 items-center">
        {chips.map((chip, idx) => {
          const Icon = chip.icon;
          return (
            <div
              key={idx}
              className="flex items-center gap-2 bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] px-3 py-1.5 rounded-full"
            >
              <Icon className="size-3 text-[color:var(--cf-orange)] shrink-0" />
              <span className="cf-eyebrow text-[color:var(--cf-ink-soft)]">{chip.label}</span>
              <span className="text-[13px] font-medium text-[color:var(--cf-ink)] tabular-nums">
                {chip.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
