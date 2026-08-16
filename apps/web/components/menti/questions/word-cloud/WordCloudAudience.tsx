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
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <CheckCircle2 className="w-12 h-12 mb-3 text-green-600 animate-bounce" />
        <h3 className="text-xl font-bold text-neutral-900">Response Submitted!</h3>
        <p className="mt-1 text-sm text-neutral-500">Look at the big screen to see the word cloud evolve.</p>
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
      <div className="space-y-1">
        <h2 className="text-xl font-bold leading-snug text-neutral-900">{slide.question}</h2>
        <p className="text-xs text-neutral-500">
          {maxEntries === 1
            ? "Enter your response below"
            : `Enter up to ${maxEntries} words`}
        </p>
      </div>

      <div className="space-y-2.5">
        {maxEntries === 1 ? (
          <textarea
            value={words[0] || ""}
            onChange={(e) => updateWord(0, e.target.value)}
            placeholder="Type your answer here..."
            rows={3}
            maxLength={100}
            required
            className="w-full p-4 text-base bg-white border-2 rounded-xl border-neutral-300 focus:outline-none focus:border-blue-600"
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
              className="w-full p-3.5 text-sm bg-white border-2 rounded-xl border-neutral-300 focus:outline-none focus:border-blue-600"
            />
          ))
        )}
      </div>

      <button
        type="submit"
        disabled={validWords.length === 0}
        className="flex items-center justify-center w-full py-3.5 px-4 font-semibold text-white transition-all bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-md"
      >
        <Send className="w-4 h-4 mr-2" />
        Submit {maxEntries > 1 && validWords.length > 0 ? `(${validWords.length})` : ""}
      </button>
    </form>
  );
}
