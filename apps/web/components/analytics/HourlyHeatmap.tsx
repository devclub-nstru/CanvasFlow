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

interface HourlyDistributionPoint {
  hour: number;
  count: number;
}

interface HourlyHeatmapProps {
  hourlyDistribution: HourlyDistributionPoint[];
  peakHour: number | null;
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 6) return "6a";
  if (hour === 12) return "12p";
  if (hour === 18) return "6p";
  return "";
}

export function HourlyHeatmap({ hourlyDistribution, peakHour }: HourlyHeatmapProps) {
  const distributionMap = new Map(hourlyDistribution.map((d) => [d.hour, d.count]));
  const chartData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: distributionMap.get(i) ?? 0,
  }));
  const totalCount = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5 min-h-[280px] flex flex-col">
      <div>
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Hours</p>
        <h4 className="mt-2 cf-display text-[20px] leading-tight">Submission hours</h4>
        <p className="mt-1 text-[12px] text-[color:var(--cf-ink-soft)]">
          When your audience responds
        </p>
      </div>

      {totalCount === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[13px] text-[color:var(--cf-ink-soft)]">
          No submissions recorded.
        </div>
      ) : (
        <div className="flex-1 w-full min-h-[200px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barCategoryGap="10%"
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="hour"
                stroke="#56504a"
                opacity={0.5}
                tick={{ fontSize: 10 }}
                tickFormatter={formatHourLabel}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#56504a"
                opacity={0.5}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={24}
              />
              <ChartTooltip
                formatter={(value: number, _name: string, props: any) => {
                  const hour = props.payload?.hour as number;
                  const label =
                    hour === 0
                      ? "12am"
                      : hour < 12
                        ? `${hour}am`
                        : hour === 12
                          ? "12pm"
                          : `${hour - 12}pm`;
                  return [value, label];
                }}
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
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {chartData.map((entry) => {
                  const isPeak = peakHour !== null && entry.hour === peakHour;
                  return (
                    <Cell
                      key={`cell-${entry.hour}`}
                      fill="#f66f00"
                      fillOpacity={isPeak ? 1 : 0.4}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
