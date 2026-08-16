"use client";

import React from "react";
import { Plus, Trash2, BarChart2, Cloud, Star } from "lucide-react";
import { MentiSlide, MentiQuestionType } from "~/lib/menti";

interface Props {
  slides: MentiSlide[];
  activeSlideId: string;
  onSelectSlide: (id: string) => void;
  onOpenNewSlideModal: () => void;
  onDeleteSlide: (id: string) => void;
}

const QUESTION_ICONS: Record<MentiQuestionType, React.ReactNode> = {
  BAR_GRAPH: <BarChart2 className="w-3.5 h-3.5 text-(--cf-orange)" />,
  WORD_CLOUD: <Cloud className="w-3.5 h-3.5 text-rose-600" />,
  SCALES: <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />,
};

export function SlideThumbnailSidebar({
  slides,
  activeSlideId,
  onSelectSlide,
  onOpenNewSlideModal,
  onDeleteSlide,
}: Props) {
  return (
    <aside className="flex flex-col w-48 h-full bg-(--cf-cream-2) border-r border-(--cf-line-strong) select-none shrink-0">
      {/* Top CTA: + New slide */}
      <div className="p-3">
        <button
          type="button"
          onClick={onOpenNewSlideModal}
          className="cf-btn cf-raised cf-press w-full py-2 px-3 text-xs font-bold justify-center rounded-full"
        >
          <Plus className="w-4 h-4 mr-1 stroke-[3]" />
          New slide
        </button>
      </div>

      {/* Thumbnails List */}
      <div className="flex-1 px-3 space-y-3.5 overflow-y-auto pb-4 pt-1">
        {slides.map((slide, index) => {
          const isActive = slide.id === activeSlideId;

          return (
            <div key={slide.id} className="flex items-start gap-2 group">
              {/* Number Index */}
              <span className="cf-meta text-[11px] font-bold w-3.5 text-center pt-1.5 text-(--cf-ink-soft) shrink-0">
                {index + 1}
              </span>

              {/* Thumbnail Container */}
              <div
                onClick={() => onSelectSlide(slide.id)}
                className={`relative flex flex-col justify-between flex-1 aspect-[16/10] p-2.5 bg-white rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? "border-2 border-(--cf-ink) cf-raised ring-1 ring-(--cf-ink)"
                    : "border border-(--cf-line-strong) hover:border-(--cf-ink) hover:shadow-xs"
                }`}
              >
                {/* Top Question Type Tag & Delete Button */}
                <div className="flex items-center justify-between">
                  <div className="p-1 bg-(--cf-cream) border border-(--cf-line) rounded">
                    {QUESTION_ICONS[slide.type] || <BarChart2 className="w-3.5 h-3.5" />}
                  </div>

                  {slides.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSlide(slide.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-(--cf-ink-soft) hover:text-(--cf-danger) transition-opacity rounded"
                      title="Delete slide"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Question Preview text */}
                <p className="text-[10px] font-bold line-clamp-2 text-(--cf-ink) leading-snug mt-1">
                  {slide.question || "Untitled question"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
