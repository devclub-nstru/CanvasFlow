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
  BAR_GRAPH: <BarChart2 className="w-3.5 h-3.5" />,
  WORD_CLOUD: <Cloud className="w-3.5 h-3.5" />,
  SCALES: <Star className="w-3.5 h-3.5" />,
};

export function SlideThumbnailSidebar({
  slides,
  activeSlideId,
  onSelectSlide,
  onOpenNewSlideModal,
  onDeleteSlide,
}: Props) {
  return (
    <aside className="flex flex-col w-56 h-[calc(100vh-3.5rem)] bg-neutral-50 border-r border-neutral-200 select-none">
      {/* Top action: New Slide */}
      <div className="p-3">
        <button
          onClick={onOpenNewSlideModal}
          className="flex items-center justify-center w-full gap-1.5 py-2 px-3 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          New slide
        </button>
      </div>

      {/* Thumbnails List */}
      <div className="flex-1 px-3 space-y-2.5 overflow-y-auto">
        {slides.map((slide, index) => {
          const isActive = slide.id === activeSlideId;

          return (
            <div key={slide.id} className="flex items-center gap-2 group">
              <span className="w-4 text-[11px] font-bold text-neutral-400 text-center">
                {index + 1}
              </span>

              <div
                onClick={() => onSelectSlide(slide.id)}
                className={`relative flex flex-col justify-between flex-1 h-24 p-2 bg-white rounded-lg border-2 cursor-pointer transition-all ${
                  isActive
                    ? "border-blue-600 shadow-md ring-2 ring-blue-100"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                {/* Mini Header / Icon */}
                <div className="flex items-center justify-between text-neutral-500">
                  <div className="p-1 bg-neutral-100 rounded">
                    {QUESTION_ICONS[slide.type]}
                  </div>

                  {slides.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSlide(slide.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-600 transition-opacity"
                      title="Delete slide"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Mini Preview Label */}
                <p className="text-[10px] font-semibold line-clamp-2 text-neutral-700 leading-tight">
                  {slide.question || "Untitled Question"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
