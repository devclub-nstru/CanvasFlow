"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";
import { toast } from "sonner";

interface FormThankYouProps {
  siteRating: number | null;
  setSiteRating: (rating: number) => void;
}

export function FormThankYou({ siteRating, setSiteRating }: FormThankYouProps) {
  return (
    <div className="w-full max-w-md text-center space-y-8 cf-animate-card">
      {/* animated check */}
      <div className="mx-auto size-16 rounded-full bg-[color:var(--cf-orange)]/12 ring-1 ring-[color:var(--cf-orange)]/25 flex items-center justify-center text-[color:var(--cf-orange)] cf-animate-pop">
        <svg className="size-8" viewBox="0 0 52 52" fill="none">
          <circle
            className="cf-check-circle"
            cx="26"
            cy="26"
            r="23"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            className="cf-check-mark"
            d="M16 26l7 7 13-13"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* message */}
      <div className="space-y-3">
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Response received</p>
        <h2 className="cf-display text-[34px] sm:text-[40px] leading-tight text-[color:var(--cf-ink)]">
          Thanks for your time.
        </h2>
        <p className="text-[14.5px] text-[color:var(--cf-ink-soft)] leading-relaxed max-w-sm mx-auto">
          Your response has been recorded. You can close this tab whenever you&apos;re ready.
        </p>
      </div>

      {/* site rating */}
      <div className="border-t border-[color:var(--cf-line)] pt-6 space-y-3">
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">
          {siteRating ? "Thanks for the rating" : "How was the experience?"}
        </p>
        <div className="flex items-center justify-center gap-1">
          {[1, 2, 3, 4, 5].map((score) => {
            const isStarred = siteRating !== null && siteRating >= score;
            return (
              <button
                key={score}
                type="button"
                onClick={() => {
                  setSiteRating(score);
                  toast.success("Thanks for the feedback");
                }}
                className="p-1 hover:scale-110 transition-transform cursor-pointer"
                aria-label={`Rate ${score} out of 5`}
              >
                <Star
                  className={`size-6 ${
                    isStarred
                      ? "fill-[color:var(--cf-orange)] text-[color:var(--cf-orange)]"
                      : "text-[color:var(--cf-ink)]/15 fill-current"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-[color:var(--cf-line)] pt-6 space-y-4">
        <p className="text-[13px] text-[color:var(--cf-ink-soft)] leading-relaxed max-w-xs mx-auto">
          Like this form? Build your own — free to start, no card required.
        </p>
        <Link
          href="/signUp"
          className="group inline-flex items-center gap-1.5 h-[44px] px-6 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white rounded-full text-[14px] font-medium tracking-tight transition-colors"
        >
          Open CanvasFlow
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
}
