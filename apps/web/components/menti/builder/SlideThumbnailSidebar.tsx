"use client";

import React from "react";
import { Plus, Trash2, BarChart2, Cloud, Star, LayoutGrid } from "lucide-react";
import { MentiSlide, MentiQuestionType } from "~/lib/menti";

interface Props {
  slides: MentiSlide[];
  activeSlideId: string;
  onSelectSlide: (id: string) => void;
  onOpenNewSlideModal: () => void;
  onDeleteSlide: (id: string) => void;
  onToggleOverview?: () => void;
}

const QUESTION_ICONS: Record<MentiQuestionType, React.ReactNode> = {
  BAR_GRAPH: <BarChart2 className="w-3 h-3 text-(--cf-orange)" />,
  WORD_CLOUD: <Cloud className="w-3 h-3 text-rose-600" />,
  SCALES: <Star className="w-3 h-3 text-amber-500 fill-amber-500" />,
};

export function SlideThumbnailSidebar({
  slides,
  activeSlideId,
  onSelectSlide,
  onOpenNewSlideModal,
  onDeleteSlide,
  onToggleOverview,
}: Props) {
  return (
    <aside className="flex flex-col w-32 h-full bg-(--cf-cream-2) border-r border-(--cf-line-strong) select-none shrink-0">
      {/* Top CTA: + New slide */}
      <div className="p-2.5">
        <button
          type="button"
          onClick={onOpenNewSlideModal}
          className="cf-btn cf-raised cf-press w-full py-1.5 px-2 text-xs font-bold justify-center rounded-full"
        >
          <Plus className="w-3.5 h-3.5 mr-1 stroke-[3]" />
          New slide
        </button>
      </div>

      {/* Thumbnails List */}
      <div className="flex-1 px-2.5 space-y-3 overflow-y-auto pt-1">
        {slides.map((slide, index) => {
          const isActive = slide.id === activeSlideId;

          return (
            <div key={slide.id} className="flex items-start gap-1.5 group">
              {/* Number Index */}
              <span className="cf-meta text-[10px] w-3 text-center pt-1 text-(--cf-ink-soft)">
                {index + 1}
              </span>

              {/* Thumbnail Container */}
              <div
                onClick={() => onSelectSlide(slide.id)}
                className={`relative flex flex-col justify-between flex-1 aspect-[16/10] p-1.5 bg-white rounded-(--hex-radius) cursor-pointer transition-all ${
                  isActive
                    ? "border-2 border-(--cf-ink) cf-raised ring-1 ring-(--cf-ink)"
                    : "border border-(--cf-line-strong) hover:border-(--cf-ink) hover:shadow-xs"
                }`}
              >
                {/* Top Question Type Tag */}
                <div className="flex items-center justify-between">
                  <div className="p-0.5 bg-(--cf-cream) rounded">
                    {QUESTION_ICONS[slide.type] || <BarChart2 className="w-3 h-3" />}
                  </div>

                  {slides.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSlide(slide.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-(--cf-ink-soft) hover:text-(--cf-danger) transition-opacity"
                      title="Delete slide"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Question Preview text or Icon */}
                <p className="text-[9px] font-bold line-clamp-2 text-(--cf-ink) leading-tight mt-1">
                  {slide.question || "TI"}
                </p>

                {/* Bottom Avatar Tag (Screenshot matching SS badge) */}
                <div className="flex justify-end mt-auto">
                  <span className="text-[8px] font-black px-1 py-0.2 rounded-full bg-violet-100 text-violet-700 border border-violet-300">
                    SS
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Grid / Overview Button */}
      <div className="p-2 border-t border-(--cf-line)">
        <button
          type="button"
          onClick={onToggleOverview}
          className="cf-btn-outline size-8 flex items-center justify-center p-0 rounded-(--hex-radius)"
          title="Slide Overview (Grid View)"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
