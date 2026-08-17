"use client";

import React, { useState, useEffect } from "react";
import { MentiSlide } from "~/lib/menti";
import { Send, CheckCircle2, Sparkles, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  slide: MentiSlide;
  onSubmit: (words: string[]) => void;
  hasSubmitted?: boolean;
}

export function WordCloudAudience({ slide, onSubmit, hasSubmitted }: Props) {
  const isInfinite = Boolean(
    slide.responseSettings.multipleSubmissions === true ||
      slide.responseSettings.maxEntriesPerParticipant === 0
  );

  const [currentWord, setCurrentWord] = useState("");
  const [submittedWords, setSubmittedWords] = useState<string[]>([]);
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);

  // Reset local state when slide ID changes
  useEffect(() => {
    setCurrentWord("");
    setSubmittedWords([]);
    setLastSubmitted(null);
  }, [slide.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = currentWord.trim();
    if (!trimmed) return;

    onSubmit([trimmed]);
    setSubmittedWords((prev) => [...prev, trimmed]);
    setLastSubmitted(trimmed);
    setCurrentWord("");

    // Clear confirmation flash after 3 seconds
    setTimeout(() => {
      setLastSubmitted((prev) => (prev === trimmed ? null : prev));
    }, 3000);
  };

  // If single response mode and already submitted, show waiting screen
  if (!isInfinite && hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200 select-none">
        <div className="size-14 rounded-full bg-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-(--cf-orange)" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg sm:text-xl font-bold tracking-[-0.03em] text-(--cf-ink)">
            Response Submitted!
          </h3>
          <p className="text-xs sm:text-sm text-(--cf-ink-soft) max-w-xs mx-auto leading-relaxed">
            Please wait for the presenter to move to the next question...
          </p>
        </div>
      </div>
    );
  }

  const isValid = currentWord.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col w-full space-y-4 select-none"
    >
      {/* 1. Question Header */}
      <div className="space-y-1">
        <h2 className="text-base sm:text-lg md:text-xl font-bold leading-snug tracking-[-0.03em] text-(--cf-ink)">
          {slide.question || "What word comes to mind?"}
        </h2>
        <div className="flex items-center gap-1.5 text-xs text-(--cf-ink-soft)">
          {isInfinite ? (
            <span className="inline-flex items-center gap-1 text-(--cf-orange) font-semibold">
              <Sparkles className="size-3" />
              <span>Unlimited responses enabled — submit as many words as you like!</span>
            </span>
          ) : (
            <span>Enter your word or phrase below</span>
          )}
        </div>
      </div>

      {/* 2. Success Banner Flash on Infinite Submissions */}
      <AnimatePresence>
        {isInfinite && lastSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-800 shadow-sm"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <span>
                Added <strong className="font-bold">&ldquo;{lastSubmitted}&rdquo;</strong> to the word cloud!
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-600 font-bold">
              {submittedWords.length} sent
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Single Clean Input Field */}
      <div className="space-y-2">
        <input
          type="text"
          value={currentWord}
          onChange={(e) => setCurrentWord(e.target.value)}
          placeholder="Type a word or short phrase..."
          maxLength={40}
          autoFocus
          className="w-full p-3.5 text-sm sm:text-base bg-white border-2 border-neutral-200 rounded-xl text-(--cf-ink) placeholder:text-(--cf-ink-soft) outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)/20 font-medium shadow-inner"
        />
        <div className="flex justify-between items-center px-1 text-[11px] text-(--cf-ink-soft)">
          <span>Max 40 characters</span>
          <span>{currentWord.length}/40</span>
        </div>
      </div>

      {/* 4. Action Button */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={!isValid}
          className="cf-btn cf-raised cf-press flex items-center justify-center w-full py-3.5 px-4 text-xs sm:text-sm font-bold rounded-(--hex-radius) gap-2 disabled:opacity-40 disabled:pointer-events-none shadow-md"
        >
          {isInfinite && submittedWords.length > 0 ? (
            <>
              <Plus className="w-4 h-4 mr-0.5" />
              Submit Another Word
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-1" />
              Submit Word
            </>
          )}
        </button>
      </div>

      {/* 5. Audience Submitted Words Cloud/Tags (When Infinite Mode) */}
      {isInfinite && submittedWords.length > 0 && (
        <div className="pt-3 border-t border-(--cf-line) space-y-2">
          <div className="flex items-center justify-between text-xs text-(--cf-ink-soft)">
            <span className="font-semibold">Your contributed words ({submittedWords.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {submittedWords.map((word, i) => (
              <span
                key={i}
                className="px-2.5 py-1 text-xs bg-(--cf-cream) border border-(--cf-line-strong) rounded-lg font-medium text-(--cf-ink) flex items-center gap-1 shadow-2xs"
              >
                <span>{word}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
