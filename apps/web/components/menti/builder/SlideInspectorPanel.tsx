"use client";

import React from "react";
import {
  MentiSlide,
  MentiQuestionType,
} from "~/lib/menti";
import { SlideQuestionEditor } from "../questions/registry";
import {
  BarChart2,
  ChevronDown,
  Palette,
  X,
  Sliders,
  HelpCircle,
  Trophy,
  Cloud,
  Star,
  Sparkles,
} from "lucide-react";

interface Props {
  slide: MentiSlide;
  isOpen: boolean;
  onToggleOpen: () => void;
  onChange: (updated: Partial<MentiSlide>) => void;
  onOpenTypePicker: () => void;
  onToggleQuizLeaderboard?: (quizSlideId: string, enable: boolean) => void;
}

const QUESTION_TYPE_LABELS: Record<MentiQuestionType, string> = {
  QUIZ: "Quiz (Select Answer)",
  LEADERBOARD: "Quiz Leaderboard",
  BAR_GRAPH: "Multiple Choice / Bar Graph",
  WORD_CLOUD: "Word Cloud (Text)",
  SCALES: "Scales / Rating",
  CONTENT: "Blank / Text Slide",
};

const QUESTION_TYPE_ICONS: Record<MentiQuestionType, React.ReactNode> = {
  QUIZ: <HelpCircle className="w-4 h-4 text-emerald-600" />,
  LEADERBOARD: <Trophy className="w-4 h-4 text-amber-500" />,
  BAR_GRAPH: <BarChart2 className="w-4 h-4 text-(--cf-orange)" />,
  WORD_CLOUD: <Cloud className="w-4 h-4 text-rose-600" />,
  SCALES: <Star className="w-4 h-4 text-amber-500 fill-amber-500" />,
  CONTENT: <Sparkles className="w-4 h-4 text-indigo-600" />,
};

export function SlideInspectorPanel({
  slide,
  isOpen,
  onToggleOpen,
  onChange,
  onOpenTypePicker,
  onToggleQuizLeaderboard,
}: Props) {
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
        <div>
          <label className="cf-meta block mb-1.5 text-(--cf-ink-soft)">
            Slide Type
          </label>
          <button
            type="button"
            onClick={onOpenTypePicker}
            className="cf-panel w-full flex items-center justify-between p-2.5 bg-white rounded-(--hex-radius) hover:border-(--cf-ink) text-left transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 bg-neutral-100 rounded">
                {QUESTION_TYPE_ICONS[slide.type] || <BarChart2 className="w-4 h-4" />}
              </div>
              <span className="text-xs font-bold text-(--cf-ink)">
                {QUESTION_TYPE_LABELS[slide.type] || "Select Type"}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-(--cf-ink-soft)" />
          </button>
        </div>

        {/* 2. Question Form Editor (Delegated to specific question type) */}
        <div className="pt-2 border-t border-(--cf-line)">
          <SlideQuestionEditor
            slide={slide}
            onChange={onChange}
            onToggleQuizLeaderboard={onToggleQuizLeaderboard}
          />
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
