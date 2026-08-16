"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { MentiPresentation } from "~/lib/menti";
import { useMentiPresenter } from "~/hooks/useMentiPresenter";
import { SlideQuestionViewer } from "../questions/registry";
import { PresenterQRCodeCard } from "./PresenterQRCodeCard";
import { PresenterFloatingDock } from "./PresenterFloatingDock";
import { X, Copy, Clock, Percent } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  presentation: MentiPresentation;
}

export function PresenterLayout({ presentation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    currentSlide,
    currentSlideIndex,
    totalSlides,
    showQRCode,
    isVotingLocked,
    reactionsCount,
    nextSlide,
    prevSlide,
    toggleQRCode,
    toggleLock,
    sendReaction,
  } = useMentiPresenter(presentation);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col w-screen h-screen overflow-hidden bg-white select-none"
    >
      {/* 1. Top Controls Bar */}
      <div className="absolute top-4 left-6 right-6 z-20 flex items-center justify-between">
        {/* Exit Presentation */}
        <Link
          href={`/menti/${presentation.id}/edit`}
          className="p-2.5 text-neutral-500 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors shadow-sm"
          title="Exit presentation"
        >
          <X className="w-5 h-5" />
        </Link>

        {/* Branding Watermark */}
        <div className="flex items-center gap-2 opacity-50">
          <div className="w-3 h-3 bg-blue-600 rounded-sm" />
          <span className="text-sm font-bold tracking-tight text-neutral-900">CanvasFlow Menti</span>
        </div>
      </div>

      {/* 2. Left Mini Toolbar (Screenshot 3) */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 p-1.5 bg-white border border-neutral-200 rounded-2xl shadow-lg">
        <button className="p-2 text-neutral-400 hover:text-neutral-800 rounded-xl" title="Copy presentation link">
          <Copy className="w-4 h-4" />
        </button>
        <button className="p-2 text-neutral-400 hover:text-neutral-800 rounded-xl" title="Session time">
          <Clock className="w-4 h-4" />
        </button>
        <button className="p-2 text-neutral-400 hover:text-neutral-800 rounded-xl" title="Toggle percent">
          <Percent className="w-4 h-4" />
        </button>
      </div>

      {/* 3. Center Slide Visual Stage */}
      <main className="flex-1 flex items-center justify-center p-12 max-w-6xl w-full mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide?.id || currentSlideIndex}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full flex items-center justify-center"
          >
            {currentSlide && <SlideQuestionViewer slide={currentSlide} isPreview={false} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 4. Right QR Join Card */}
      {showQRCode && (
        <PresenterQRCodeCard
          joinCode={presentation.joinCode}
          totalResponded={currentSlide?.totalResponses || 2}
          totalExpected={presentation.participantCount}
          onClose={toggleQRCode}
        />
      )}

      {/* 5. Bottom Floating Dock */}
      <PresenterFloatingDock
        currentSlideIndex={currentSlideIndex}
        totalSlides={totalSlides}
        isVotingLocked={isVotingLocked}
        showQRCode={showQRCode}
        reactionsCount={reactionsCount}
        onNext={nextSlide}
        onPrev={prevSlide}
        onToggleQRCode={toggleQRCode}
        onToggleLock={toggleLock}
        onReaction={sendReaction}
        onToggleFullscreen={toggleFullscreen}
      />
    </div>
  );
}
