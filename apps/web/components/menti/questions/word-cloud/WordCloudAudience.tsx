"use client";

import React, { useState } from "react";
import { MentiSlide } from "~/lib/menti";
import { Send, CheckCircle2 } from "lucide-react";

interface Props {
  slide: MentiSlide;
  onSubmit: (words: string[]) => void;
  hasSubmitted?: boolean;
}

export function WordCloudAudience({ slide, onSubmit, hasSubmitted }: Props) {
  const maxEntries = slide.responseSettings.maxEntriesPerParticipant ?? 1;
  const [words, setWords] = useState<string[]>(Array(maxEntries).fill(""));

  const updateWord = (idx: number, val: string) => {
    const next = [...words];
    next[idx] = val;
    setWords(next);
  };

  if (hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="size-14 rounded-full bg-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7 text-(--cf-orange)" />
        </div>
        <h3 className="text-lg font-bold tracking-[-0.03em] text-(--cf-ink)">Response Submitted!</h3>
        <p className="mt-1 text-xs text-(--cf-ink-soft)">
          Look at the big screen to see the word cloud evolve.
        </p>
      </div>
    );
  }

  const validWords = words.map((w) => w.trim()).filter((w) => w.length > 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (validWords.length > 0) onSubmit(validWords);
      }}
      className="flex flex-col w-full space-y-4"
    >
      {/* Question header – matches BarGraphAudience style */}
      <div className="space-y-0.5">
        <h2 className="text-lg font-bold leading-snug tracking-[-0.03em] text-(--cf-ink)">
          {slide.question}
        </h2>
        <p className="text-xs text-(--cf-ink-soft)">
          {maxEntries === 1
            ? "Enter your word or phrase below"
            : `Enter up to ${maxEntries} words`}
        </p>
      </div>

      {/* Input fields */}
      <div className="space-y-2">
        {maxEntries === 1 ? (
          <textarea
            value={words[0] || ""}
            onChange={(e) => updateWord(0, e.target.value)}
            placeholder="Type a word or phrase..."
            rows={3}
            maxLength={100}
            required
            className="w-full p-3.5 text-sm bg-white border-2 border-neutral-200 rounded-xl text-(--cf-ink) placeholder:text-(--cf-ink-soft) outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)/20 resize-none"
          />
        ) : (
          words.map((word, idx) => (
            <input
              key={idx}
              type="text"
              value={word}
              onChange={(e) => updateWord(idx, e.target.value)}
              placeholder={`Word #${idx + 1}...`}
              maxLength={30}
              className="w-full p-3 text-sm bg-white border-2 border-neutral-200 rounded-xl text-(--cf-ink) placeholder:text-(--cf-ink-soft) outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)/20"
            />
          ))
        )}
      </div>

      {/* Submit – matches design system (cf-btn cf-raised cf-press) */}
      <button
        type="submit"
        disabled={validWords.length === 0}
        className="cf-btn cf-raised cf-press flex items-center justify-center w-full py-3 px-4 font-bold rounded-(--hex-radius) gap-2 disabled:opacity-40 disabled:pointer-events-none"
      >
        <Send className="w-4 h-4" />
        Submit{maxEntries > 1 && validWords.length > 0 ? ` (${validWords.length})` : ""}
      </button>
    </form>
  );
}
