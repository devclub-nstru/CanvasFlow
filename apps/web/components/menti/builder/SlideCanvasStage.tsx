"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { SlideQuestionViewer } from "../questions/registry";
import { BarChart3, QrCode } from "lucide-react";

interface Props {
  slide: MentiSlide;
  joinCode?: string;
}

export function SlideCanvasStage({ slide, joinCode }: Props) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 bg-neutral-100/60 overflow-hidden relative select-none">
      {/* Top Banner (Screenshot 1: "You have results from X participants") */}
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between text-xs text-neutral-600 bg-white/80 backdrop-blur border border-neutral-200 px-4 py-2 rounded-lg">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          <span>
            You have results from <strong>{slide.totalResponses || 0} participants</strong>.
          </span>
        </div>
        <div className="flex items-center gap-4 text-neutral-500 font-medium">
          <span className="cursor-pointer hover:text-neutral-900">View results</span>
          <span className="cursor-pointer hover:text-red-600">Clear results</span>
        </div>
      </div>

      {/* Main 16:9 Presentation Stage */}
      <div className="w-full max-w-4xl aspect-[16/9] bg-white rounded-2xl border border-neutral-200 shadow-xl overflow-hidden flex flex-col justify-between p-8 relative mt-6">
        {/* Stage Watermark / Branding */}
        {slide.designSettings.showLogo && (
          <div className="absolute top-6 right-6 flex items-center gap-1.5 opacity-40">
            <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm" />
            <span className="text-xs font-bold tracking-tight text-neutral-900">CanvasFlow Menti</span>
          </div>
        )}

        {/* Question Viewer Rendered dynamically based on question type */}
        <div className="flex-1 flex items-center justify-center w-full">
          <SlideQuestionViewer slide={slide} isPreview={true} />
        </div>

        {/* Bottom Stage Instructions (Join info) */}
        <div className="flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-100 pt-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-3.5 h-3.5" />
            <span>
              Go to <strong>menti.com</strong> and use code <strong>{joinCode || "8239 2324"}</strong>
            </span>
          </div>
          <span>Slide {slide.index}</span>
        </div>
      </div>
    </main>
  );
}
