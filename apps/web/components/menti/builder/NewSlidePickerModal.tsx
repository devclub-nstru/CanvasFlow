"use client";

import React, { useRef, useEffect } from "react";
import {
  X,
  BarChart2,
  Cloud,
  Star,
  Type,
  HelpCircle,
  FileSpreadsheet,
} from "lucide-react";
import { MentiQuestionType } from "~/lib/menti";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: MentiQuestionType) => void;
  onOpenPptxImport?: () => void;
}

export function NewSlidePickerModal({
  isOpen,
  onClose,
  onSelectType,
  onOpenPptxImport,
}: Props) {
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
      <div className="fixed inset-0 z-40 bg-black/10" />

      {/* Floating Popover Menu anchored at top-left */}
      <div
        ref={menuRef}
        className="fixed top-14 left-4 sm:left-5 z-50 w-[300px] sm:w-[320px] bg-white rounded-2xl border border-neutral-200/90 shadow-xl flex flex-col overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150 p-4"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
          <span className="text-xs font-bold text-neutral-800">Add slide</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            title="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 1. Interactive questions */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 px-1 mb-1">
              <span className="text-xs font-semibold text-neutral-500">
                Interactive questions
              </span>
              <HelpCircle className="size-3 text-neutral-400" />
            </div>

            <div className="space-y-0.5">
              {/* Multiple Choice */}
              <button
                type="button"
                onClick={() => handleSelect("BAR_GRAPH")}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-neutral-100 transition-colors group"
              >
                <BarChart2 className="size-4 text-blue-600" />
                <span className="text-xs font-semibold text-neutral-800 group-hover:text-blue-600 transition-colors">
                  Multiple Choice
                </span>
              </button>

              {/* Word Cloud */}
              <button
                type="button"
                onClick={() => handleSelect("WORD_CLOUD")}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-neutral-100 transition-colors group"
              >
                <Cloud className="size-4 text-rose-500" />
                <span className="text-xs font-semibold text-neutral-800 group-hover:text-rose-600 transition-colors">
                  Word Cloud
                </span>
              </button>

              {/* Scales */}
              <button
                type="button"
                onClick={() => handleSelect("SCALES")}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-neutral-100 transition-colors group"
              >
                <Star className="size-4 text-indigo-500 fill-indigo-500" />
                <span className="text-xs font-semibold text-neutral-800 group-hover:text-indigo-600 transition-colors">
                  Scales
                </span>
              </button>
            </div>
          </div>

          {/* 2. Quiz competitions */}
          <div className="pt-3 border-t border-neutral-100 space-y-1">
            <div className="flex items-center gap-1 px-1 mb-1">
              <span className="text-xs font-semibold text-neutral-500">
                Quiz competitions
              </span>
              <HelpCircle className="size-3 text-neutral-400" />
            </div>

            <div className="space-y-0.5">
              {/* Select Answer */}
              <button
                type="button"
                onClick={() => handleSelect("QUIZ")}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-neutral-100 transition-colors group"
              >
                <BarChart2 className="size-4 text-indigo-600" />
                <span className="text-xs font-semibold text-neutral-800 group-hover:text-indigo-600 transition-colors">
                  Select Answer
                </span>
              </button>
            </div>
          </div>

          {/* 3. Content slides */}
          <div className="pt-3 border-t border-neutral-100 space-y-1">
            <div className="flex items-center gap-1 px-1 mb-1">
              <span className="text-xs font-semibold text-neutral-500">
                Content slides
              </span>
              <HelpCircle className="size-3 text-neutral-400" />
            </div>

            <div className="space-y-0.5">
              {/* Text */}
              <button
                type="button"
                onClick={() => handleSelect("CONTENT")}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-neutral-100 transition-colors group"
              >
                <Type className="size-4 text-blue-600 stroke-[2.5]" />
                <span className="text-xs font-semibold text-neutral-800 group-hover:text-blue-600 transition-colors">
                  Text
                </span>
              </button>
            </div>
          </div>

          {/* 4. Import */}
          {onOpenPptxImport && (
            <div className="pt-3 border-t border-neutral-100 space-y-1">
              <div className="flex items-center gap-1 px-1 mb-1">
                <span className="text-xs font-semibold text-neutral-500">
                  Import slides
                </span>
                <HelpCircle className="size-3 text-neutral-400" />
              </div>

              <div className="space-y-0.5">
                {/* PowerPoint */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPptxImport();
                  }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-orange-50/80 transition-colors group"
                >
                  <FileSpreadsheet className="size-4 text-(--cf-orange) stroke-[2.5]" />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-neutral-800 group-hover:text-(--cf-orange) transition-colors">
                      PowerPoint (.pptx)
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
