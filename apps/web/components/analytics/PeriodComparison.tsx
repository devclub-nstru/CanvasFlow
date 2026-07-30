"use client";

import React from "react";

import { SERIES } from "./palette";

interface PeriodComparisonProps {
  trend30d: number;
  trend60d: number;
  trend90d: number;
}

/**
 * Responses per 30-day window over the last quarter.
 *
 * The server returns cumulative totals (`trend60d` includes the last 30 days),
 * so the older buckets are differences. Charting the cumulative figures
 * directly would show three bars that can only ever grow, which reads as
 * upward momentum even for a form whose traffic is collapsing.
 */
export function PeriodComparison({ trend30d, trend60d, trend90d }: PeriodComparisonProps) {
  const buckets = [
    { label: "Last 30d", value: trend30d, colour: SERIES[0] },
    { label: "31–60d", value: Math.max(trend60d - trend30d, 0), colour: SERIES[1] },
    { label: "61–90d", value: Math.max(trend90d - trend60d, 0), colour: SERIES[3] },
  ];

  const max = Math.max(...buckets.map((b) => b.value), 1);
  const previous = buckets[1]!.value;
  const delta = previous > 0 ? ((trend30d - previous) / previous) * 100 : null;

  return (
    <div className="cf-panel flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="cf-meta">Momentum</p>
          <h4 className="cf-display mt-2 text-[18px] leading-tight">Last 90 days</h4>
        </div>
        {delta !== null && (
          <span
            className="shrink-0 font-mono text-[11px] tabular-nums"
            style={{ color: delta >= 0 ? SERIES[1] : SERIES[5] }}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% vs prior 30d
          </span>
        )}
      </div>

      {/* Column chart, drawn with divs — three bars do not justify pulling
          recharts into this panel. */}
      <div className="mt-6 flex flex-1 items-end gap-4">
        {buckets.map((b) => (
          <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="font-mono text-[12px] tabular-nums">{b.value.toLocaleString()}</span>
            <div
              className="w-full"
              style={{
                height: `${Math.max((b.value / max) * 120, 3)}px`,
                background: b.colour,
              }}
            />
            <span
              className="w-full truncate text-center font-mono text-[10px]"
              style={{ color: "var(--cf-ink-soft)" }}
            >
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
