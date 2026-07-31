"use client";

import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

interface DeviceData {
  name: string;
  value: number;
  color: string;
}

interface DeviceBreakdownProps {
  deviceData: DeviceData[];
}

/**
 * Device split of submissions.
 *
 * The total is summed from `deviceData` rather than taken from the response
 * count, because submissions recorded before device tracking existed carry no
 * device and are excluded upstream. Totalling locally keeps the slices and the
 * percentages consistent with each other.
 */
export function DeviceBreakdown({ deviceData }: DeviceBreakdownProps) {
  const total = deviceData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-(--cf-cream-2) rounded-xl ring-1 ring-(--cf-line) p-5 min-h-75 flex flex-col">
      <div>
        <p className="cf-eyebrow text-(--cf-ink-soft)">Devices</p>
        <h4 className="mt-2 cf-display text-[20px] leading-tight">Device breakdown</h4>
        <p className="mt-1 text-[12px] text-(--cf-ink-soft)">From submissions</p>
      </div>

      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[13px] text-(--cf-ink-soft)">
          No device data recorded yet.
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
              <span className="cf-display text-[20px] leading-none">{total}</span>
              <span className="cf-eyebrow text-(--cf-ink-soft) mt-1 text-[9px]">total</span>
            </div>
          </div>

          <div className="w-full space-y-1.5">
            {deviceData.map((dev, idx) => {
              const pct = total > 0 ? ((dev.value / total) * 100).toFixed(0) : "0";
              return (
                <div
                  key={idx}
                  className="flex justify-between items-center text-[12px] font-mono text-(--cf-ink-soft)"
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: dev.color }} />
                    <span className="text-(--cf-ink)">{dev.name}</span>
                  </div>
                  <span className="tabular-nums">
                    <span className="text-(--cf-ink)">{dev.value}</span> ({pct}%)
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
