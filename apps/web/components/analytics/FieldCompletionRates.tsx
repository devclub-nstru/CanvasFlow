"use client";

import React from "react";
import { SEMANTIC } from "./palette";

interface FieldRate {
  fieldId: string;
  fieldLabel: string;
  rate: number;
}

interface FieldCompletionRatesProps {
  fieldCompletionRates: FieldRate[];
}

function rateColor(rate: number): string {
  if (rate >= 80) return "#16a34a";
  if (rate >= 50) return SEMANTIC.warn;
  return "#c1281d";
}

export function FieldCompletionRates({ fieldCompletionRates }: FieldCompletionRatesProps) {
  if (fieldCompletionRates.length === 0) return null;

  return (
    <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5">
      <div>
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Completion</p>
        <h4 className="mt-2 cf-display text-[20px] leading-tight">Field completion</h4>
        <p className="mt-1 text-[12px] text-[color:var(--cf-ink-soft)]">
          Of all visitors who opened the form, % who answered each field
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {fieldCompletionRates.map((field) => {
          const color = rateColor(field.rate);
          return (
            <div key={field.fieldId} className="space-y-1.5">
              <div className="flex justify-between items-center gap-3">
                <span className="text-[13px] text-[color:var(--cf-ink)] truncate">
                  {field.fieldLabel}
                </span>
                <span
                  className="text-[12px] font-mono font-medium tabular-nums shrink-0"
                  style={{ color }}
                >
                  {field.rate}%
                </span>
              </div>
              <div className="h-1.5 bg-[color:var(--cf-cream)] rounded-full overflow-hidden ring-1 ring-[color:var(--cf-line)]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${field.rate}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
