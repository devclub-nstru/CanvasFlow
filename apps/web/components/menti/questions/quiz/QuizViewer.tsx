"use client";

import React, { useMemo } from "react";
import { MentiSlide } from "~/lib/menti";
import { Check, Zap, Users, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { readTiming, shouldRevealAnswers, useQuizWindow } from "~/lib/quiz";

interface Props {
  slide: MentiSlide;
  analytics?: any;
  isPreview?: boolean;
  showQuestion?: boolean;
  hideResults?: boolean;
  questionStartedAt?: string | null;
  serverOffsetMs?: number;
  /**
   * Static review of a finished session (results tab / builder preview), where
   * there is no live clock and the answer is safe to show.
   *
   * This must stay OFF during a live presentation: a null `questionStartedAt`
   * there means "the round has not started yet", not "reveal everything".
   */
  isReview?: boolean;
}

const SLOTS = [
  { color: "#5268e8", glyph: "▲" },
  { color: "#ff7378", glyph: "◆" },
  { color: "#e4a23e", glyph: "●" },
  { color: "#43b7a6", glyph: "■" },
  { color: "#9189eb", glyph: "★" },
  { color: "#313c8e", glyph: "✚" },
];

const CORRECT_GREEN = "#10b981";

interface Row {
  id: string;
  label: string;
  count: number;
  isCorrect: boolean;
}

/** Balanced rows so 5+ answers wrap instead of squeezing into one line. */
function splitIntoBalancedRows<T>(items: T[]): T[][] {
  const n = items.length;
  if (n <= 4) return [items];
  if (n === 5) return [items.slice(0, 3), items.slice(3, 5)];
  if (n === 6) return [items.slice(0, 3), items.slice(3, 6)];
  if (n === 7) return [items.slice(0, 4), items.slice(4, 7)];
  if (n === 8) return [items.slice(0, 4), items.slice(4, 8)];

  const rowCount = Math.ceil(n / 4);
  const perRow = Math.ceil(n / rowCount);
  const rows: T[][] = [];
  for (let i = 0; i < n; i += perRow) rows.push(items.slice(i, i + perRow));
  return rows;
}

export function QuizViewer({
  slide,
  analytics,
  isPreview,
  showQuestion = true,
  hideResults,
  questionStartedAt,
  serverOffsetMs = 0,
  isReview = false,
}: Props) {
  const timing = useMemo(() => readTiming(slide.responseSettings), [slide.responseSettings]);
  const { phase, msRemaining } = useQuizWindow(questionStartedAt, timing, serverOffsetMs);

  const rows = useMemo<Row[]>(() => {
    if (analytics?.results?.length) {
      return (analytics.results as any[]).map((r) => ({
        id: String(r.id),
        label: String(r.label ?? ""),
        count: Number(r.count ?? 0),
        isCorrect: Boolean(r.isCorrect),
      }));
    }
    return (slide.options ?? []).map((opt) => ({
      id: opt.id,
      label: opt.label,
      count: opt.voteCount ?? 0,
      isCorrect: Boolean(opt.isCorrect),
    }));
  }, [analytics, slide.options]);

  const totalResponses = Number(analytics?.totalResponses ?? 0);
  const correctResponses = Number(analytics?.correctResponses ?? 0);
  const fastest = analytics?.fastestCorrect ?? null;

  const forceHidden = hideResults ?? false;
  // See shouldRevealAnswers: `idle` must not reveal during a live presentation.
  const revealed = shouldRevealAnswers({ phase, isReview, hideResults: forceHidden });

  /*
   * Live distribution while answers are coming in. This shows WHAT people are
   * picking, never which option is correct — the green marking is gated on
   * `revealed`. The host can suppress it entirely with hide-results (H) if they
   * would rather the room not follow the crowd.
   */
  const showLiveCounts = phase === "open" && !forceHidden;
  const showCounts = revealed || showLiveCounts;

  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  const secondsLeft = Math.ceil(msRemaining / 1000);
  const textColor = slide.designSettings.textColor || "#17171c";

  const barRows = splitIntoBalancedRows(rows);
  const isMultiRow = barRows.length > 1;

  return (
    <section
      className="relative mx-auto flex h-full w-full max-w-5xl flex-col select-none"
      style={{ color: textColor }}
    >
      {showQuestion && (
        <div className="flex w-full shrink-0 flex-col items-center text-center">
          <h2
            className={`font-medium leading-[1.1] tracking-[-0.04em] ${
              isPreview
                ? "mx-auto mb-1 max-w-xl text-xl sm:text-2xl"
                : isMultiRow
                  ? "mx-auto mb-2 max-w-3xl text-2xl sm:text-3xl md:text-4xl"
                  : "mx-auto mb-2 max-w-4xl text-2xl sm:text-3xl md:text-4xl lg:text-5xl"
            }`}
          >
            {slide.question || "Quiz question"}
          </h2>

          <div className="mb-2 flex h-7 items-center justify-center gap-3">
            <AnimatePresence mode="wait">
              {phase === "countdown" ? (
                <motion.span
                  key="cd-label"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-[11px] font-bold tracking-wider uppercase text-(--cf-ink-soft)"
                >
                  Get ready — answers open shortly
                </motion.span>
              ) : phase === "open" ? (
                <motion.div
                  key="open"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3"
                >
                  <span
                    className={`font-mono text-xl font-black tabular-nums ${
                      msRemaining <= 5000 ? "text-rose-600" : "text-(--cf-ink)"
                    }`}
                  >
                    {secondsLeft}s
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider uppercase text-(--cf-ink-soft) tabular-nums">
                    <Users className="size-3.5" />
                    {totalResponses} answered
                  </span>
                </motion.div>
              ) : forceHidden ? (
                <motion.div
                  key="hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-1.5 rounded-(--hex-radius) border border-(--cf-line-strong) bg-(--cf-cream-2) px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase text-(--cf-ink)"
                >
                  <EyeOff className="h-3 w-3 text-(--cf-ink-soft)" />
                  <span>Responses hidden</span>
                </motion.div>
              ) : revealed && totalResponses > 0 ? (
                <motion.span
                  key="summary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-[11px] font-bold tracking-wider uppercase text-(--cf-ink-soft) tabular-nums"
                >
                  {correctResponses} of {totalResponses} correct
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>

          {phase === "open" && (
            <div className="mb-3 h-2 w-full max-w-2xl overflow-hidden rounded-full border border-(--cf-line) bg-(--cf-cream)">
              <motion.div
                className={`h-full rounded-full ${
                  msRemaining <= 5000 ? "bg-rose-500" : "bg-(--cf-orange)"
                }`}
                initial={false}
                animate={{ width: `${Math.max(0, (msRemaining / timing.limitMs) * 100)}%` }}
                transition={{ ease: "linear", duration: 0.1 }}
              />
            </div>
          )}
        </div>
      )}

      {/*
       * The countdown owns the stage: a large depleting ring the whole room can
       * read from the back. Answers stay hidden so the reading time is spent on
       * the question rather than hunting for an answer to pre-tap.
       */}
      {phase === "countdown" && !isPreview ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
          <div className="relative grid size-44 place-items-center sm:size-52">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--cf-line)" strokeWidth="7" />
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="var(--cf-orange)"
                strokeWidth="7"
                strokeLinecap="round"
                pathLength={1}
                initial={false}
                animate={{
                  strokeDasharray: 1,
                  strokeDashoffset: 1 - msRemaining / Math.max(1, timing.countdownMs),
                }}
                transition={{ ease: "linear", duration: 0.1 }}
              />
            </svg>

            <motion.span
              key={secondsLeft}
              initial={{ scale: 0.55, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 17 }}
              className="font-mono text-6xl font-black text-(--cf-ink) tabular-nums sm:text-7xl"
            >
              {secondsLeft}
            </motion.span>
          </div>

          <p className="font-mono text-sm font-bold tracking-wider uppercase text-(--cf-ink-soft)">
            Answers open in {secondsLeft}
          </p>
        </div>
      ) : (
        // Vertical bars, matching the multiple-choice viewer. Standings live on
        // the dedicated leaderboard slide that follows this one.
        <div
          className={`flex min-h-0 flex-1 flex-col items-center justify-end ${
            isMultiRow ? "gap-3 sm:gap-5" : ""
          }`}
        >
            {barRows.map((rowItems, rowIndex) => (
              <div
                key={`bar-row-${rowIndex}`}
                className="flex w-full items-end justify-center gap-3 sm:gap-6 md:gap-8"
              >
                {rowItems.map((row) => {
                  const globalIndex = rows.findIndex((r) => r.id === row.id);
                  const slot = SLOTS[globalIndex % SLOTS.length]!;
                  const marked = revealed && row.isCorrect;

                  const fill =
                    showCounts && totalResponses > 0
                      ? Math.max(row.count > 0 ? 10 : 2, (row.count / maxCount) * 100)
                      : 0;

                  return (
                    <article
                      key={row.id}
                      className={`flex min-w-[70px] flex-1 flex-col items-center ${
                        isMultiRow ? "max-w-[170px]" : "max-w-[210px]"
                      }`}
                    >
                      {/* Count above the bar */}
                      <div className="flex h-8 items-end justify-center">
                        <AnimatePresence>
                          {showCounts && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.7 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ type: "spring", stiffness: 260, damping: 18 }}
                              className={`font-semibold tracking-[-0.04em] tabular-nums ${
                                isPreview
                                  ? "text-sm"
                                  : isMultiRow
                                    ? "text-xl sm:text-2xl"
                                    : "text-2xl sm:text-3xl md:text-4xl"
                              } ${marked ? "text-emerald-600" : "text-neutral-800"}`}
                            >
                              {row.count}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Rising bar, on a visible track so the stage still reads
                          as a chart before any votes land. */}
                      <div
                        className={`flex w-full flex-col items-center justify-end overflow-hidden rounded-t-[14px] border-x border-t border-(--cf-line) bg-(--cf-cream)/70 sm:rounded-t-[18px] ${
                          isPreview
                            ? isMultiRow
                              ? "h-16"
                              : "h-24"
                            : isMultiRow
                              ? "h-24 sm:h-32"
                              : "h-40 sm:h-52 md:h-60"
                        }`}
                      >
                        <motion.div
                          className="w-full rounded-t-[13px] sm:rounded-t-[17px]"
                          style={{ backgroundColor: marked ? CORRECT_GREEN : slot.color }}
                          initial={false}
                          animate={{
                            height: `${fill}%`,
                            opacity: revealed && !marked ? 0.45 : 1,
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 75,
                            damping: 15,
                            mass: 0.85,
                            // Stagger only on the reveal; live updates should
                            // track incoming answers immediately.
                            delay: revealed ? globalIndex * 0.05 : 0,
                          }}
                        />
                      </div>

                      {/* Shape key + label below the baseline */}
                      <div className="mt-2 flex w-full flex-col items-center gap-1">
                        <span
                          className={`grid shrink-0 place-items-center rounded-lg font-black text-white ${
                            isPreview ? "size-5 text-[10px]" : "size-8 text-base"
                          }`}
                          style={{
                            backgroundColor: marked ? CORRECT_GREEN : slot.color,
                            opacity: revealed && !marked ? 0.5 : 1,
                          }}
                        >
                          {marked ? <Check className="size-4 stroke-[3]" /> : slot.glyph}
                        </span>
                        <p
                          className={`w-full truncate text-center font-medium ${
                            isPreview
                              ? "text-[10px]"
                              : isMultiRow
                                ? "text-xs sm:text-sm"
                                : "text-sm sm:text-base md:text-lg"
                          } ${marked ? "font-bold text-emerald-700" : "text-neutral-700"}`}
                          title={row.label}
                        >
                          {row.label || `Answer ${globalIndex + 1}`}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ))}

            {/* Fastest correct responder — the headline of a speed round. */}
            <AnimatePresence>
              {revealed && fastest && !isPreview && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.25 }}
                  className="mt-3 flex items-center justify-center gap-2 rounded-full border-2 border-(--cf-line-strong) bg-white px-4 py-1.5"
                >
                  <Zap className="size-4 shrink-0 text-(--cf-orange)" />
                  <span className="text-sm font-bold text-(--cf-ink)">{fastest.nickname}</span>
                  <span className="font-mono text-xs text-(--cf-ink-soft) tabular-nums">
                    first in {(Number(fastest.responseTimeMs ?? 0) / 1000).toFixed(1)}s
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
        </div>
      )}
    </section>
  );
}
