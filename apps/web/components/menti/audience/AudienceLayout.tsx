"use client";

import React, { useState } from "react";
import { MentiPresentation, MentiSlide } from "~/lib/menti";
import { SlideAudienceInput } from "../questions/registry";
import { ThumbsUp, Heart, Smile, XCircle } from "lucide-react";
import Noise from "~/components/Noise";

interface Props {
  presentation: MentiPresentation;
  currentSlide?: MentiSlide | null;
  activeSlideIndex?: number;
  sessionStatus?: "waiting" | "live" | "paused" | "finished" | "cancelled";
  onSubmitAnswer?: (answer: any) => void;
}

export function AudienceLayout({
  presentation,
  currentSlide: customCurrentSlide,
  activeSlideIndex = 0,
  sessionStatus = "live",
  onSubmitAnswer,
}: Props) {
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const rawSlide = customCurrentSlide || presentation.slides[activeSlideIndex] || presentation.slides[0];
  const currentSlide = rawSlide
    ? {
        ...rawSlide,
        id: rawSlide.id || (rawSlide as any)._id,
      }
    : null;

  const handleVoteSubmit = (val: any) => {
    setHasSubmitted(true);
    if (onSubmitAnswer) {
      onSubmitAnswer(val);
    }
  };

  const isLobby = sessionStatus === "waiting";
  const isEnded = sessionStatus === "finished" || sessionStatus === "cancelled";

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-(--cf-cream) text-(--cf-ink) select-none pb-8 relative">
      <Noise />

      {/* Mobile Top Header */}
      <header className="flex items-center justify-between w-full max-w-md px-5 py-3.5 bg-(--cf-cream-2) border-b border-(--cf-line-strong) z-10">
        <div className="flex items-center gap-2">
          <div className="size-2.5 bg-(--cf-orange) rounded-sm" />
          <h1 className="text-xs font-bold truncate max-w-[220px] text-(--cf-ink)">
            {presentation.title}
          </h1>
        </div>
        <span className="cf-meta text-[10px] font-bold text-(--cf-ink) bg-white px-2 py-0.5 rounded border border-(--cf-line)">
          PIN: {presentation.joinCode}
        </span>
      </header>

      {/* Main Question Card / Lobby Container */}
      <main className="flex-1 flex flex-col justify-center w-full max-w-md p-4 sm:p-6 z-10">
        <div className="cf-panel cf-raised p-6 bg-white border-2 border-(--cf-line-strong) rounded-2xl">
          {isEnded ? (
            <div className="flex flex-col items-center text-center py-10 space-y-4">
              <div className="size-12 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
                <XCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-(--cf-ink)">
                  Presentation Ended
                </h3>
                <p className="text-xs text-(--cf-ink-soft) max-w-xs leading-relaxed">
                  The host has ended this presentation. Thank you for participating!
                </p>
              </div>
              <a
                href="/menti/join"
                className="cf-btn cf-raised cf-press mt-2 px-5 py-2 text-xs font-bold rounded-lg border-2 border-(--cf-line-strong) bg-white text-(--cf-ink)"
              >
                Join another presentation
              </a>
            </div>
          ) : isLobby ? (
            <div className="flex flex-col items-center text-center py-10 space-y-4">
              <div className="size-12 rounded-full bg-(--cf-orange)/10 text-(--cf-orange) flex items-center justify-center animate-pulse">
                <div className="size-4 bg-(--cf-orange) rounded-full" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-(--cf-ink)">
                  You're in!
                </h3>
                <p className="text-xs text-(--cf-ink-soft) max-w-xs leading-relaxed">
                  Waiting for the host to start the presentation. The slide will appear automatically.
                </p>
              </div>
            </div>
          ) : currentSlide ? (
            <SlideAudienceInput
              slide={currentSlide}
              onSubmit={handleVoteSubmit}
              hasSubmitted={hasSubmitted}
            />
          ) : (
            <div className="text-center p-8 text-(--cf-ink-soft) text-sm">
              Waiting for presenter to show next slide...
            </div>
          )}
        </div>
      </main>

      {/* Bottom Floating Reaction Bar */}
      <footer className="flex items-center gap-3 p-1.5 bg-white border border-(--cf-line-strong) cf-raised rounded-full z-10">
        <button
          type="button"
          onClick={() => {}}
          className="p-2.5 text-(--cf-ink-soft) hover:text-(--cf-orange) hover:bg-(--cf-cream) rounded-full transition-transform active:scale-125"
          title="Thumbs up"
        >
          <ThumbsUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {}}
          className="p-2.5 text-(--cf-ink-soft) hover:text-rose-600 hover:bg-rose-50 rounded-full transition-transform active:scale-125"
          title="Heart"
        >
          <Heart className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {}}
          className="p-2.5 text-(--cf-ink-soft) hover:text-amber-600 hover:bg-amber-50 rounded-full transition-transform active:scale-125"
          title="Smile"
        >
          <Smile className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
}
