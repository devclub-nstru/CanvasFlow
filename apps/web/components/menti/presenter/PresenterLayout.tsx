"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MentiPresentation } from "~/lib/menti";
import { useMentiPresenter } from "~/hooks/useMentiPresenter";
import { SlideQuestionViewer } from "../questions/registry";
import { PresenterIntroStage } from "./PresenterIntroStage";
import { PresenterFloatingDock } from "./PresenterFloatingDock";
import Noise from "~/components/Noise";
import {
  X,
  Maximize2,
  Minimize2,
  LayoutGrid,
  QrCode,
} from "lucide-react";
import { VerticalScale } from "~/components/Scale";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  presentation: MentiPresentation;
}

export function PresenterLayout({ presentation }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    isIntro,
    currentStep,
    totalSteps,
    currentSlide,
    currentSlideIndex,
    totalQuestions,
    showJoinCode,
    isVotingLocked,
    nextStep,
    prevStep,
    toggleJoinCode,
    toggleLock,
  } = useMentiPresenter(presentation);

  const [hideResults, setHideResults] = useState(
    currentSlide?.responseSettings?.hideResultsFromAudience ?? false
  );
  const [showAsPercentage, setShowAsPercentage] = useState(
    currentSlide?.responseSettings?.showResultsAsPercentage ?? false
  );

  // Sync state whenever active slide changes
  useEffect(() => {
    if (!isIntro && currentSlide?.responseSettings) {
      setHideResults(currentSlide.responseSettings.hideResultsFromAudience ?? false);
      setShowAsPercentage(currentSlide.responseSettings.showResultsAsPercentage ?? false);
    }
  }, [currentStep, isIntro, currentSlide?.responseSettings]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keyboard shortcut listener for H (hide results) and P (percentage)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "h" || e.key === "H") {
        setHideResults((prev) => !prev);
      } else if (e.key === "p" || e.key === "P" || e.key === "%") {
        setShowAsPercentage((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleEndPresentation = () => {
    router.push(`/menti/${presentation.id}/results`);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col w-screen h-screen overflow-hidden bg-(--cf-cream) select-none text-(--cf-ink) font-sans"
    >
      <Noise />

      {/* Decorative Neo-Editorial Vertical Scale Side Borders (Matching Landing Page) */}
      <div className="pointer-events-none absolute inset-0 hidden xl:block z-0">
        <VerticalScale className="absolute inset-y-0 left-0 w-8 2xl:w-10 opacity-70" />
        <VerticalScale className="absolute inset-y-0 right-0 w-8 2xl:w-10 opacity-70" />
      </div>

      {/* 1. Top Controls Bar */}
      <div className="absolute top-5 left-6 right-6 z-20 flex items-center justify-between pointer-events-none">
        {/* Top-Left Cluster: Exit + Fullscreen (Reveals on Hover) */}
        <div className="flex items-center gap-2 pointer-events-auto opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
          <Link
            href={`/menti/${presentation.id}/edit`}
            className="size-9 flex items-center justify-center p-0 rounded-(--hex-radius) bg-white text-(--cf-ink) hover:bg-(--cf-ink) hover:text-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised cf-press transition-colors"
            title="Exit presentation"
          >
            <X className="w-4 h-4" />
          </Link>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="size-9 flex items-center justify-center p-0 rounded-(--hex-radius) bg-white text-(--cf-ink) hover:bg-(--cf-ink) hover:text-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised cf-press transition-colors"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Top-Right Cluster: Branding + Slide Grid View Toggle */}
        <div className="flex items-center gap-2.5 pointer-events-auto opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
          <div className="px-3 py-1.5 bg-white border-2 border-(--cf-line-strong) cf-raised rounded-(--hex-radius) flex items-center gap-2">
            <div className="size-3.5 bg-(--cf-orange) rounded-xs" />
            <span className="cf-meta text-[11px] font-bold text-(--cf-ink)">
              CanvasFlow Menti
            </span>
          </div>

          <button
            type="button"
            onClick={() => {}}
            className="size-9 flex items-center justify-center p-0 rounded-(--hex-radius) bg-white text-(--cf-ink) hover:bg-(--cf-ink) hover:text-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised cf-press transition-colors"
            title="Slide overview grid"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Top-Middle: Absolutely Centered & Prominent Join Code */}
      {!isIntro && (
        <div className="absolute top-4 sm:top-5 left-0 right-0 z-20 pointer-events-none flex items-center justify-center">
          <AnimatePresence>
            {showJoinCode && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-3 sm:gap-4 select-none text-center"
              >
                <span className="text-base sm:text-lg md:text-xl font-medium text-(--cf-ink-soft) tracking-tight">
                  Join at{" "}
                  <strong className="text-(--cf-ink) font-bold underline underline-offset-4 decoration-2 decoration-(--cf-orange)">
                    menti.com
                  </strong>
                </span>
                <span className="text-base sm:text-lg text-(--cf-ink-soft)">•</span>
                <span className="text-base sm:text-lg md:text-xl font-medium text-(--cf-ink-soft)">
                  Code:{" "}
                  <span className="text-xl sm:text-2xl md:text-3xl font-black text-(--cf-ink) font-mono tracking-widest pl-1.5">
                    {presentation.joinCode}
                  </span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 2. Center Presentation Stage (16:9 Canvas Stage, Maximized with Comfortable Top Clearance) */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-8 md:px-12 pt-16 sm:pt-20 pb-14 w-full max-w-[94vw] 2xl:max-w-[1550px] mx-auto z-10">
        <div className="w-full aspect-[16/9] max-h-[80vh] bg-white rounded-2xl border-2 border-(--cf-line-strong) cf-raised overflow-hidden relative flex items-center justify-center">
          <AnimatePresence mode="wait">
            {isIntro ? (
              <motion.div
                key="intro-stage"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full"
              >
                <PresenterIntroStage
                  title={presentation.title}
                  joinCode={presentation.joinCode}
                  participantCount={presentation.participantCount}
                  onStart={nextStep}
                />
              </motion.div>
            ) : (
              <motion.div
                key={currentSlide?.id || currentSlideIndex}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full flex items-center justify-center p-6 sm:p-10"
              >
                {currentSlide && (
                  <SlideQuestionViewer
                    slide={currentSlide}
                    isPreview={false}
                    hideResults={hideResults}
                    showAsPercentage={showAsPercentage}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* 3. Bottom Floating Dock */}
      <PresenterFloatingDock
        isIntro={isIntro}
        currentStep={currentStep}
        totalSteps={totalSteps}
        currentQuestionNumber={currentSlideIndex + 1}
        totalQuestions={totalQuestions}
        isVotingLocked={isVotingLocked}
        showJoinCode={showJoinCode}
        hideResults={hideResults}
        showAsPercentage={showAsPercentage}
        onNext={nextStep}
        onPrev={prevStep}
        onEndPresentation={handleEndPresentation}
        onToggleJoinCode={toggleJoinCode}
        onToggleLock={toggleLock}
        onToggleHideResults={() => setHideResults((prev) => !prev)}
        onTogglePercentage={() => setShowAsPercentage((prev) => !prev)}
      />
    </div>
  );
}
