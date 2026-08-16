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
    title: "Multiple Choice / Bar Graph",
    desc: "Supports both Single Checkbox and Multi-Checkbox modes with live animated bar & donut charts",
    badge: "Checkbox & Multi-Checkbox",
    icon: <BarChart2 className="w-5 h-5 text-blue-600" />,
    isPopular: true,
  },
  {
    type: "WORD_CLOUD",
    title: "Word Cloud (Text)",
    desc: "Supports both Single Text and Multi-Text answers. Words scale dynamically with audience frequency",
    badge: "Single & Multi-Text",
    icon: <Cloud className="w-5 h-5 text-rose-600" />,
    isPopular: true,
  },
  {
    type: "SCALES",
    title: "Scales / Rating",
    desc: "Audience rates statements on a 1-5 Likert spectrum with live average score calculation",
    badge: "1-5 Rating Spectrum",
    icon: <Star className="w-5 h-5 text-amber-500 fill-amber-500" />,
  },
];

export function NewSlidePickerModal({ isOpen, onClose, onSelectType }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm select-none">
      <div className="flex flex-col w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Add a new slide</h2>
            <p className="text-xs text-neutral-500">
              Select one of the 3 interaction visualization types
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* 1. Core Question Types */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Interactive questions
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {CORE_QUESTION_TYPES.map((card) => (
                <button
                  key={card.type}
                  type="button"
                  onClick={() => onSelectType(card.type)}
                  className="flex flex-col justify-between p-4 text-left bg-neutral-50 hover:bg-blue-50/60 border border-neutral-200 hover:border-blue-300 rounded-xl transition-all group min-h-[140px]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-white border rounded-lg shadow-sm border-neutral-200 group-hover:scale-105 transition-transform">
                        {card.icon}
                      </div>
                      {card.isPopular && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold text-blue-700 bg-blue-100 rounded">
                          Popular
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-neutral-800 group-hover:text-blue-600 line-clamp-1">
                      {card.title}
                    </span>
                    <p className="mt-1 text-xs text-neutral-500 line-clamp-3 leading-relaxed">
                      {card.desc}
                    </p>
                  </div>

                  <span className="mt-3 inline-block px-2 py-0.5 text-[10px] font-semibold text-neutral-600 bg-neutral-200/70 rounded">
                    {card.badge}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 2. Quiz Competitions (Coming soon category) */}
          <section className="space-y-3 pt-4 border-t border-neutral-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Quiz competitions (Coming Soon)
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 opacity-60">
              <div className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-bold text-neutral-700">Timed Quiz Contest</span>
              </div>
            </div>
          </section>

          {/* 3. Content Slides */}
          <section className="space-y-3 pt-4 border-t border-neutral-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Content slides
            </h3>
            <div className="grid grid-cols-3 gap-2 opacity-60">
              <div className="flex items-center justify-center gap-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700">
                <FileText className="w-4 h-4" /> Heading
              </div>
              <div className="flex items-center justify-center gap-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700">
                <ImageIcon className="w-4 h-4" /> Image
              </div>
              <div className="flex items-center justify-center gap-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700">
                <Video className="w-4 h-4" /> Video
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
