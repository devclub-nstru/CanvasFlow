"use client";

import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

interface DeviceData {
  name: string;
  value: number;
  color: string;
}

interface DeviceBreakdownProps {
  totalViews: number;
  deviceData: DeviceData[];
}

export function DeviceBreakdown({ totalViews, deviceData }: DeviceBreakdownProps) {
  return (
    <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5 min-h-[300px] flex flex-col">
      <div>
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Devices</p>
        <h4 className="mt-2 cf-display text-[20px] leading-tight">Device breakdown</h4>
        <p className="mt-1 text-[12px] text-[color:var(--cf-ink-soft)]">From page views</p>
      </div>

      {totalViews === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[13px] text-[color:var(--cf-ink-soft)]">
          No responses recorded.
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center items-center gap-4 mt-4">
          <div className="size-28 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={48}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {deviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
              <span className="cf-display text-[20px] leading-none">{totalViews}</span>
              <span className="cf-eyebrow text-[color:var(--cf-ink-soft)] mt-1 text-[9px]">
                total
              </span>
            </div>
          </div>

          <div className="w-full space-y-1.5">
            {deviceData.map((dev, idx) => {
              const pct = totalViews > 0 ? ((dev.value / totalViews) * 100).toFixed(0) : "0";
              return (
                <div
                  key={idx}
                  className="flex justify-between items-center text-[12px] font-mono text-[color:var(--cf-ink-soft)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: dev.color }} />
                    <span className="text-[color:var(--cf-ink)]">{dev.name}</span>
                  </div>
                  <span className="tabular-nums">
                    <span className="text-[color:var(--cf-ink)]">{dev.value}</span> ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
