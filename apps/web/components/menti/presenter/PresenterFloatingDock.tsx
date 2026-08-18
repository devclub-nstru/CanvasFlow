"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Lock,
  Unlock,
  EyeOff,
  Eye,
  Percent,
  Hash,
} from "lucide-react";

interface Props {
  isIntro: boolean;
  currentStep: number;
  totalSteps: number;
  currentQuestionNumber: number;
  totalQuestions: number;
  isVotingLocked: boolean;
  showJoinCode: boolean;
  hideResults: boolean;
  showAsPercentage: boolean;
  onNext: () => void;
  onPrev: () => void;
  /** False while a quiz round is still accepting answers. */
  canGoNext?: boolean;
  onEndPresentation: () => void;
  onToggleJoinCode: () => void;
  onToggleLock: () => void;
  onToggleHideResults: () => void;
  onTogglePercentage: () => void;
}

export function PresenterFloatingDock({
  isIntro,
  currentStep,
  totalSteps,
  currentQuestionNumber,
  totalQuestions,
  isVotingLocked,
  showJoinCode,
  hideResults,
  showAsPercentage,
  onNext,
  onPrev,
  canGoNext = true,
  onEndPresentation,
  onToggleJoinCode,
  onToggleLock,
  onToggleHideResults,
  onTogglePercentage,
}: Props) {
  const isLastStep = currentStep >= totalSteps - 1;

  return (
    <>
      {/* 1. Bottom Left Segment: Prev Slide & Next/End Slide */}
      <div className="fixed bottom-6 left-6 z-30 flex items-center gap-2 select-none">
        {/* Previous Slide Button */}
        <button
          type="button"
          onClick={onPrev}
          disabled={currentStep === 0}
          className="size-10 flex items-center justify-center border-2 border-(--cf-line-strong) rounded-(--hex-radius) bg-white text-(--cf-ink) hover:bg-(--cf-ink) hover:text-(--cf-cream) cf-raised cf-press transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Previous slide (Left Arrow)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Next Slide (or End Presentation on Last Slide) */}
        {isLastStep ? (
          <button
            type="button"
            onClick={onEndPresentation}
            className="size-10 flex items-center justify-center border-2 border-(--cf-line-strong) rounded-(--hex-radius) bg-white text-(--cf-danger) hover:bg-(--cf-danger) hover:text-white cf-raised cf-press transition-colors"
            title="End presentation and return to editor"
          >
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={canGoNext === false}
            className="size-10 flex items-center justify-center border-2 border-(--cf-line-strong) rounded-(--hex-radius) bg-white text-(--cf-ink) hover:bg-(--cf-ink) hover:text-(--cf-cream) cf-raised cf-press transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title={
              canGoNext === false
                ? "Wait for the question timer to finish before moving on"
                : isIntro
                  ? "Start first question (Right Arrow or Space)"
                  : "Next question (Right Arrow or Space)"
            }
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Bottom Center Segment: Presentation Controls Bar (Reveals on Hover) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 select-none">
        <div className="flex items-center gap-2 p-1.5 bg-white rounded-(--hex-radius) border-2 border-(--cf-line-strong) cf-raised shadow-xl">
          {/* Slide Counter Badge */}
          <span className="cf-meta text-xs font-bold text-(--cf-ink) px-2 font-mono tabular-nums">
            {isIntro ? "INTRO" : `${currentQuestionNumber} / ${totalQuestions}`}
          </span>

          <div className="w-px h-5 bg-(--cf-line-strong) mx-0.5" />

          {/* Toggle Percentage / Absolute Votes */}
          {!isIntro && (
            <button
              type="button"
              onClick={onTogglePercentage}
              className={`size-7 flex items-center justify-center rounded-(--hex-radius) transition-colors ${
                showAsPercentage
                  ? "bg-(--cf-orange) text-white"
                  : "text-(--cf-ink-soft) hover:text-(--cf-ink) hover:bg-(--cf-cream)"
              }`}
              title="Toggle showing results as percentage (P)"
            >
              <Percent className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Hide/Show Results on projector */}
          {!isIntro && (
            <button
              type="button"
              onClick={onToggleHideResults}
              className={`size-7 flex items-center justify-center rounded-(--hex-radius) transition-colors ${
                hideResults
                  ? "bg-amber-500 text-white"
                  : "text-(--cf-ink-soft) hover:text-(--cf-ink) hover:bg-(--cf-cream)"
              }`}
              title={hideResults ? "Show results (H)" : "Hide results (H)"}
            >
              {hideResults ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Toggle Joining Code Header */}
          <button
            type="button"
            onClick={onToggleJoinCode}
            className={`size-7 flex items-center justify-center rounded-(--hex-radius) transition-colors ${
              showJoinCode
                ? "bg-(--cf-orange) text-white"
                : "text-(--cf-ink-soft) hover:text-(--cf-ink) hover:bg-(--cf-cream)"
            }`}
            title={showJoinCode ? "Hide joining code (C)" : "Show joining code (C)"}
          >
            <Hash className="w-3.5 h-3.5" />
          </button>

          {/* Lock Voting */}
          {!isIntro && (
            <button
              type="button"
              onClick={onToggleLock}
              className={`size-7 flex items-center justify-center rounded-(--hex-radius) transition-colors ${
                isVotingLocked
                  ? "bg-(--cf-danger) text-white"
                  : "text-(--cf-ink-soft) hover:text-(--cf-ink) hover:bg-(--cf-cream)"
              }`}
              title="Lock / Unlock voting (L)"
            >
              {isVotingLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
