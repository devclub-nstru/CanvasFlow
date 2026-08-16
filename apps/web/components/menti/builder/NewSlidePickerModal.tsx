"use client";

import React from "react";
import {
  X,
  BarChart2,
  Cloud,
  Star,
  Trophy,
  FileText,
  Video,
  Image as ImageIcon,
  Sparkles,
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
  isPopular?: boolean;
}

const CORE_QUESTION_TYPES: QuestionTypeCard[] = [
  {
    type: "BAR_GRAPH",
    title: "Multiple Choice / Poll",
    desc: "Single & multi-checkbox options with animated live bars and percentage distributions",
    badge: "Choice & Checkbox",
    icon: <BarChart2 className="w-5 h-5 text-(--cf-orange)" />,
    isPopular: true,
  },
  {
    type: "WORD_CLOUD",
    title: "Word Cloud (Text)",
    desc: "Dynamic live word cloud where recurring participant answers grow in font scale",
    badge: "Single & Multi-Text",
    icon: <Cloud className="w-5 h-5 text-rose-600" />,
    isPopular: true,
  },
  {
    type: "SCALES",
    title: "Scales / Rating",
    desc: "Audience rates questions on a 1-5 Likert scale with live average score calculations",
    badge: "1-5 Rating Spectrum",
    icon: <Star className="w-5 h-5 text-amber-500 fill-amber-500" />,
  },
];

export function NewSlidePickerModal({ isOpen, onClose, onSelectType }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="flex flex-col w-full max-w-2xl max-h-[85vh] bg-(--cf-cream) rounded-2xl border-2 border-(--cf-line-strong) cf-raised overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="cf-pane-bar px-6 flex items-center justify-between">
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
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* 1. Core Interactive Question Types */}
          <section className="space-y-3">
            <h3 className="cf-meta text-(--cf-ink-soft)">
              Interactive questions
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {CORE_QUESTION_TYPES.map((card) => (
                <button
                  key={card.type}
                  type="button"
                  onClick={() => onSelectType(card.type)}
                  className="cf-panel cf-raised cf-press flex flex-col justify-between p-4 text-left bg-white rounded-xl border border-(--cf-line-strong) transition-all group min-h-[145px]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-(--cf-cream) border border-(--cf-line) rounded-lg shadow-xs group-hover:scale-105 transition-transform">
                        {card.icon}
                      </div>
                      {card.isPopular && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold text-blue-800 bg-blue-100 rounded">
                          Popular
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-(--cf-ink) group-hover:text-(--cf-orange) line-clamp-1">
                      {card.title}
                    </span>
                    <p className="mt-1 text-[11px] text-(--cf-ink-soft) line-clamp-3 leading-relaxed">
                      {card.desc}
                    </p>
                  </div>

                  <span className="cf-meta mt-3 inline-block px-1.5 py-0.5 text-[9px] font-bold text-(--cf-ink) bg-(--cf-cream) border border-(--cf-line) rounded">
                    {card.badge}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 2. Quiz Competitions */}
          <section className="space-y-3 pt-3 border-t border-(--cf-line)">
            <h3 className="cf-meta text-(--cf-ink-soft)">
              Quiz competitions (Coming soon)
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-3 p-3 bg-white border border-(--cf-line) rounded-xl">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-(--cf-ink)">
                  Timed Quiz Contest
                </span>
              </div>
            </div>
          </section>

          {/* 3. Content Slides */}
          <section className="space-y-3 pt-3 border-t border-(--cf-line)">
            <h3 className="cf-meta text-(--cf-ink-soft)">
              Content slides
            </h3>
            <div className="grid grid-cols-3 gap-2 opacity-50 cursor-not-allowed">
              <div className="flex items-center justify-center gap-2 p-2 bg-white border border-(--cf-line) rounded-lg text-xs font-medium text-(--cf-ink)">
                <FileText className="w-3.5 h-3.5" /> Heading
              </div>
              <div className="flex items-center justify-center gap-2 p-2 bg-white border border-(--cf-line) rounded-lg text-xs font-medium text-(--cf-ink)">
                <ImageIcon className="w-3.5 h-3.5" /> Image
              </div>
              <div className="flex items-center justify-center gap-2 p-2 bg-white border border-(--cf-line) rounded-lg text-xs font-medium text-(--cf-ink)">
                <Video className="w-3.5 h-3.5" /> Video
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
