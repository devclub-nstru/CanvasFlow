"use client";

import React from "react";

import { SERIES } from "./palette";

interface ConversionFunnelProps {
  totalViews: number;
  totalResponses: number;
  completionRate: number;
}

export function ConversionFunnel({
  totalViews,
  totalResponses,
  completionRate,
}: ConversionFunnelProps) {
  const dropOff = Math.max(totalViews - totalResponses, 0);

  const steps = [
    {
      label: "Viewed",
      value: totalViews,
      hint: "opened the form",
      colour: SERIES[0],
    },
    {
      label: "Responded",
      value: totalResponses,
      hint: "submitted an answer",
      colour: SERIES[1],
    },
    {
      label: "Left without responding",
      value: dropOff,
      hint: "viewed but did not submit",
      colour: SERIES[5],
    },
  ];

  // Scale against views so the bars are comparable; guard the zero case so an
  // untouched form renders empty rather than NaN-width bars.
  const scale = totalViews > 0 ? totalViews : 1;

  return (
    <div className="cf-panel flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="cf-meta">Funnel</p>
          <h4 className="cf-display mt-2 text-[18px] leading-tight">Views to responses</h4>
        </div>
        <span
          className="cf-display shrink-0 text-[22px] leading-none tabular-nums"
          style={{ color: SERIES[0] }}
        >
          {completionRate.toFixed(1)}%
        </span>
      </div>

      {totalViews === 0 ? (
        <p className="mt-6 text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
          No views recorded yet. Publish and share the form to start tracking conversion.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {steps.map((step) => (
            <div key={step.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] font-medium">{step.label}</span>
                <span className="font-mono text-[12px] tabular-nums">
                  {step.value.toLocaleString()}
                </span>
              </div>
              <div className="mt-1.5 h-3 overflow-hidden" style={{ background: "var(--cf-line)" }}>
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min((step.value / scale) * 100, 100)}%`,
                    background: step.colour,
                  }}
                />
              </div>
              <p
                className="mt-1 font-mono text-[10px]"
                style={{ color: "var(--cf-ink-soft)" }}
              >
                {step.hint}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
