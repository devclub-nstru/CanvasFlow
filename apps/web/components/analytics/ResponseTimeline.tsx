"use client";

import React from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TrendPoint {
  date: string;
  count: number;
}

interface ResponseTimelineProps {
  totalResponses: number;
  trends: TrendPoint[];
}

export function ResponseTimeline({ totalResponses, trends }: ResponseTimelineProps) {
  const chartData = trends.map((t) => ({ name: t.date, Responses: t.count }));

  return (
    <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5 lg:col-span-2 min-h-[300px] flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Timeline</p>
          <h4 className="mt-2 cf-display text-[20px] leading-tight">Response timeline</h4>
          <p className="mt-1 text-[12px] text-[color:var(--cf-ink-soft)]">Last 30 days</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[color:var(--cf-ink-soft)]">
          <span className="size-1.5 rounded-full bg-[color:var(--cf-orange)]" />
          Responses
        </div>
      </div>

      {totalResponses === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[13px] text-[color:var(--cf-ink-soft)]">
          No responses recorded.
        </div>
      ) : (
        <div className="flex-1 w-full min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="rt-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f66f00" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#f66f00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
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
                width={28}
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
                cursor={{ stroke: "#f66f00", strokeOpacity: 0.3, strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="Responses"
                stroke="#f66f00"
                strokeWidth={2.5}
                fill="url(#rt-gradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
