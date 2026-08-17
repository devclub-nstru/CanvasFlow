"use client";

import React, { useState, useCallback } from "react";
import { MentiPresentation, MentiSlide } from "~/lib/menti";
import { SlideAudienceInput } from "../questions/registry";
import { AudienceLobbyView } from "./AudienceLobbyView";
import { ThumbsUp, Heart, Flame, Sparkles, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { VerticalScale } from "~/components/Scale";
import Noise from "~/components/Noise";

interface Props {
  presentation: MentiPresentation;
  currentSlide?: MentiSlide | null;
  activeSlideIndex?: number;
  sessionStatus?: "waiting" | "live" | "paused" | "finished" | "cancelled";
  participantCount?: number;
  submittedSlideIds?: string[];
  onSubmitAnswer?: (answer: any, slideId?: string) => Promise<any> | void;
}

interface ReactionParticle {
  id: string;
  startX: number;
  driftX: number;
  rotation: number;
  scale: number;
  duration: number;
}

export function AudienceLayout({
  presentation,
  currentSlide: customCurrentSlide,
  activeSlideIndex = 0,
  sessionStatus = "live",
  participantCount = 1,
  submittedSlideIds = [],
  onSubmitAnswer,
}: Props) {
  const [localSubmittedSlideIds, setLocalSubmittedSlideIds] = useState<string[]>([]);
  const [particles, setParticles] = useState<ReactionParticle[]>([]);

  const isLobby = sessionStatus === "waiting";
  const isEnded = sessionStatus === "finished" || sessionStatus === "cancelled";

  const totalSlides = Math.max(1, presentation.slides.length);
  const currentSlideNum = Math.min(totalSlides, activeSlideIndex + 1);
  const progressPercent = isEnded
    ? 100
    : isLobby
    ? 0
    : Math.min(100, Math.max(0, (currentSlideNum / totalSlides) * 100));

  const rawSlide = customCurrentSlide || presentation.slides[activeSlideIndex] || presentation.slides[0];
  const currentSlide = rawSlide
    ? {
        ...rawSlide,
        id: rawSlide.id || (rawSlide as any)._id,
      }
    : null;

  const currentSlideId = currentSlide?.id ? String(currentSlide.id) : null;
  const isCurrentSlideSubmitted = Boolean(
    currentSlideId &&
      (submittedSlideIds.some((id) => String(id) === currentSlideId) ||
        localSubmittedSlideIds.some((id) => String(id) === currentSlideId))
  );

  const handleVoteSubmit = async (val: any) => {
    if (!currentSlideId) return;
    setLocalSubmittedSlideIds((prev) =>
      prev.includes(currentSlideId) ? prev : [...prev, currentSlideId]
    );
    if (onSubmitAnswer) {
      try {
        await onSubmitAnswer(val, currentSlideId);
      } catch (err) {
        console.error("Submission response error:", err);
      }
    }
  };

  const triggerThumbsUp = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = rect.left + rect.width / 2;

    const newParticle: ReactionParticle = {
      id: `${Date.now()}-${Math.random()}`,
      startX: clickX + (Math.random() - 0.5) * 8,
      driftX: (Math.random() - 0.5) * 60,
      rotation: (Math.random() - 0.5) * 24,
      scale: 1 + Math.random() * 0.15,
      duration: 1.3,
    };

    setParticles((prev) => [...prev.slice(-15), newParticle]);

    // Clean up expired particle
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
    }, 1400);
  }, []);

  return (
    <div className="relative flex flex-col justify-between min-h-screen min-h-[100dvh] w-full bg-(--cf-cream) text-(--cf-ink) select-none overflow-x-hidden font-sans pb-4 sm:pb-6">
      <Noise />

      {/* Decorative Side Rails (Matching Landing & Presenter Layout) */}
      <div className="pointer-events-none absolute inset-0 hidden md:block z-0">
        <VerticalScale className="absolute inset-y-0 left-0 w-8 2xl:w-10 opacity-70" />
        <VerticalScale className="absolute inset-y-0 right-0 w-8 2xl:w-10 opacity-70" />
      </div>

      {/* Floating Animated Thumbs Up Particle */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <AnimatePresence>
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              initial={{
                opacity: 1,
                scale: 0.5,
                x: particle.startX,
                y: typeof window !== "undefined" ? window.innerHeight - 80 : 600,
                rotate: 0,
              }}
              animate={{
                opacity: [1, 1, 0.9, 0],
                scale: [0.5, particle.scale * 1.2, particle.scale, particle.scale * 0.85],
                x: particle.startX + particle.driftX,
                y:
                  typeof window !== "undefined"
                    ? window.innerHeight - 440 - Math.random() * 60
                    : 200,
                rotate: particle.rotation,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: particle.duration,
                ease: [0.21, 0.61, 0.35, 1],
              }}
              className="absolute -translate-x-1/2 select-none"
            >
              <div className="p-3 rounded-full bg-white border-2 border-(--cf-line-strong) cf-raised shadow-xl flex items-center justify-center">
                <ThumbsUp className="w-5 h-5 text-(--cf-orange) fill-(--cf-orange)" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 1. Minimal Top Header (Following Edit Page Design Language) */}
      <header className="relative z-20 flex flex-col w-full border-b border-(--cf-line-strong) bg-(--cf-cream-2)">
        <div className="flex items-center justify-between h-12 sm:h-13 px-4 sm:px-6 w-full max-w-5xl mx-auto">
          {/* Left: Indicator + Form/Presentation Title */}
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            <div className="size-2.5 bg-(--cf-orange) rounded-xs shrink-0" />
            <span className="font-bold text-xs sm:text-sm text-(--cf-ink) truncate max-w-[220px] sm:max-w-md">
              {presentation.title || "Untitled presentation"}
            </span>
          </div>

          {/* Right: Slide Counter & PIN Badge */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="cf-meta text-[11px] font-mono font-bold text-(--cf-ink-soft)">
              {isEnded ? "ENDED" : isLobby ? "LOBBY" : `${currentSlideNum} / ${totalSlides}`}
            </span>
            <span className="cf-meta text-[11px] font-mono font-bold text-(--cf-ink) bg-white px-2 sm:px-2.5 py-0.5 rounded border border-(--cf-line-strong) shadow-2xs">
              PIN: {presentation.joinCode}
            </span>
          </div>
        </div>

        {/* Minimal Animated Slide Progress Bar */}
        <div className="w-full h-1 bg-(--cf-line)/40 relative overflow-hidden">
          <motion.div
            className="h-full bg-(--cf-orange)"
            initial={false}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
      </header>

      {/* 2. Main Question Card / Lobby Container */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-3.5 sm:px-6 py-4 sm:py-6 w-full max-w-lg mx-auto my-auto min-h-0">
        <div className="cf-panel cf-raised w-full p-4 sm:p-7 bg-white border-2 border-(--cf-line-strong) rounded-2xl sm:rounded-3xl shadow-xl animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[calc(100dvh-150px)]">
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
            <AudienceLobbyView participantCount={participantCount} />
          ) : currentSlide ? (
            <SlideAudienceInput
              key={currentSlide.id}
              slide={currentSlide}
              onSubmit={handleVoteSubmit}
              hasSubmitted={isCurrentSlideSubmitted}
            />
          ) : (
            <div className="text-center p-6 sm:p-8 text-(--cf-ink-soft) text-xs sm:text-sm font-medium">
              Waiting for presenter to show next slide...
            </div>
          )}
        </div>
      </main>

      {/* 3. Bottom Minimalist Floating Reaction Button */}
      {!isEnded && (
        <footer className="relative z-20 flex flex-col items-center gap-1 shrink-0 pt-1">
          <motion.button
            whileTap={{ scale: 1.25 }}
            whileHover={{ scale: 1.06 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            type="button"
            onClick={triggerThumbsUp}
            className="cf-panel cf-raised cf-press p-3 sm:p-3.5 bg-white border-2 border-(--cf-line-strong) rounded-full shadow-xl flex items-center justify-center text-(--cf-ink) hover:text-(--cf-orange) hover:border-(--cf-orange) transition-colors"
            title="Send Thumbs Up"
            aria-label="Send Thumbs Up"
          >
            <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5 text-(--cf-orange)" />
          </motion.button>
          <span className="cf-meta text-[9px] font-bold uppercase tracking-wider text-(--cf-ink-soft) select-none">
            Send reaction
          </span>
        </footer>
      )}
    </div>
  );
}
