"use client";

import React from "react";
import { Star } from "lucide-react";

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
    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-[color:var(--cf-line-strong)] text-[color:var(--cf-ink-soft)] bg-[color:var(--cf-cream)]">
      {type.toLowerCase()}
    </span>
  );
}

function ChoiceBar({ option }: { option: OptionCount }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[12px] gap-3">
        <span className="text-[color:var(--cf-ink)] truncate">{option.value}</span>
        <span className="font-mono text-[color:var(--cf-ink-soft)] tabular-nums shrink-0">
          {option.count} <span className="opacity-60">({option.percent}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-[color:var(--cf-cream)] rounded-full overflow-hidden ring-1 ring-[color:var(--cf-line)]">
        <div
          className="h-full rounded-full bg-[color:var(--cf-orange)] transition-all duration-500"
          style={{ width: `${option.percent}%` }}
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
              <Star className="size-4 text-[color:var(--cf-ink)]/15 fill-current absolute inset-0" />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${filled * 100}%` }}
              >
                <Star className="size-4 fill-[color:var(--cf-orange)] text-[color:var(--cf-orange)]" />
              </div>
            </div>
          );
        })}
      </div>
      <span className="cf-display text-[20px] leading-none tabular-nums">{avg.toFixed(1)}</span>
      <span className="cf-eyebrow text-[color:var(--cf-ink-soft)]">avg</span>
    </div>
  );
}

function RatingDistBar({ dist }: { dist: RatingDistItem[] }) {
  return (
    <div className="space-y-1.5 mt-3">
      {dist.map((d) => (
        <div key={d.rating} className="flex items-center gap-2 text-[11px] font-mono">
          <span className="w-3 text-[color:var(--cf-ink-soft)] text-right tabular-nums">
            {d.rating}
          </span>
          <Star className="size-3 fill-[color:var(--cf-orange)] text-[color:var(--cf-orange)] shrink-0" />
          <div className="flex-1 h-1.5 bg-[color:var(--cf-cream)] rounded-full overflow-hidden ring-1 ring-[color:var(--cf-line)]">
            <div
              className="h-full rounded-full bg-[color:var(--cf-orange)]/65"
              style={{ width: `${d.percent}%` }}
            />
          </div>
          <span className="w-8 text-right text-[color:var(--cf-ink-soft)] tabular-nums">
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
      <div className="h-2 rounded-full overflow-hidden flex bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)]">
        <div
          className="h-full bg-[color:var(--cf-orange)] transition-all duration-500"
          style={{ width: `${yesPct}%` }}
        />
        <div
          className="h-full bg-[color:var(--cf-ink-soft)]/25 transition-all duration-500"
          style={{ width: `${noPct}%` }}
        />
      </div>
      <div className="flex gap-5 text-[12px]">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[color:var(--cf-orange)]" />
          <span className="text-[color:var(--cf-ink)]">Yes</span>
          <span className="font-mono text-[color:var(--cf-ink-soft)] tabular-nums">
            {counts.yes} ({yesPct}%)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[color:var(--cf-ink-soft)]/40" />
          <span className="text-[color:var(--cf-ink)]">No</span>
          <span className="font-mono text-[color:var(--cf-ink-soft)] tabular-nums">
            {counts.no} ({noPct}%)
          </span>
        </div>
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
          className="text-[12px] text-[color:var(--cf-ink)] bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] rounded-md px-3 py-2 truncate"
          title={s}
        >
          {s.length > 80 ? s.slice(0, 80) + "…" : s}
        </div>
      ))}
      {remaining > 0 && (
        <p className="text-[11px] text-[color:var(--cf-ink-soft)] pl-1 font-mono">
          +{remaining} more
        </p>
      )}
    </div>
  );
}

function QuestionCard({ q }: { q: QuestionItem }) {
  const isChoice = CHOICE_TYPES.includes(q.fieldType);
  const isText = TEXT_TYPES.includes(q.fieldType);
  const isRating = q.fieldType === "RATING";
  const isToggle = q.fieldType === "TOGGLE";

  return (
    <div className="bg-[color:var(--cf-cream)] rounded-lg ring-1 ring-[color:var(--cf-line)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[color:var(--cf-line)] flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <p className="text-[13px] font-medium text-[color:var(--cf-ink)] leading-snug">
            {q.fieldLabel}
          </p>
          <div className="flex items-center gap-2">
            <FieldTypePill type={q.fieldType} />
            <span className="text-[11px] font-mono text-[color:var(--cf-ink-soft)] tabular-nums">
              {q.totalAnswered} response{q.totalAnswered !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-2">
        {q.totalAnswered === 0 ? (
          <p className="text-[12px] text-[color:var(--cf-ink-soft)]">0 responses for this field</p>
        ) : (
          <>
            {isChoice && q.optionCounts && (
              <div className="space-y-3">
                {q.optionCounts.map((opt, i) => (
                  <ChoiceBar key={i} option={opt} />
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
                <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Recent answers</p>
                {q.textSamples && q.textSamples.length > 0 ? (
                  <TextSamples samples={q.textSamples} totalAnswered={q.totalAnswered} />
                ) : (
                  <p className="text-[12px] text-[color:var(--cf-ink-soft)]">
                    {q.totalAnswered} answer{q.totalAnswered !== 1 ? "s" : ""} recorded
                  </p>
                )}
              </div>
            )}

            {!isChoice && !isRating && !isToggle && !isText && (
              <p className="text-[12px] text-[color:var(--cf-ink-soft)]">
                {q.totalAnswered} answer{q.totalAnswered !== 1 ? "s" : ""} recorded
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function QuestionDistribution({ questionDistribution }: QuestionDistributionProps) {
  return (
    <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5">
      <div>
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Questions</p>
        <h4 className="mt-2 cf-display text-[20px] leading-tight">Question breakdown</h4>
        <p className="mt-1 text-[12px] text-[color:var(--cf-ink-soft)]">
          How respondents answered each question
        </p>
      </div>

      {questionDistribution.length === 0 ? (
        <p className="mt-5 text-[13px] text-[color:var(--cf-ink-soft)]">
          No fields found for this form.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {questionDistribution.map((q) => (
            <QuestionCard key={q.fieldId} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}
