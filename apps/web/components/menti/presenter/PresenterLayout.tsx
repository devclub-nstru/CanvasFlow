"use client";

import React, { useRef, useState, useEffect } from "react";
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
  AlertTriangle,
  Copy,
  Check,
  Users,
} from "lucide-react";
import { VerticalScale } from "~/components/Scale";
import { motion, AnimatePresence } from "motion/react";

import { useMentiRealtime } from "~/hooks/useMentiRealtime";
import { readTiming, roundClosesAt, timerForDisplayedSlide } from "~/lib/quiz";

interface Props {
  presentation: MentiPresentation;
  sessionId?: string;
}

export function PresenterLayout({ presentation, sessionId = "" }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConfirmEndModal, setShowConfirmEndModal] = useState(false);
  const [headerCopied, setHeaderCopied] = useState(false);

  /*
   * Forward navigation is refused while a quiz round is running, so the host
   * cannot skip past a question participants are still answering. Held in a ref
   * because the flag derives from the active slide, which only exists after
   * useMentiPresenter has run.
   */
  const forwardLockedRef = useRef(false);

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
  } = useMentiPresenter(presentation, {
    canAdvance: () => !forwardLockedRef.current,
  });

  // Connect Host to WebSocket store
  const {
    sessionState,
    slideAnalyticsMap,
    serverOffsetMs,
    changeSlide,
    changeSessionStatus,
  } = useMentiRealtime({
    sessionId,
    isHost: true,
    disabled: !sessionId,
  });

  const rawCode = sessionState?.session?.code || presentation.joinCode || "";
  const activeJoinCode = rawCode
    ? rawCode
        .replace(/\s+/g, "")
        .replace(/(.{3})/g, "$1 ")
        .trim()
    : "----";

  const handleCopyHeaderCode = () => {
    if (!activeJoinCode) return;
    const cleanCode = activeJoinCode.replace(/\s+/g, "");
    navigator.clipboard.writeText(cleanCode);
    setHeaderCopied(true);
    setTimeout(() => setHeaderCopied(false), 2000);
  };

  // Track whether the session has ever gone live in this page load so that
  // navigating back to the intro screen doesn't revert participants to "waiting".
  const hasGoneLiveRef = useRef(false);

  // Sync active slide change with WebSocket server when host navigates
  useEffect(() => {
    if (!isIntro && currentSlide?.id && sessionId) {
      hasGoneLiveRef.current = true;
      changeSlide(currentSlide.id);
      changeSessionStatus("live");
    } else if (isIntro && sessionId && !hasGoneLiveRef.current) {
      // Only send "waiting" before the session has started — never regress from live.
      changeSessionStatus("waiting");
    }
  }, [currentStep, isIntro, currentSlide?.id, sessionId, changeSlide, changeSessionStatus]);

  const participantCount = sessionState?.participantCount ?? presentation.participantCount ?? 0;

  /*
   * Only trust the question timer when the server agrees which slide is active.
   *
   * Navigation is optimistic locally, so for a moment after advancing, the
   * displayed slide is the new one while `questionStartedAt` still describes the
   * PREVIOUS question. If that one had finished, the new quiz slide would
   * compute as "ended" and flash its correct answer on the big screen. Treating
   * a mismatch as "not started" closes that window.
   */
  const activeQuestionStartedAt = timerForDisplayedSlide(
    sessionState?.session?.currentSlideId,
    currentSlide?.id,
    sessionState?.session?.questionStartedAt,
  );

  /*
   * Whether a quiz round is still accepting answers.
   *
   * Derived with a single timeout at the round's end rather than a ticking
   * clock — polling here would re-render the whole presenter every 100ms and
   * fight the animations on screen.
   */
  const [isQuizRoundActive, setIsQuizRoundActive] = useState(false);

  useEffect(() => {
    if (currentSlide?.type !== "QUIZ" || !activeQuestionStartedAt) {
      setIsQuizRoundActive(false);
      return;
    }

    const timing = readTiming(currentSlide.responseSettings);
    const closesAt = roundClosesAt(activeQuestionStartedAt, timing);
    if (closesAt === null) {
      setIsQuizRoundActive(false);
      return;
    }

    const msLeft = closesAt - (Date.now() + serverOffsetMs);

    if (msLeft <= 0) {
      setIsQuizRoundActive(false);
      return;
    }

    setIsQuizRoundActive(true);
    const timer = setTimeout(() => setIsQuizRoundActive(false), msLeft);
    return () => clearTimeout(timer);
  }, [
    currentSlide?.type,
    currentSlide?.responseSettings,
    activeQuestionStartedAt,
    serverOffsetMs,
  ]);

  // Written during render on purpose: it is only read from event handlers, and
  // an effect would leave a frame in which the lock had not taken hold yet.
  forwardLockedRef.current = isQuizRoundActive;

  const [hideResults, setHideResults] = useState(
    currentSlide?.responseSettings?.hideResultsFromAudience ?? false,
  );
  const [showAsPercentage, setShowAsPercentage] = useState(
    currentSlide?.responseSettings?.showResultsAsPercentage ?? false,
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
      containerRef.current
        ?.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
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
    setShowConfirmEndModal(true);
  };

  const handleConfirmEndPresentation = async () => {
    try {
      await changeSessionStatus("finished");
    } catch (err) {
      console.error("Failed to close session:", err);
    }
    router.push(`/menti/${presentation.id}/edit`);
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
          <button
            type="button"
            onClick={() => setShowConfirmEndModal(true)}
            className="size-9 flex items-center justify-center p-0 rounded-(--hex-radius) bg-white text-(--cf-ink) hover:bg-rose-600 hover:text-white border-2 border-(--cf-line-strong) cf-raised cf-press transition-colors"
            title="Exit presentation"
          >
            <X className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="size-9 flex items-center justify-center p-0 rounded-(--hex-radius) bg-white text-(--cf-ink) hover:bg-(--cf-ink) hover:text-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised cf-press transition-colors"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Top-Right Cluster: Branding + Slide Grid View Toggle */}
        <div className="flex items-center gap-2.5 pointer-events-auto opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
          <div className="px-3 py-1.5 bg-white border-2 border-(--cf-line-strong) cf-raised rounded-(--hex-radius) flex items-center gap-2">
            <div className="size-3.5 bg-(--cf-orange) rounded-xs" />
            <span className="cf-meta text-[11px] font-bold text-(--cf-ink)">CanvasFlow Menti</span>
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

      {/* 2. Top-Middle: Absolutely Centered & Clickable Join Code */}
      {!isIntro && (
        <div className="absolute top-4 sm:top-5 left-0 right-0 z-20 pointer-events-none flex items-center justify-center">
          <AnimatePresence>
            {showJoinCode && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-auto"
              >
                <button
                  type="button"
                  onClick={handleCopyHeaderCode}
                  className="flex items-center gap-3 sm:gap-4 select-none text-center px-4 sm:px-5 py-2 rounded-full bg-white border-2 border-(--cf-line-strong) shadow-sm cursor-pointer group"
                  title="Click to copy code"
                >
                  <span className="text-sm sm:text-base md:text-lg font-medium text-(--cf-ink-soft) tracking-tight">
                    Join at{" "}
                    <strong className="text-(--cf-ink) font-bold underline underline-offset-4 decoration-2 decoration-(--cf-orange)">
                      canvasflow.dittya.dev/menti/join
                    </strong>
                  </span>
                  <span className="text-sm sm:text-base text-(--cf-ink-soft)">•</span>
                  <span className="text-sm sm:text-base md:text-lg font-medium text-(--cf-ink-soft) flex items-center gap-1.5">
                    Code:{" "}
                    <span className="text-lg sm:text-xl md:text-2xl font-black text-(--cf-ink) font-mono tracking-widest pl-1">
                      {headerCopied ? "COPIED!" : activeJoinCode}
                    </span>
                    {headerCopied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-(--cf-ink-soft) group-hover:text-(--cf-orange)" />
                    )}
                  </span>
                </button>
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
                  joinCode={activeJoinCode}
                  participantCount={participantCount}
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
                    // Keyed strictly by slide: the shared `slideAnalytics` value
                    // holds whichever payload arrived last, which could belong
                    // to a different slide and drive this one's animation.
                    analytics={slideAnalyticsMap[currentSlide.id]}
                    isPreview={false}
                    hideResults={hideResults}
                    showAsPercentage={showAsPercentage}
                    questionStartedAt={activeQuestionStartedAt}
                    serverOffsetMs={serverOffsetMs}
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
        canGoNext={!isQuizRoundActive}
        onEndPresentation={handleEndPresentation}
        onToggleJoinCode={toggleJoinCode}
        onToggleLock={toggleLock}
        onToggleHideResults={() => setHideResults((prev) => !prev)}
        onTogglePercentage={() => setShowAsPercentage((prev) => !prev)}
      />

      {/* 4. Bottom-Right Live Participant Count Badge */}
      <div className="absolute bottom-4 sm:bottom-5 right-5 sm:right-6 z-30 pointer-events-auto">
        <div
          className="px-3.5 py-1.5 bg-white border-2 border-(--cf-line-strong) cf-raised rounded-full flex items-center gap-2 shadow-md"
          title="Live connected participants"
        >
          <Users className="w-4 h-4 text-(--cf-orange)" />
          <span className="text-xs sm:text-sm font-black font-mono text-(--cf-ink) tabular-nums">
            {participantCount}
          </span>
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* 5. End Presentation Confirmation Modal */}
      {showConfirmEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="cf-panel cf-raised max-w-sm w-full p-6 bg-white border-2 border-(--cf-line-strong) rounded-2xl space-y-4 text-center shadow-2xl z-50">
            <div className="size-12 mx-auto rounded-full bg-rose-50 border-2 border-rose-200 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-(--cf-ink)">End presentation?</h3>
              <p className="text-xs text-(--cf-ink-soft) leading-relaxed">
                Are you sure you want to end this presentation? This will close the session
                instantly and disconnect all connected participants.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmEndModal(false)}
                className="cf-btn-outline flex-1 py-2.5 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEndPresentation}
                className="cf-btn cf-raised cf-press flex-1 py-2.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white border-2 border-(--cf-line-strong)"
              >
                End presentation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
