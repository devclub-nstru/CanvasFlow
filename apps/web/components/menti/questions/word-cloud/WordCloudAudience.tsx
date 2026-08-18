"use client";

import React, { useEffect, useRef, useState } from "react";
import { MentiSlide } from "~/lib/menti";
import { Send, CheckCircle2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  slide: MentiSlide;
  onSubmit: (words: string[]) => void;
  hasSubmitted?: boolean;
}

const MAX_LENGTH = 40;

export function WordCloudAudience({ slide, onSubmit, hasSubmitted }: Props) {
  const isInfinite = Boolean(
    slide.responseSettings?.multipleSubmissions === true ||
      slide.responseSettings?.maxEntriesPerParticipant === 0,
  );

  const [currentWord, setCurrentWord] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset everything when the host moves to a different slide.
  useEffect(() => {
    setCurrentWord("");
    setSent([]);
    setNotice(null);
  }, [slide.id]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 1600);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = currentWord.trim().replace(/\s+/g, " ");
    if (!trimmed) return;

    if (sent.some((word) => word.toLowerCase() === trimmed.toLowerCase())) {
      setNotice("You already sent that word");
      return;
    }

    onSubmit([trimmed]);
    setSent((prev) => [trimmed, ...prev]);
    setCurrentWord("");

    // Keep the keyboard up so repeat entries stay fast on mobile.
    if (isInfinite) inputRef.current?.focus();
  };

  if (!isInfinite && hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center select-none animate-in fade-in zoom-in-95 duration-200">
        <div className="flex size-14 items-center justify-center rounded-full border-2 border-(--cf-line-strong) bg-(--cf-cream) cf-raised">
          <CheckCircle2 className="h-7 w-7 text-(--cf-orange)" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold tracking-[-0.03em] text-(--cf-ink) sm:text-xl">
            Response Submitted!
          </h3>
          <p className="mx-auto max-w-xs text-xs leading-relaxed text-(--cf-ink-soft) sm:text-sm">
            Please wait for the presenter to move to the next question…
          </p>
        </div>
        {sent.length > 0 && (
          <div className="rounded-(--hex-radius) border-2 border-(--cf-line-strong) bg-white px-3 py-1.5 text-sm font-bold text-(--cf-ink)">
            {sent[0]}
          </div>
        )}
      </div>
    );
  }

  const isValid = currentWord.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col space-y-4 select-none">
      <div className="space-y-1">
        <h2 className="text-base font-bold leading-snug tracking-[-0.03em] text-(--cf-ink) sm:text-lg md:text-xl">
          {slide.question || "What word comes to mind?"}
        </h2>
        <div className="flex items-center gap-1.5 text-xs text-(--cf-ink-soft)">
          <span>
            {isInfinite
              ? "Send as many words as you like"
              : "Enter your answer below"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="text"
          value={currentWord}
          onChange={(e) => setCurrentWord(e.target.value)}
          placeholder="Type a word or short phrase…"
          maxLength={MAX_LENGTH}
          autoFocus
          autoComplete="off"
          enterKeyHint="send"
          className="w-full rounded-xl border-2 border-neutral-200 bg-white p-3.5 text-base font-medium text-(--cf-ink) shadow-inner outline-none transition placeholder:text-(--cf-ink-soft) focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)/20"
        />
        <div className="flex items-center justify-between px-1 text-[11px] text-(--cf-ink-soft)">
          <AnimatePresence mode="wait">
            {notice ? (
              <motion.span
                key={notice}
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="font-bold text-(--cf-orange)"
              >
                {notice}
              </motion.span>
            ) : (
              <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                Max {MAX_LENGTH} characters
              </motion.span>
            )}
          </AnimatePresence>
          <span className="tabular-nums">
            {currentWord.length}/{MAX_LENGTH}
          </span>
        </div>
      </div>

      <div className="pt-1">
        <button
          type="submit"
          disabled={!isValid}
          className="cf-btn cf-raised cf-press flex min-h-[48px] w-full items-center justify-center gap-2 rounded-(--hex-radius) py-3.5 text-sm font-bold shadow-md disabled:pointer-events-none disabled:opacity-40 sm:py-4 sm:text-base"
        >
          {isInfinite && sent.length > 0 ? (
            <>
              <Plus className="mr-0.5 h-4 w-4" />
              Send Another Word
            </>
          ) : (
            <>
              <Send className="mr-1 h-4 w-4" />
              Submit Word
            </>
          )}
        </button>
      </div>

      {/* Everything this participant has contributed to the cloud so far. */}
      {isInfinite && sent.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-0.5">
            <span className="font-mono text-[10px] font-bold tracking-wider uppercase text-(--cf-ink-soft)">
              Your words
            </span>
            <span className="font-mono text-[10px] font-bold text-(--cf-ink-soft) tabular-nums">
              {sent.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {sent.map((word) => (
                <motion.span
                  key={word.toLowerCase()}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="rounded-full border-2 border-(--cf-line-strong) bg-(--cf-cream) px-2.5 py-1 text-xs font-bold text-(--cf-ink)"
                >
                  {word}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </form>
  );
}
