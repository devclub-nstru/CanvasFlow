"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MentiSlide,
  MentiQuestionType,
} from "~/lib/menti";
import { SlideQuestionEditor } from "../questions/registry";
import {
  BarChart2,
  Cloud,
  Star,
  Sparkles,
  ChevronDown,
  Palette,
  X,
  Sliders,
  Check,
} from "lucide-react";

interface Props {
  slide: MentiSlide;
  isOpen: boolean;
  onToggleOpen: () => void;
  onChange: (updated: Partial<MentiSlide>) => void;
  onChangeType: (newType: MentiQuestionType) => void;
}

const QUESTION_TYPES: {
  type: MentiQuestionType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    type: "BAR_GRAPH",
    label: "Multiple Choice / Bar Graph",
    desc: "Single & multi-select choices",
    icon: BarChart2,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
  },
  {
    type: "WORD_CLOUD",
    label: "Word Cloud (Text)",
    desc: "Dynamic live word cluster",
    icon: Cloud,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
  },
  {
    type: "SCALES",
    label: "Scales / Rating",
    desc: "1–5 rating spectrum",
    icon: Star,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
  },
  {
    type: "CONTENT",
    label: "Blank / Text Slide",
    desc: "Headings & takeaways",
    icon: Sparkles,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-700",
  },
];

export function SlideInspectorPanel({
  slide,
  isOpen,
  onToggleOpen,
  onChange,
  onChangeType,
}: Props) {
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsTypeDropdownOpen(false);
    };

    if (isTypeDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTypeDropdownOpen]);

  if (!isOpen) {
    return (
      <aside className="flex h-full select-none z-20 shrink-0">
        <div className="w-10 bg-(--cf-cream-2) border-l border-(--cf-line-strong) flex flex-col items-center py-3">
          <button
            type="button"
            onClick={onToggleOpen}
            className="size-8 flex items-center justify-center rounded-(--hex-radius) bg-(--cf-ink) text-white shadow-xs hover:opacity-90 transition-opacity"
            title="Open Editor Panel"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  const currentTypeInfo =
    QUESTION_TYPES.find((t) => t.type === slide.type) || QUESTION_TYPES[0]!;
  const CurrentIcon = currentTypeInfo.icon;

  return (
    <aside className="w-80 bg-(--cf-cream-2) border-l border-(--cf-line-strong) flex flex-col h-full select-none z-20 shrink-0 animate-in slide-in-from-right-2 duration-200">
      {/* Panel Header */}
      <div className="cf-pane-bar px-4 flex items-center justify-between">
        <span className="cf-eyebrow text-(--cf-ink)">
          Content & Options
        </span>
        <button
          type="button"
          onClick={onToggleOpen}
          className="cf-danger-ghost p-1 rounded"
          title="Close panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Panel Scrollable Body */}
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* 1. Slide Question Type Selector */}
        <div className="relative" ref={dropdownRef}>
          <label className="cf-meta block mb-1.5 text-(--cf-ink-soft)">
            Slide Type
          </label>
          <button
            type="button"
            onClick={() => setIsTypeDropdownOpen((prev) => !prev)}
            className="cf-panel w-full flex items-center justify-between p-2.5 bg-white rounded-(--hex-radius) hover:border-(--cf-ink) text-left transition-all border border-(--cf-line-strong) shadow-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-1.5 ${currentTypeInfo.iconBg} ${currentTypeInfo.iconColor} rounded-lg shrink-0`}>
                <CurrentIcon className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-(--cf-ink) truncate">
                {currentTypeInfo.label}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-(--cf-ink-soft) transition-transform duration-150 shrink-0 ml-1 ${
                isTypeDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Inline Dropdown Popover */}
          {isTypeDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 p-1.5 bg-white border-2 border-(--cf-line-strong) rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 space-y-1">
              {QUESTION_TYPES.map((typeOption) => {
                const Icon = typeOption.icon;
                const isSelected = slide.type === typeOption.type;

                return (
                  <button
                    key={typeOption.type}
                    type="button"
                    onClick={() => {
                      onChangeType(typeOption.type);
                      setIsTypeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                      isSelected
                        ? "bg-(--cf-cream) border border-(--cf-line-strong) font-bold"
                        : "hover:bg-(--cf-cream-2) text-(--cf-ink)"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-1.5 ${typeOption.iconBg} ${typeOption.iconColor} rounded-md shrink-0`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-(--cf-ink) truncate">
                          {typeOption.label}
                        </p>
                        <p className="text-[10px] text-(--cf-ink-soft) truncate">
                          {typeOption.desc}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-(--cf-orange) shrink-0 stroke-[2.5]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Question Form Editor (Delegated to specific question type) */}
        <div className="pt-2 border-t border-(--cf-line)">
          <SlideQuestionEditor slide={slide} onChange={onChange} />
        </div>

        {/* 3. Design & Colors */}
        <div className="pt-4 border-t border-(--cf-line) space-y-3">
          <h4 className="cf-eyebrow text-(--cf-ink)">Design</h4>

          <div className="space-y-2">
            <button
              type="button"
              className="cf-btn-outline w-full justify-between py-1.5 px-2.5 text-xs rounded-(--hex-radius)"
            >
              <div className="flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-(--cf-ink-soft)" />
                <span>Color Theme</span>
              </div>
              <div className="size-3.5 bg-(--cf-orange) rounded-full border border-(--cf-line-strong)" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
