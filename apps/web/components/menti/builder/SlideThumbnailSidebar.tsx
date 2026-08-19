"use client";

import React, { useState, useRef } from "react";
import {
  Plus,
  X,
  Trash2,
  BarChart2,
  Cloud,
  Star,
  Sparkles,
  HelpCircle,
  Trophy,
  GripVertical,
} from "lucide-react";
import { MentiSlide, MentiQuestionType } from "~/lib/menti";

interface Props {
  slides: MentiSlide[];
  activeSlideId: string;
  onSelectSlide: (id: string) => void;
  onOpenNewSlideModal: () => void;
  isNewSlideMenuOpen?: boolean;
  onDeleteSlide: (id: string) => void;
  onReorderSlide?: (fromIdx: number, toIdx: number) => void;
}

const QUESTION_ICONS: Record<MentiQuestionType, React.ReactNode> = {
  QUIZ: <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />,
  LEADERBOARD: <Trophy className="w-3.5 h-3.5 text-amber-500" />,
  BAR_GRAPH: <BarChart2 className="w-3.5 h-3.5 text-(--cf-orange)" />,
  WORD_CLOUD: <Cloud className="w-3.5 h-3.5 text-rose-600" />,
  SCALES: <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />,
  CONTENT: <Sparkles className="w-3.5 h-3.5 text-indigo-600" />,
};

export function SlideThumbnailSidebar({
  slides,
  activeSlideId,
  onSelectSlide,
  onOpenNewSlideModal,
  isNewSlideMenuOpen = false,
  onDeleteSlide,
  onReorderSlide,
}: Props) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropSlotIndex, setDropSlotIndex] = useState<number | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${index}`);
  };

  const handleDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const el = itemRefs.current[index];
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const isBottomHalf = e.clientY > midY;
    const targetSlot = isBottomHalf ? index + 1 : index;

    if (dropSlotIndex !== targetSlot) {
      setDropSlotIndex(targetSlot);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropSlotIndex(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex !== null && dropSlotIndex !== null && onReorderSlide) {
      if (dropSlotIndex !== draggedIndex && dropSlotIndex !== draggedIndex + 1) {
        onReorderSlide(draggedIndex, dropSlotIndex);
      }
    }
    setDraggedIndex(null);
    setDropSlotIndex(null);
  };

  return (
    <aside className="flex flex-col w-48 h-full bg-(--cf-cream-2) border-r border-(--cf-line-strong) select-none shrink-0">
      {/* Top CTA: + New slide / ✕ New slide */}
      <div className="p-3">
        <button
          type="button"
          onClick={onOpenNewSlideModal}
          className={`w-full py-2 px-3 text-xs font-bold justify-center rounded-full transition-all flex items-center shadow-xs ${
            isNewSlideMenuOpen
              ? "bg-neutral-900 text-white hover:bg-neutral-800"
              : "cf-btn cf-raised cf-press"
          }`}
        >
          {isNewSlideMenuOpen ? (
            <>
              <X className="w-3.5 h-3.5 mr-1.5 stroke-[2.5]" />
              New slide
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-1 stroke-[3]" />
              New slide
            </>
          )}
        </button>
      </div>

      {/* Thumbnails List with Drag & Drop */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="flex-1 px-3 overflow-y-auto pb-6 pt-1 space-y-1.5"
      >
        {slides.map((slide, index) => {
          const isActive = slide.id === activeSlideId;
          const isBeingDragged = draggedIndex === index;
          const showTopDropIndicator =
            dropSlotIndex === index && draggedIndex !== null && draggedIndex !== index && draggedIndex !== index - 1;

          return (
            <React.Fragment key={slide.id}>
              {/* Drop Landing Preview Indicator (Above Item) */}
              {showTopDropIndicator && (
                <div className="py-1 px-1 animate-in fade-in zoom-in-95 duration-100">
                  <div className="h-1.5 bg-(--cf-orange) rounded-full shadow-md relative flex items-center">
                    <div className="size-2.5 rounded-full bg-(--cf-orange) absolute -left-1 ring-2 ring-white" />
                    <div className="size-2.5 rounded-full bg-(--cf-orange) absolute -right-1 ring-2 ring-white" />
                  </div>
                </div>
              )}

              <div
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOverItem(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-start gap-1.5 group cursor-grab active:cursor-grabbing transition-all duration-150 ${
                  isBeingDragged ? "opacity-30 scale-95" : "opacity-100"
                }`}
              >
                {/* Drag Handle & Number Index */}
                <div className="flex flex-col items-center justify-center w-4 pt-1 text-(--cf-ink-soft) shrink-0">
                  <span className="cf-meta text-[10px] font-bold text-center group-hover:hidden">
                    {index + 1}
                  </span>
                  <GripVertical className="w-3.5 h-3.5 hidden group-hover:block text-(--cf-ink-soft) group-hover:text-(--cf-ink)" />
                </div>

                {/* Thumbnail Container */}
                <div
                  onClick={() => onSelectSlide(slide.id)}
                  className={`relative flex flex-col justify-between flex-1 aspect-[16/10] p-2.5 bg-white rounded-xl cursor-pointer transition-all ${
                    isActive
                      ? "border-2 border-(--cf-ink) cf-raised ring-1 ring-(--cf-ink)"
                      : "border border-(--cf-line-strong) hover:border-(--cf-ink) hover:shadow-xs"
                  }`}
                >
                  {/* Top Question Type Tag & Delete Button */}
                  <div className="flex items-center justify-between">
                    <div className="p-1 bg-(--cf-cream) border border-(--cf-line) rounded-md">
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
            </React.Fragment>
          );
        })}

        {/* Drop Landing Preview Indicator (At the very bottom of the list) */}
        {dropSlotIndex === slides.length && draggedIndex !== null && draggedIndex !== slides.length - 1 && (
          <div className="py-1 px-1 animate-in fade-in zoom-in-95 duration-100">
            <div className="h-1.5 bg-(--cf-orange) rounded-full shadow-md relative flex items-center">
              <div className="size-2.5 rounded-full bg-(--cf-orange) absolute -left-1 ring-2 ring-white" />
              <div className="size-2.5 rounded-full bg-(--cf-orange) absolute -right-1 ring-2 ring-white" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
