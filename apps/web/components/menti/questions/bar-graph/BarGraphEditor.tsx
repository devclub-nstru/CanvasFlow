"use client";

import React from "react";
import { MentiSlide, MentiOption } from "~/lib/menti";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
}

export function BarGraphEditor({ slide, onChange }: Props) {
  const options = slide.options || [];
  const isMulti = slide.responseSettings.multipleSelection ?? false;

  const updateOption = (idx: number, label: string) => {
    const next = [...options];
    const existing = next[idx];
    if (existing) {
      next[idx] = { ...existing, label };
      onChange({ options: next });
    }
  };

  const addOption = () => {
    const nextOption: MentiOption = {
      id: `opt-${Date.now()}`,
      label: `Option ${options.length + 1}`,
      voteCount: 0,
    };
    onChange({ options: [...options, nextOption] });
  };

  const removeOption = (idx: number) => {
    if (options.length > 2) {
      onChange({ options: options.filter((_, i) => i !== idx) });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Question
        </label>
        <textarea
          value={slide.question}
          onChange={(e) => onChange({ question: e.target.value })}
          placeholder="Ask a question..."
          rows={2}
          className="w-full px-3 py-2 text-sm bg-white border rounded-md border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {/* Response Settings: Single vs Multi Checkbox */}
      <div className="p-3 space-y-2 bg-neutral-50 border rounded-lg border-neutral-200">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs font-semibold text-neutral-800">
            Multiple selections (Multi-checkbox)
          </span>
          <input
            type="checkbox"
            checked={isMulti}
            onChange={(e) =>
              onChange({
                responseSettings: {
                  ...slide.responseSettings,
                  multipleSelection: e.target.checked,
                },
              })
            }
            className="w-4 h-4 text-blue-600 rounded border-neutral-300 focus:ring-blue-500"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer pt-1 border-t border-neutral-200">
          <span className="text-xs font-medium text-neutral-700">Show results as percentage</span>
          <input
            type="checkbox"
            checked={slide.responseSettings.showResultsAsPercentage ?? false}
            onChange={(e) =>
              onChange({
                responseSettings: {
                  ...slide.responseSettings,
                  showResultsAsPercentage: e.target.checked,
                },
              })
            }
            className="w-4 h-4 text-blue-600 rounded border-neutral-300 focus:ring-blue-500"
          />
        </label>
      </div>

      {/* Options List */}
      <div>
        <label className="block mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Options
        </label>
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={opt.id || idx} className="flex items-center gap-2">
              <span className="w-5 text-xs text-center font-bold text-neutral-400">{idx + 1}</span>
              <input
                type="text"
                value={opt.label}
                onChange={(e) => updateOption(idx, e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm bg-white border rounded-md border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(idx)}
                  className="p-1.5 text-neutral-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addOption}
          className="flex items-center justify-center w-full py-2 mt-2 text-xs font-semibold text-blue-600 border border-dashed rounded-md border-blue-300 hover:bg-blue-50"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Option
        </button>
      </div>
    </div>
  );
}
