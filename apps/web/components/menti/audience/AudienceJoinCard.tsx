"use client";

import React, { useState, useEffect, useRef } from "react";
import Noise from "~/components/Noise";
import { VerticalScale } from "~/components/Scale";

interface Props {
  onJoin: (code: string, nickname?: string) => void;
  defaultCode?: string;
}

export function AudienceJoinCard({ onJoin, defaultCode = "" }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [nickname, setNickname] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize with defaultCode if provided
  useEffect(() => {
    if (defaultCode) {
      const clean = defaultCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
      const newDigits = Array(6).fill("");
      for (let i = 0; i < clean.length; i++) {
        newDigits[i] = clean[i] || "";
      }
      setDigits(newDigits);
    }
  }, [defaultCode]);

  const fullCode = digits.join("");

  const handleDigitChange = (index: number, val: string) => {
    const raw = val.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    // Handling pasted multi-character string
    if (raw.length > 1) {
      const pasteDigits = raw.slice(0, 6).split("");
      const updated = [...digits];
      pasteDigits.forEach((d, idx) => {
        if (index + idx < 6) updated[index + idx] = d;
      });
      setDigits(updated);
      const nextIndex = Math.min(index + pasteDigits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const updated = [...digits];
    updated[index] = raw;
    setDigits(updated);

    // Auto-advance to next input
    if (raw && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        const updated = [...digits];
        updated[index - 1] = "";
        setDigits(updated);
        inputRefs.current[index - 1]?.focus();
      } else {
        const updated = [...digits];
        updated[index] = "";
        setDigits(updated);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
    if (!pasted) return;

    const newDigits = Array(6).fill("");
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i] || "";
    }
    setDigits(newDigits);
    const focusTarget = Math.min(pasted.length, 5);
    inputRefs.current[focusTarget]?.focus();
  };

  const isFormValid = fullCode.length === 6 && nickname.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    onJoin(fullCode, nickname.trim());
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-(--cf-cream) text-(--cf-ink) px-4 py-8 select-none overflow-hidden">
      <Noise />

      {/* Side Rail Decorations from Landing Page */}
      <div className="pointer-events-none absolute inset-0 hidden md:block">
        <VerticalScale className="absolute inset-y-0 left-0 mx-auto" />
        <VerticalScale className="absolute inset-y-0 right-0 mx-auto" />
      </div>

      {/* Central Card */}
      <div className="relative w-full max-w-md mx-auto z-10">
        <div className="cf-panel cf-raised bg-white border-2 border-(--cf-line-strong) rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Header Title & Subtitle */}
          <div className="text-center space-y-1">
            <h1 className="cf-display text-2xl sm:text-3xl text-(--cf-ink) font-bold">
              Join presentation
            </h1>
            <p className="text-xs text-(--cf-ink-soft)">
              Enter the 6-character code shown on the screen
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 6-Character Split Alphanumeric Code Input */}
            <div className="space-y-2">
              <label className="cf-meta text-[11px] text-(--cf-ink-soft) block">
                PRESENTATION CODE
              </label>

              <div
                className="grid grid-cols-7 gap-1 sm:gap-1.5 items-center"
                onPaste={handlePaste}
              >
                {/* First 3 Characters */}
                {[0, 1, 2].map((idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    maxLength={idx === 0 ? 6 : 1}
                    value={digits[idx]}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    autoFocus={idx === 0}
                    className="w-full aspect-square text-center font-mono font-black text-lg sm:text-xl text-(--cf-ink) bg-(--cf-cream) border-2 border-(--cf-line-strong) rounded-lg focus:outline-none focus:bg-white focus:border-(--cf-orange) focus:ring-2 focus:ring-(--cf-orange)/20 transition-all uppercase"
                  />
                ))}

                {/* Divider */}
                <div className="text-center font-bold text-base text-(--cf-ink-soft) select-none">
                  -
                </div>

                {/* Second 3 Characters */}
                {[3, 4, 5].map((idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    maxLength={1}
                    value={digits[idx]}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-full aspect-square text-center font-mono font-black text-lg sm:text-xl text-(--cf-ink) bg-(--cf-cream) border-2 border-(--cf-line-strong) rounded-lg focus:outline-none focus:bg-white focus:border-(--cf-orange) focus:ring-2 focus:ring-(--cf-orange)/20 transition-all uppercase"
                  />
                ))}
              </div>
            </div>

            {/* Simple Name Input (Required) */}
            <div className="space-y-2">
              <label className="cf-meta text-[11px] text-(--cf-ink-soft) block">
                YOUR NAME
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your name"
                maxLength={40}
                required
                autoComplete="name"
                className="w-full px-3.5 py-2.5 text-sm font-medium text-(--cf-ink) bg-(--cf-cream) border-2 border-(--cf-line-strong) rounded-lg focus:outline-none focus:bg-white focus:border-(--cf-orange) focus:ring-2 focus:ring-(--cf-orange)/20 transition-all placeholder:text-(--cf-ink-soft)/60"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="cf-btn cf-raised cf-press w-full py-3.5 px-5 text-sm sm:text-base font-bold text-white bg-(--cf-orange) hover:bg-(--cf-orange-hover) disabled:opacity-50 disabled:pointer-events-none rounded-xl border-2 border-(--cf-line-strong) flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Joining...</span>
                </span>
              ) : (
                <span>Join presentation</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

