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
  Trophy,
  Cloud,
  Star,
  Type,
  Sparkles,
} from "lucide-react";

interface Props {
  slide: MentiSlide;
  isOpen: boolean;
  onToggleOpen: () => void;
  onChange: (updated: Partial<MentiSlide>) => void;
  onOpenTypePicker?: () => void;
  onToggleQuizLeaderboard?: (quizSlideId: string, enable: boolean) => void;
}

const QUESTION_TYPE_LABELS: Record<MentiQuestionType, string> = {
  QUIZ: "Select Answer / Quiz",
  LEADERBOARD: "Leaderboard",
  BAR_GRAPH: "Multiple Choice Poll",
  WORD_CLOUD: "Word Cloud (Text)",
  SCALES: "Scales / Rating",
  CONTENT: "Text / Blank Slide",
};

const QUESTION_TYPE_ICONS: Record<MentiQuestionType, React.ReactNode> = {
  QUIZ: <BarChart2 className="w-4 h-4 text-indigo-600" />,
  LEADERBOARD: <Trophy className="w-4 h-4 text-amber-500" />,
  BAR_GRAPH: <BarChart2 className="w-4 h-4 text-blue-600" />,
  WORD_CLOUD: <Cloud className="w-4 h-4 text-rose-500" />,
  SCALES: <Star className="w-4 h-4 text-amber-500 fill-amber-500" />,
  CONTENT: <Type className="w-4 h-4 text-indigo-600 stroke-[2.5]" />,
};

export function SlideInspectorPanel({
  slide,
  isOpen,
  onToggleOpen,
  onChange,
  onToggleQuizLeaderboard,
}: Props) {
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = React.useState(false);

  const handleTypeChange = (newType: MentiQuestionType) => {
    const defaults: Partial<MentiSlide> = {
      type: newType,
    };

    if (newType === "BAR_GRAPH") {
      defaults.question = "New Multiple Choice Poll";
      defaults.options = [
        { id: "opt-1", label: "Option 1", voteCount: 0 },
        { id: "opt-2", label: "Option 2", voteCount: 0 },
      ];
    } else if (newType === "SCALES") {
      defaults.question = "New Rating / Scales Question";
      defaults.options = [
        { id: "rate-1", label: "1", voteCount: 0 },
        { id: "rate-2", label: "2", voteCount: 0 },
        { id: "rate-3", label: "3", voteCount: 0 },
        { id: "rate-4", label: "4", voteCount: 0 },
        { id: "rate-5", label: "5", voteCount: 0 },
      ];
    } else if (newType === "WORD_CLOUD") {
      defaults.question = "New Word Cloud Question";
      defaults.options = [];
    } else if (newType === "CONTENT") {
      defaults.question = "Add your heading here";
      defaults.description = "Add a subtitle, takeaway, or body text here.";
      defaults.options = [];
    } else if (newType === "QUIZ") {
      defaults.question = "New Quiz Question";
      defaults.options = [
        { id: "opt-1", label: "Option 1", isCorrect: true, voteCount: 0 },
        { id: "opt-2", label: "Option 2", isCorrect: false, voteCount: 0 },
      ];
      defaults.quizSettings = {
        timeLimitSeconds: 30,
        maxPoints: 1000,
        gradingScheme: "time_based",
      };
    } else if (newType === "LEADERBOARD") {
      defaults.question = "Leaderboard";
      defaults.options = [];
    }

    onChange(defaults);
  };

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
        <div className="relative">
          <label className="cf-meta block mb-1.5 text-(--cf-ink-soft)">
            Slide Type
          </label>
          <button
            type="button"
            onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
            className="cf-panel w-full flex items-center justify-between p-2.5 bg-white rounded-(--hex-radius) hover:border-(--cf-ink) text-left transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 bg-neutral-100 rounded text-neutral-600">
                {QUESTION_TYPE_ICONS[slide.type] || <BarChart2 className="w-4 h-4" />}
              </div>
              <span className="text-xs font-bold text-(--cf-ink)">
                {QUESTION_TYPE_LABELS[slide.type] || "Select Type"}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-(--cf-ink-soft)" />
          </button>

          {isTypeDropdownOpen && (
            <>
              {/* Invisible Click out Layer */}
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsTypeDropdownOpen(false)}
              />

              {/* Custom Inline Dropdown Selection Menu */}
              <div className="absolute left-0 right-0 mt-1 z-40 bg-white rounded-(--hex-radius) border border-(--cf-line-strong) shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                {(Object.keys(QUESTION_TYPE_LABELS) as MentiQuestionType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      handleTypeChange(type);
                      setIsTypeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-left transition-colors ${
                      slide.type === type
                        ? "bg-neutral-100 text-(--cf-ink)"
                        : "hover:bg-neutral-50 text-(--cf-ink-soft) hover:text-(--cf-ink)"
                    }`}
                  >
                    <div className="p-0.5 bg-neutral-100 rounded">
                      {QUESTION_TYPE_ICONS[type]}
                    </div>
                    <span>{QUESTION_TYPE_LABELS[type]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
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
