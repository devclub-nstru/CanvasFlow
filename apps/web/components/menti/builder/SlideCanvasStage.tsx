"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { SlideQuestionViewer, SlideQuestionCanvasEditor } from "../questions/registry";

interface Props {
  slide?: MentiSlide | null;
  isInspectorOpen?: boolean;
  onOpenNewSlideModal?: () => void;
  onChange?: (updated: Partial<MentiSlide>) => void;
}

export function SlideCanvasStage({
  slide,
  isInspectorOpen = true,
  onChange,
}: Props) {
  // If no slide is selected, create a fallback empty slide structure
  const currentSlide: MentiSlide = slide || {
    id: "default-slide",
    presentationId: "",
    type: "BAR_GRAPH",
    question: "Multiple Choice Question",
    position: 0,
    options: [
      { id: "opt-1", label: "Option 1" },
      { id: "opt-2", label: "Option 2" },
      { id: "opt-3", label: "Option 3" },
    ],
    responseSettings: {
      multipleSelection: false,
      maxSelections: 1,
    },
    designSettings: {},
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 bg-(--cf-cream) overflow-hidden relative select-none">
      {/* Active 16:9 Presentation Stage */}
      <div
        className={`relative flex flex-col items-center justify-center w-full aspect-[16/9] bg-white rounded-2xl border-2 border-(--cf-line-strong) cf-raised shadow-2xl overflow-hidden transition-all duration-300 ease-out ${
          isInspectorOpen
            ? "max-w-5xl 2xl:max-w-6xl max-h-[82vh] p-6 sm:p-10"
            : "max-w-6xl 2xl:max-w-7xl max-h-[86vh] p-8 sm:p-12"
        }`}
      >
        {/* Render Slide */}
        <div className="w-full h-full flex items-center justify-center transition-all duration-300">
          {onChange && slide ? (
            <SlideQuestionCanvasEditor slide={slide} onChange={onChange} />
          ) : (
            <SlideQuestionViewer slide={currentSlide} isPreview={true} />
          )}
        </div>
      </div>
    </main>
  );
}
