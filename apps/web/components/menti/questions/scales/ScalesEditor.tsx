"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
}

export function ScalesEditor({ slide, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Question
        </label>
        <textarea
          value={slide.question}
          onChange={(e) => onChange({ question: e.target.value })}
          placeholder="What are you rating or scaling?"
          rows={2}
          className="w-full px-3 py-2 text-sm bg-white border rounded-md border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Low Label (1)
          </label>
          <input
            type="text"
            value={slide.responseSettings.ratingLowLabel || ""}
            onChange={(e) =>
              onChange({
                responseSettings: {
                  ...slide.responseSettings,
                  ratingLowLabel: e.target.value,
                },
              })
            }
            placeholder="e.g. Strongly Disagree"
            className="w-full px-3 py-1.5 text-sm bg-white border rounded-md border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            High Label (5)
          </label>
          <input
            type="text"
            value={slide.responseSettings.ratingHighLabel || ""}
            onChange={(e) =>
              onChange({
                responseSettings: {
                  ...slide.responseSettings,
                  ratingHighLabel: e.target.value,
                },
              })
            }
            placeholder="e.g. Strongly Agree"
            className="w-full px-3 py-1.5 text-sm bg-white border rounded-md border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>
    </div>
  );
}
