"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
}

export function WordCloudEditor({ slide, onChange }: Props) {
  const maxEntries = slide.responseSettings.maxEntriesPerParticipant ?? 1;

  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Question
        </label>
        <textarea
          value={slide.question}
          onChange={(e) => onChange({ question: e.target.value })}
          placeholder="Ask a text question..."
          rows={2}
          className="w-full px-3 py-2 text-sm bg-white border rounded-md border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      <div className="p-3 space-y-2 bg-neutral-50 border rounded-lg border-neutral-200">
        <label className="block text-xs font-semibold text-neutral-800">
          Text Input Mode
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              onChange({
                responseSettings: {
                  ...slide.responseSettings,
                  maxEntriesPerParticipant: 1,
                },
              })
            }
            className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
              maxEntries === 1
                ? "bg-white border-blue-600 text-blue-700 shadow-sm"
                : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Single text answer
          </button>

          <button
            type="button"
            onClick={() =>
              onChange({
                responseSettings: {
                  ...slide.responseSettings,
                  maxEntriesPerParticipant: 3,
                },
              })
            }
            className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
              maxEntries > 1
                ? "bg-white border-blue-600 text-blue-700 shadow-sm"
                : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Multi-text (3 words)
          </button>
        </div>
      </div>

      <div className="p-3 bg-neutral-50 border rounded-md border-neutral-200 text-xs text-neutral-600">
        Audience responses will be dynamically clustered into an animated live word cloud.
      </div>
    </div>
  );
}
