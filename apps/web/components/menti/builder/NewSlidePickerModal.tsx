"use client";

import React from "react";
import {
  X,
  BarChart2,
  Cloud,
  Star,
  Sparkles,
  ListOrdered,
  Trophy,
} from "lucide-react";
import { MentiQuestionType } from "~/lib/menti";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: MentiQuestionType) => void;
}

interface QuestionTypeCard {
  type: MentiQuestionType;
  title: string;
  desc: string;
  badge: string;
  icon: React.ReactNode;
}

const CORE_QUESTION_TYPES: QuestionTypeCard[] = [
  {
    type: "BAR_GRAPH",
    title: "Multiple Choice / Poll",
    desc: "Single and multi-selection choices with real-time rising bars, vote counts, and percentage distribution modes.",
    badge: "Choice & Checkbox",
    icon: <BarChart2 className="w-6 h-6 text-(--cf-orange)" />,
  },
  {
    type: "WORD_CLOUD",
    title: "Word Cloud (Text)",
    desc: "Dynamic live word cloud where recurring participant answers dynamically cluster and expand in visual weight.",
    badge: "Single & Multi-Text",
    icon: <Cloud className="w-6 h-6 text-rose-600" />,
  },
  {
    type: "SCALES",
    title: "Scales / Rating",
    desc: "Audience rates statements on a 1–5 spectrum with live computed average score calculations and trends.",
    badge: "1–5 Rating Spectrum",
    icon: <Star className="w-6 h-6 text-amber-500 fill-amber-500" />,
  },
  {
    type: "RANKING",
    title: "Ranking",
    desc: "Audience drags items into their preferred order. Results are scored with a Borda count to reveal the consensus ranking and average position.",
    badge: "Ordered Preference",
    icon: <ListOrdered className="w-6 h-6 text-emerald-600" />,
  },
  {
    type: "QUIZ",
    title: "Quiz / Competition",
    desc: "Timed question with a right answer. A countdown opens voting, the fastest correct answers score the most, and points add up into a live leaderboard.",
    badge: "Timed & Scored",
    icon: <Trophy className="w-6 h-6 text-amber-600" />,
  },
  {
    type: "CONTENT",
    title: "Blank / Text Slide",
    desc: "Customizable text slide with titles, subtitles, kickers, alignments, and icons for section headers, key takeaways, announcements, or thank you notes.",
    badge: "Text & Section Header",
    icon: <Sparkles className="w-6 h-6 text-indigo-600" />,
  },
];

export function NewSlidePickerModal({ isOpen, onClose, onSelectType }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs select-none">
      <div className="flex flex-col w-full max-w-4xl bg-(--cf-cream) rounded-2xl border-2 border-(--cf-line-strong) cf-raised overflow-hidden animate-in fade-in zoom-in-95 duration-150 shadow-2xl">
        {/* Modal Header */}
        <div className="cf-pane-bar px-6 sm:px-8 py-3 flex items-center justify-between">
          <div>
            <span className="cf-eyebrow text-(--cf-ink)">Add a new slide</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cf-danger-ghost p-1 rounded"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-4">
          <h3 className="cf-meta text-(--cf-ink-soft)">
            Slide types & templates
          </h3>

          {/* 2x2 Grid with Generous Sizing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {CORE_QUESTION_TYPES.map((card) => (
              <button
                key={card.type}
                type="button"
                onClick={() => onSelectType(card.type)}
                className="cf-panel cf-raised cf-press flex flex-col justify-between p-5 sm:p-6 text-left bg-white rounded-2xl border-2 border-(--cf-line-strong) transition-all group min-h-[190px]"
              >
                <div>
                  <div className="flex items-center mb-3.5">
                    <div className="p-2.5 bg-(--cf-cream) border-2 border-(--cf-line-strong) rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                      {card.icon}
                    </div>
                  </div>
                  <span className="text-sm sm:text-base font-bold text-(--cf-ink) group-hover:text-(--cf-orange) transition-colors">
                    {card.title}
                  </span>
                  <p className="mt-1.5 text-xs sm:text-[13px] text-(--cf-ink-soft) leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="mt-4 pt-2">
                  <span className="cf-meta inline-block px-2.5 py-1 text-[10px] font-bold text-(--cf-ink) bg-(--cf-cream) border border-(--cf-line) rounded-(--hex-radius)">
                    {card.badge}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
