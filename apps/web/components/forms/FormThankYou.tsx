"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";
import { toast } from "sonner";

interface SummaryField {
  id: string;
  label: string;
  type: string;
}

interface FormThankYouProps {
  siteRating: number | null;
  setSiteRating: (rating: number) => void;
  /** Fields in display order, for the response summary. */
  fields?: SummaryField[];
  answers?: Record<string, any>;
}

/**
 * Post-submit screen.
 *
 * The response summary is lifted from the reference's "YOUR RESPONSE SUMMARY"
 * block — the one genuinely new thing in that file that needs no schema
 * changes, since the answers are already in the page's state. It gives a
 * respondent a record of what they just sent, which is the most common thing
 * people want from a confirmation screen and previously wasn't available
 * anywhere.
 *
 * The reference's social-share row and quiz breakdown are absent: sharing
 * needs a `socialLinks` column and quizzes need per-question points and
 * correct answers, none of which exist on this schema.
 */
export function FormThankYou({
  siteRating,
  setSiteRating,
  fields = [],
  answers = {},
}: FormThankYouProps) {
  /** Render an answer of any supported field type as a readable string. */
  const display = (field: SummaryField): string => {
    const value = answers[field.id];

    if (value === undefined || value === null || value === "") return "—";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (field.type === "RATING") return `${value} / 5`;
    return String(value);
  };

  // Only fields the respondent actually answered. Listing skipped optional
  // questions as "—" pads the summary with rows that carry no information.
  const answered = fields.filter((f) => {
    const v = answers[f.id];
    if (typeof v === "boolean") return true;
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== "";
  });

  return (
    <div className="cf-animate-card w-full max-w-xl space-y-6">
      {/* ── confirmation ── */}
      <div
        className="border p-7 text-center sm:p-9"
        style={{
          borderColor: "var(--cf-line-strong)",
          background: "var(--cf-cream-2)",
          boxShadow: "5px 5px 0 0 rgba(26, 29, 41, 0.08)",
        }}
      >
        <div
          className="cf-animate-pop mx-auto flex size-16 items-center justify-center border text-[color:var(--cf-orange)]"
          style={{ borderColor: "var(--cf-orange)", background: "#fff" }}
        >
          <svg className="size-8" viewBox="0 0 52 52" fill="none" aria-hidden>
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

        <p className="mt-6 font-mono text-[10px] font-bold tracking-[0.2em] text-[color:var(--cf-ink-soft)] uppercase">
          Response received
        </p>
        <h2 className="cf-display mt-3 text-[30px] leading-tight text-[color:var(--cf-ink)] sm:text-[38px]">
          Thanks for your time.
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[14.5px] leading-relaxed text-[color:var(--cf-ink-soft)]">
          Your response has been recorded. You can close this tab whenever you&apos;re ready.
        </p>
      </div>

      {/* ── what you sent ── */}
      {answered.length > 0 && (
        <details
          className="border"
          style={{ borderColor: "var(--cf-line-strong)", background: "#fff" }}
        >
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-mono text-[10px] font-bold tracking-[0.16em] text-[color:var(--cf-ink-soft)] uppercase">
            Your answers ({answered.length})
            <span aria-hidden className="text-[13px]">
              +
            </span>
          </summary>
          <dl className="border-t" style={{ borderTopColor: "var(--cf-line)" }}>
            {answered.map((field, i) => (
              <div
                key={field.id}
                className="border-b px-4 py-3 last:border-b-0"
                style={{ borderBottomColor: "var(--cf-line)" }}
              >
                <dt className="font-mono text-[9.5px] font-bold tracking-[0.16em] text-[color:var(--cf-ink-soft)] uppercase">
                  Q{String(i + 1).padStart(2, "0")} · {field.label}
                </dt>
                <dd className="mt-1 text-[14px] break-words text-[color:var(--cf-ink)]">
                  {display(field)}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {/* ── experience rating ── */}
      <div
        className="border p-5 text-center"
        style={{ borderColor: "var(--cf-line-strong)", background: "#fff" }}
      >
        <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-[color:var(--cf-ink-soft)] uppercase">
          {siteRating ? "Thanks for the rating" : "How was the experience?"}
        </p>
        <div className="mt-3 flex items-center justify-center gap-1">
          {[1, 2, 3, 4, 5].map((score) => {
            const on = siteRating !== null && siteRating >= score;
            return (
              <button
                key={score}
                type="button"
                onClick={() => {
                  setSiteRating(score);
                  toast.success("Thanks for the feedback");
                }}
                className="cursor-pointer p-1 transition-transform hover:scale-125"
                aria-label={`Rate ${score} out of 5`}
              >
                <Star
                  className={`size-6 ${
                    on
                      ? "fill-[color:var(--cf-orange)] text-[color:var(--cf-orange)]"
                      : "fill-current text-[color:var(--cf-ink)]/15"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="space-y-4 text-center">
        <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-[color:var(--cf-ink-soft)]">
          Like this form? Build your own — free to start, no card required.
        </p>
        <Link
          href="/signUp"
          className="group inline-flex h-[46px] items-center gap-2 border px-6 text-[14px] font-semibold text-white transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
          style={{
            background: "var(--cf-orange)",
            borderColor: "var(--cf-line-strong)",
            boxShadow: "4px 4px 0 0 var(--cf-line-strong)",
          }}
        >
          Open CanvasFlow
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
}
