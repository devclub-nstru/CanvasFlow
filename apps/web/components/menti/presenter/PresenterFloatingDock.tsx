"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Clock,
  MessageSquare,
  QrCode,
  Lock,
  Unlock,
  Maximize,
  ThumbsUp,
} from "lucide-react";

interface Props {
  currentSlideIndex: number;
  totalSlides: number;
  isVotingLocked: boolean;
  showQRCode: boolean;
  reactionsCount: number;
  onNext: () => void;
  onPrev: () => void;
  onToggleQRCode: () => void;
  onToggleLock: () => void;
  onReaction: () => void;
  onToggleFullscreen: () => void;
}

export function PresenterFloatingDock({
  currentSlideIndex,
  totalSlides,
  isVotingLocked,
  showQRCode,
  reactionsCount,
  onNext,
  onPrev,
  onToggleQRCode,
  onToggleLock,
  onReaction,
  onToggleFullscreen,
}: Props) {
  return (
    <>
      {/* Bottom Floating Center Controls Bar (Screenshot 3) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1.5 bg-neutral-900/90 hover:bg-neutral-900 text-white backdrop-blur-md rounded-full shadow-2xl border border-neutral-700/60 select-none transition-all">
        {/* Previous Slide */}
        <button
          onClick={onPrev}
          disabled={currentSlideIndex === 0}
          className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-30 rounded-full transition-colors"
          title="Previous Slide (Left Arrow)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Slide Counter */}
        <span className="px-2 text-xs font-bold text-neutral-400 font-mono">
          {currentSlideIndex + 1} / {totalSlides}
        </span>

        {/* Next Slide */}
        <button
          onClick={onNext}
          disabled={currentSlideIndex === totalSlides - 1}
          className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-30 rounded-full transition-colors"
          title="Next Slide (Right Arrow or Space)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="w-px h-5 mx-1 bg-neutral-700" />

        {/* Hints */}
        <button
          className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-full"
          title="Hints"
        >
          <Lightbulb className="w-4 h-4" />
        </button>

        {/* Timer */}
        <button
          className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-full"
          title="Timer"
        >
          <Clock className="w-4 h-4" />
        </button>

        {/* Q&A */}
        <button
          className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-full"
          title="Audience Q&A"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        {/* Toggle QR Code Card */}
        <button
          onClick={onToggleQRCode}
          className={`p-2 rounded-full transition-colors ${
            showQRCode ? "text-blue-400 bg-neutral-800" : "text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
          title="Toggle Join QR (Q)"
        >
          <QrCode className="w-4 h-4" />
        </button>

        {/* Lock Voting */}
        <button
          onClick={onToggleLock}
          className={`p-2 rounded-full transition-colors ${
            isVotingLocked ? "text-red-400 bg-neutral-800" : "text-neutral-300 hover:text-white hover:bg-neutral-800"
          }`}
          title="Lock / Unlock voting (L)"
        >
          {isVotingLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>

        {/* Fullscreen */}
        <button
          onClick={onToggleFullscreen}
          className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-full"
          title="Fullscreen (F)"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Right Reactions Pill (Screenshot 3) */}
      <button
        onClick={onReaction}
        className="fixed bottom-6 right-8 z-30 flex items-center gap-2 px-3.5 py-2 bg-white/90 hover:bg-white text-neutral-900 border border-neutral-200 rounded-full shadow-lg backdrop-blur select-none hover:scale-105 active:scale-95 transition-all"
        title="Live reactions from audience"
      >
        <ThumbsUp className="w-4 h-4 text-blue-600 fill-blue-600" />
        <span className="text-xs font-bold font-mono">{reactionsCount}</span>
      </button>
    </>
  );
}
