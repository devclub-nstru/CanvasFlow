"use client";

import React, { useState } from "react";
import { ChevronDown, Star } from "lucide-react";

import { SEMANTIC, seriesColor } from "./palette";

interface OptionCount {
  value: string;
  count: number;
  percent: number;
}
interface ToggleCounts {
  yes: number;
  no: number;
}
interface RatingDistItem {
  rating: number;
  count: number;
  percent: number;
}

interface QuestionItem {
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  totalAnswered: number;
  optionCounts?: OptionCount[];
  averageRating?: number;
  ratingDistribution?: RatingDistItem[];
  toggleCounts?: ToggleCounts;
  textSamples?: string[];
}

interface QuestionDistributionProps {
  questionDistribution: QuestionItem[];
}

const CHOICE_TYPES = ["SELECT", "RADIO", "CHECKBOX"];
const TEXT_TYPES = ["TEXT", "TEXTAREA", "EMAIL", "NUMBER", "PHONE", "URL", "DATE", "TIME"];

function FieldTypePill({ type }: { type: string }) {
  return (
    <span
      className="border px-1.5 py-0.5 font-mono text-[10px] tracking-wider uppercase"
      style={{ borderColor: "var(--cf-line-strong)", color: "var(--cf-ink-soft)" }}
    >
      {type.toLowerCase()}
    </span>
  );
}

/** Choice bar. Each option gets its own hue so the split is readable at a glance. */
function ChoiceBar({ option, index }: { option: OptionCount; index: number }) {
  const colour = seriesColor(index);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <span className="truncate">{option.value}</span>
        <span className="shrink-0 font-mono tabular-nums" style={{ color: "var(--cf-ink-soft)" }}>
          {option.count} <span className="opacity-60">({option.percent}%)</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden" style={{ background: "var(--cf-line)" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${option.percent}%`, background: colour }}
        />
      </div>
    </div>
  );
}

