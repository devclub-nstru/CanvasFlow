"use client";

import React, { useState } from "react";
import { MentiSlide } from "~/lib/menti";
import { Send, CheckCircle2, Check } from "lucide-react";

interface Props {
  slide: MentiSlide;
  onSubmit: (selectedOptionIds: string[]) => void;
  hasSubmitted?: boolean;
}

export function BarGraphAudience({ slide, onSubmit, hasSubmitted }: Props) {
  const isMultiple = slide.responseSettings.multipleSelection ?? false;
  const maxSelections = slide.responseSettings.maxSelections;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggleOption = (id: string) => {
    if (isMultiple) {
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter((item) => item !== id));
      } else {
        if (maxSelections && selectedIds.length >= maxSelections) return;
        setSelectedIds([...selectedIds, id]);
      }
    } else {
      setSelectedIds([id]);
    }
  };

  if (hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="size-16 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-(--cf-ink)">Response Submitted!</h3>
          <p className="text-xs text-(--cf-ink-soft) max-w-xs mx-auto leading-relaxed">
            Look at the main screen to see the live results evolve in real time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (selectedIds.length > 0) onSubmit(selectedIds);
      }}
      className="flex flex-col w-full space-y-5 select-none"
    >
      {/* Question Header */}
      <div className="space-y-1">
        <h2 className="text-lg sm:text-xl font-bold leading-snug text-(--cf-ink)">
          {slide.question || "Which option do you prefer?"}
        </h2>
        <p className="cf-meta text-[11px] text-(--cf-ink-soft)">
          {isMultiple
            ? maxSelections
              ? `Select up to ${maxSelections} options`
              : "Select all that apply"
            : "Select one option"}
        </p>
      </div>

      {/* Options List */}
      <div className="space-y-2.5">
        {slide.options.map((option, index) => {
          const isSelected = selectedIds.includes(option.id);

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleToggleOption(option.id)}
              className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? "bg-white border-2 border-(--cf-ink) cf-raised ring-1 ring-(--cf-ink)"
                  : "bg-white border-(--cf-line-strong) hover:border-(--cf-ink) hover:bg-(--cf-cream)"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <span
                  className={`size-6 shrink-0 rounded-lg flex items-center justify-center font-mono font-bold text-xs transition-colors ${
                    isSelected
                      ? "bg-(--cf-ink) text-white"
                      : "bg-(--cf-cream) text-(--cf-ink) border border-(--cf-line)"
                  }`}
                >
                  {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : index + 1}
                </span>
                <span className="text-sm font-semibold text-(--cf-ink) truncate">
                  {option.label || `Option ${index + 1}`}
                </span>
              </div>

              {/* Color Bar Accent */}
              {option.color && (
                <div
                  className="size-3.5 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: option.color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={selectedIds.length === 0}
          className="cf-btn cf-raised cf-press w-full py-3.5 px-4 text-xs font-bold justify-center rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4 mr-2" />
          Submit Answer {selectedIds.length > 0 && isMultiple ? `(${selectedIds.length})` : ""}
        </button>
      </div>
    </form>
  );
}
