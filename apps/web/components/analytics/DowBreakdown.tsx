"use client";

import React from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DowBreakdownProps {
  dowBreakdown: Array<{ day: string; count: number }>;
}

export function DowBreakdown({ dowBreakdown }: DowBreakdownProps) {
  const max = Math.max(...dowBreakdown.map((d) => d.count), 1);

  return (
    <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5 min-h-[260px] flex flex-col">
      <div>
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Cadence</p>
        <h4 className="mt-2 cf-display text-[20px] leading-tight">Day of week</h4>
        <p className="mt-1 text-[12px] text-[color:var(--cf-ink-soft)]">When do people respond?</p>
      </div>
      <div className="flex-1 w-full min-h-[160px] mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dowBreakdown} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="day"
              stroke="#56504a"
              opacity={0.5}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#56504a"
              opacity={0.5}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={24}
            />
            <ChartTooltip
              contentStyle={{
                background: "var(--cf-cream)",
                border: "1px solid rgba(22,19,17,0.14)",
                borderRadius: "8px",
                color: "#161311",
                fontSize: 12,
                boxShadow: "0 10px 30px -12px rgba(22,19,17,0.18)",
              }}
              cursor={{ fill: "rgba(246,111,0,0.08)" }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {dowBreakdown.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.count === max && max > 0 ? "#f66f00" : "#f66f00"}
                  fillOpacity={entry.count === max && max > 0 ? 1 : 0.45}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
