"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowRight, QrCode } from "lucide-react";
import { VerticalScale } from "~/components/Scale";
import Noise from "~/components/Noise";

interface Props {
  onJoin: (code: string, name: string) => void;
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
      const clean = defaultCode.replace(/[^0-9]/g, "").slice(0, 6);
      const newDigits = Array(6).fill("");
      for (let i = 0; i < clean.length; i++) {
        newDigits[i] = clean[i] || "";
      }
      setDigits(newDigits);
    }
  }, [defaultCode]);

  const fullCode = digits.join("");

  const handleDigitChange = (index: number, val: string) => {
    const raw = val.replace(/[^0-9]/g, "");

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
    const pasted = e.clipboardData
      .getData("text")
      .replace(/[^0-9]/g, "")
      .slice(0, 6);
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
    <div className="relative flex flex-col justify-between min-h-screen min-h-[100dvh] w-full bg-(--cf-cream) text-(--cf-ink) select-none overflow-x-hidden font-sans">
      <Noise />

      {/* Decorative Neo-Editorial Vertical Scale Side Borders */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block z-0">
        <VerticalScale className="absolute inset-y-0 left-0 w-8 2xl:w-10 opacity-70" />
        <VerticalScale className="absolute inset-y-0 right-0 w-8 2xl:w-10 opacity-70" />
      </div>



      {/* 2. Main Hero Join Card */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-4 sm:py-6 w-full max-w-lg mx-auto">
        <div className="cf-panel cf-raised w-full p-5 sm:p-8 bg-white border-2 border-(--cf-line-strong) rounded-2xl sm:rounded-3xl shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
          {/* Header & Title */}
          <div className="text-center space-y-1">
            <h1 className="cf-display text-2xl sm:text-3xl font-black text-(--cf-ink) tracking-tight">
              Join Presentation
            </h1>
            <p className="text-xs text-(--cf-ink-soft)">
              Enter your name and the 6-digit code shown on the screen
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Participant Name Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="menti-name-input"
                className="cf-meta block text-[11px] font-bold text-(--cf-ink-soft) uppercase tracking-wider"
              >
                Your Name <span className="text-(--cf-orange)">*</span>
              </label>
              <input
                id="menti-name-input"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={30}
                autoFocus
                required
                autoComplete="name"
                className="w-full py-3 px-3.5 sm:px-4 font-bold text-base bg-(--cf-cream) border-2 border-(--cf-line-strong) rounded-xl focus:outline-none focus:border-(--cf-orange) focus:bg-white transition-all text-(--cf-ink) placeholder:text-neutral-300 shadow-inner"
              />
            </div>

            {/* 6-Digit Split Numeric Code Input */}
            <div className="space-y-1.5">
              <label className="cf-meta block text-[11px] font-bold text-(--cf-ink-soft) uppercase tracking-wider">
                Presentation Code <span className="text-(--cf-orange)">*</span>
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
                    className="w-full aspect-square text-center font-mono font-black text-base sm:text-xl text-(--cf-ink) bg-(--cf-cream) border-2 border-(--cf-line-strong) rounded-xl focus:outline-none focus:bg-white focus:border-(--cf-orange) focus:ring-2 focus:ring-(--cf-orange)/20 transition-all uppercase min-w-0 p-0"
                  />
                ))}

                {/* Divider */}
                <div className="text-center font-mono font-bold text-base sm:text-lg text-(--cf-ink-soft) select-none">
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
                    className="w-full aspect-square text-center font-mono font-black text-base sm:text-xl text-(--cf-ink) bg-(--cf-cream) border-2 border-(--cf-line-strong) rounded-xl focus:outline-none focus:bg-white focus:border-(--cf-orange) focus:ring-2 focus:ring-(--cf-orange)/20 transition-all uppercase min-w-0 p-0"
                  />
                ))}
              </div>
            </div>

            {/* Join Submit Button */}
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="cf-btn cf-raised cf-press flex items-center justify-center w-full py-3.5 sm:py-4 text-sm sm:text-base font-black rounded-(--hex-radius) gap-2 disabled:opacity-40 disabled:pointer-events-none shadow-lg transition-all mt-2 min-h-[48px]"
            >
              <span>{isSubmitting ? "Joining..." : "Join Presentation"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* QR Code Alternative Notice */}
          <div className="p-2.5 sm:p-3 bg-(--cf-cream-2) border border-(--cf-line) rounded-xl flex items-center gap-2.5 sm:gap-3 text-left">
            <div className="size-7 sm:size-8 bg-white border border-(--cf-line) rounded-lg flex items-center justify-center shrink-0 shadow-xs">
              <QrCode className="size-4 text-(--cf-ink)" />
            </div>
            <p className="text-[11px] sm:text-xs text-(--cf-ink-soft) leading-snug">
              Alternatively, scan the <strong className="text-(--cf-ink)">QR Code</strong> on the
              presenter screen with your mobile camera.
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Spacer */}
      <div className="h-4 sm:h-6" />
    </div>
  );
}