function RatingStars({ avg }: { avg: number }) {
  const full = Math.floor(avg);
  const frac = avg - full;
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < full ? 1 : i === full && frac > 0 ? frac : 0;
          return (
            <div key={i} className="relative size-4">
              <Star className="absolute inset-0 size-4 fill-current text-(--cf-ink)/15" />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${filled * 100}%` }}
              >
                <Star className="size-4" style={{ fill: SEMANTIC.warn, color: SEMANTIC.warn }} />
              </div>
            </div>
          );
        })}
      </div>
      <span className="cf-display text-[20px] leading-none tabular-nums">{avg.toFixed(1)}</span>
      <span className="cf-meta">avg</span>
    </div>
  );
}

function RatingDistBar({ dist }: { dist: RatingDistItem[] }) {
  return (
    <div className="mt-3 space-y-1.5">
      {dist.map((d) => (
        <div key={d.rating} className="flex items-center gap-2 font-mono text-[11px]">
          <span className="w-3 text-right tabular-nums" style={{ color: "var(--cf-ink-soft)" }}>
            {d.rating}
          </span>
          <Star className="size-3 shrink-0" style={{ fill: SEMANTIC.warn, color: SEMANTIC.warn }} />
          <div className="h-2 flex-1 overflow-hidden" style={{ background: "var(--cf-line)" }}>
            <div className="h-full" style={{ width: `${d.percent}%`, background: SEMANTIC.warn }} />
          </div>
          <span className="w-8 text-right tabular-nums" style={{ color: "var(--cf-ink-soft)" }}>
            {d.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function ToggleBar({ counts }: { counts: ToggleCounts }) {
  const total = counts.yes + counts.no;
  const yesPct = total > 0 ? Math.round((counts.yes / total) * 100) : 0;
  const noPct = 100 - yesPct;
  return (
    <div className="space-y-3">
      <div className="flex h-2.5 overflow-hidden" style={{ background: "var(--cf-line)" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${yesPct}%`, background: SEMANTIC.good }}
        />
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${noPct}%`, background: SEMANTIC.bad }}
        />
      </div>
      <div className="flex gap-5 text-[12px]">
        {[
          { label: "Yes", n: counts.yes, pct: yesPct, colour: SEMANTIC.good },
          { label: "No", n: counts.no, pct: noPct, colour: SEMANTIC.bad },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-1.5">
            <span className="size-2 shrink-0" style={{ background: r.colour }} />
            <span>{r.label}</span>
            <span className="font-mono tabular-nums" style={{ color: "var(--cf-ink-soft)" }}>
              {r.n} ({r.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TextSamples({ samples, totalAnswered }: { samples: string[]; totalAnswered: number }) {
  const shown = samples.slice(0, 3);
  const remaining = totalAnswered - shown.length;
  return (
    <div className="space-y-2">
      {shown.map((s, i) => (
        <div
          key={i}
          className="truncate border px-3 py-2 text-[12px]"
          style={{ borderColor: "var(--cf-line)", background: "var(--cf-cream)" }}
          title={s}
        >
          {s.length > 80 ? s.slice(0, 80) + "…" : s}
        </div>
      ))}
      {remaining > 0 && (
        <p className="pl-1 font-mono text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
          +{remaining} more
        </p>
      )}
    </div>
  );
}

/**
 * One-line summary shown while a question is collapsed.
 *
 * The whole point of collapsing is to shorten the section, so a closed row
 * still has to say something useful — otherwise it is a list of labels and you
 * have to open every one to find the interesting question.
 */
function collapsedSummary(q: QuestionItem): string | null {
  if (q.totalAnswered === 0) return "No answers yet";
  if (CHOICE_TYPES.includes(q.fieldType) && q.optionCounts?.length) {
    const top = q.optionCounts[0]!;
    return `Top: ${top.value} (${top.percent}%)`;
  }
  if (q.fieldType === "RATING" && q.averageRating !== undefined) {
    return `Average ${q.averageRating.toFixed(1)} of 5`;
  }
  if (q.fieldType === "TOGGLE" && q.toggleCounts) {
    const total = q.toggleCounts.yes + q.toggleCounts.no;
    const pct = total > 0 ? Math.round((q.toggleCounts.yes / total) * 100) : 0;
    return `${pct}% answered yes`;
  }
  if (TEXT_TYPES.includes(q.fieldType)) return "Free text answers";
  return null;
}

function QuestionBody({ q }: { q: QuestionItem }) {
  const isChoice = CHOICE_TYPES.includes(q.fieldType);
  const isText = TEXT_TYPES.includes(q.fieldType);
  const isRating = q.fieldType === "RATING";
  const isToggle = q.fieldType === "TOGGLE";

  if (q.totalAnswered === 0) {
    return (
      <p className="text-[12px]" style={{ color: "var(--cf-ink-soft)" }}>
        0 responses for this field
      </p>
    );
  }

  return (
    <>
      {isChoice && q.optionCounts && (
        <div className="space-y-3">
          {q.optionCounts.map((opt, i) => (
            <ChoiceBar key={`${opt.value}-${i}`} option={opt} index={i} />
          ))}
        </div>
      )}

      {isRating && (
        <div className="space-y-2">
          {q.averageRating !== undefined && <RatingStars avg={q.averageRating} />}
          {q.ratingDistribution && <RatingDistBar dist={q.ratingDistribution} />}
        </div>
      )}

      {isToggle && q.toggleCounts && <ToggleBar counts={q.toggleCounts} />}

      {isText && (
        <div className="space-y-2">
          <p className="cf-meta">Recent answers</p>
          {q.textSamples && q.textSamples.length > 0 ? (
            <TextSamples samples={q.textSamples} totalAnswered={q.totalAnswered} />
          ) : (
            <p className="text-[12px]" style={{ color: "var(--cf-ink-soft)" }}>
              {q.totalAnswered} answer{q.totalAnswered !== 1 ? "s" : ""} recorded
            </p>
          )}
        </div>
      )}

      {!isChoice && !isRating && !isToggle && !isText && (
        <p className="text-[12px]" style={{ color: "var(--cf-ink-soft)" }}>
          {q.totalAnswered} answer{q.totalAnswered !== 1 ? "s" : ""} recorded
        </p>
      )}
    </>
  );
}

/**
 * Question breakdown as a single-open accordion.
 *
 * Rendering every question's full distribution at once made this the longest
 * block on the page — a ten-field form pushed everything below it off screen.
 * Collapsed rows keep the whole form scannable in one view, and only one opens
 * at a time so the section's height stays roughly constant.
 */
export function QuestionDistribution({ questionDistribution }: QuestionDistributionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="cf-panel overflow-hidden">
      <div
        className="flex items-end justify-between gap-3 border-b px-4 py-3 sm:px-5"
        style={{ borderBottomColor: "var(--cf-line)" }}
      >
        <div>
          <p className="cf-meta">Questions</p>
          <h4 className="cf-display mt-1.5 text-[18px] leading-tight">Question breakdown</h4>
          <p className="mt-1 text-[12px]" style={{ color: "var(--cf-ink-soft)" }}>
            Select a question to see how it was answered.
          </p>
        </div>
        <span className="cf-meta shrink-0">{questionDistribution.length} fields</span>
      </div>

      {questionDistribution.length === 0 ? (
        <p className="p-5 text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
          No fields found for this form.
        </p>
      ) : (
        <ul>
          {questionDistribution.map((q, i) => {
            const isOpen = openId === q.fieldId;
            const summary = collapsedSummary(q);
            return (
              <li
                key={q.fieldId}
                className={i === 0 ? "" : "border-t"}
                style={{ borderTopColor: "var(--cf-line)" }}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`qd-${q.fieldId}`}
                  onClick={() => setOpenId(isOpen ? null : q.fieldId)}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--cf-cream) sm:px-5"
                >
                  <span
                    className="cf-meta w-6 shrink-0 tabular-nums"
                    style={{ color: "var(--cf-ink-muted)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{q.fieldLabel}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <FieldTypePill type={q.fieldType} />
                      <span
                        className="font-mono text-[11px] tabular-nums"
                        style={{ color: "var(--cf-ink-soft)" }}
                      >
                        {q.totalAnswered} response{q.totalAnswered !== 1 ? "s" : ""}
                      </span>
                      {summary && (
                        <>
                          <span aria-hidden style={{ color: "var(--cf-ink-muted)" }}>
                            ·
                          </span>
                          <span
                            className="truncate text-[11px]"
                            style={{ color: "var(--cf-ink-soft)" }}
                          >
                            {summary}
                          </span>
                        </>
                      )}
                    </span>
                  </span>

                  <ChevronDown
                    className={`size-4 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    style={{ color: "var(--cf-ink-muted)" }}
                  />
                </button>

                {isOpen && (
                  <div
                    id={`qd-${q.fieldId}`}
                    className="border-t px-4 py-4 sm:px-5"
                    style={{ borderTopColor: "var(--cf-line)", background: "var(--cf-cream)" }}
                  >
                    <QuestionBody q={q} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
