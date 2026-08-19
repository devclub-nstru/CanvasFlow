"use client";

import React, { useRef, useEffect } from "react";
import {
  X,
  BarChart2,
  Cloud,
  Star,
  Type,
  Sparkles,
} from "lucide-react";
import { MentiQuestionType } from "~/lib/menti";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: MentiQuestionType) => void;
}

export function NewSlidePickerModal({ isOpen, onClose, onSelectType }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (type: MentiQuestionType) => {
    onSelectType(type);
    onClose();
  };

  return (
    <>
      {/* Invisible backdrop overlay to capture outside clicks */}
      <div className="fixed inset-0 z-40 bg-black/5" />

      {/* Floating Popover Menu anchored at top-left */}
      <div
        ref={menuRef}
        className="fixed top-14 left-4 sm:left-5 z-50 w-[340px] sm:w-[380px] bg-white rounded-2xl border-2 border-(--cf-line-strong) cf-raised shadow-2xl flex flex-col overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="p-4 sm:p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
            <span className="cf-eyebrow text-(--cf-ink)">Add slide</span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              title="Close menu"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* 1. Interactive questions section */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Interactive questions
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1">
              {/* Multiple Choice / BAR_GRAPH */}
              <button
                type="button"
                onClick={() => handleSelect("BAR_GRAPH")}
                className="flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-neutral-100 transition-colors group"
              >
                <div className="size-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200 group-hover:scale-105 transition-transform">
                  <BarChart2 className="size-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-800 group-hover:text-blue-600 transition-colors block">
                    Multiple Choice
                  </span>
                  <span className="text-[11px] text-neutral-400 block">
                    Polls & bar charts
                  </span>
                </div>
              </button>

              {/* Word Cloud / WORD_CLOUD */}
              <button
                type="button"
                onClick={() => handleSelect("WORD_CLOUD")}
                className="flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-neutral-100 transition-colors group"
              >
                <div className="size-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-500 border border-rose-200 group-hover:scale-105 transition-transform">
                  <Cloud className="size-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-800 group-hover:text-rose-600 transition-colors block">
                    Word Cloud
                  </span>
                  <span className="text-[11px] text-neutral-400 block">
                    Live dynamic text clustering
                  </span>
                </div>
              </button>

              {/* Scales / SCALES */}
              <button
                type="button"
                onClick={() => handleSelect("SCALES")}
                className="flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-neutral-100 transition-colors group"
              >
                <div className="size-8 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200 group-hover:scale-105 transition-transform">
                  <Star className="size-4 fill-amber-500 text-amber-500" />
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-800 group-hover:text-amber-600 transition-colors block">
                    Scales
                  </span>
                  <span className="text-[11px] text-neutral-400 block">
                    1–5 rating statements
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Quiz competitions section */}
          <div className="pt-2 border-t border-neutral-100 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Quiz competitions
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1">
              {/* Select Answer / QUIZ */}
              <button
                type="button"
                onClick={() => handleSelect("QUIZ")}
                className="flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-neutral-100 transition-colors group"
              >
                <div className="size-8 flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 group-hover:scale-105 transition-transform">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-800 group-hover:text-indigo-600 transition-colors block">
                    Select Answer (Quiz)
                  </span>
                  <span className="text-[11px] text-neutral-400 block">
                    Timed quiz with points & auto leaderboard
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Content slides section */}
          <div className="pt-2 border-t border-neutral-100 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Content slides
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1">
              {/* Text / CONTENT */}
              <button
                type="button"
                onClick={() => handleSelect("CONTENT")}
                className="flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-neutral-100 transition-colors group"
              >
                <div className="size-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 group-hover:scale-105 transition-transform">
                  <Type className="size-4 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-800 group-hover:text-emerald-600 transition-colors block">
                    Heading / Text
                  </span>
                  <span className="text-[11px] text-neutral-400 block">
                    Section dividers & key points
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
