"use client";

import React, { useMemo } from "react";
import { MentiSlide } from "~/lib/menti";
import { EyeOff, ListOrdered } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  slide: MentiSlide;
  analytics?: any;
  isPreview?: boolean;
  showQuestion?: boolean;
  hideResults?: boolean;
}

interface RankedRow {
  id: string;
  label: string;
  points: number;
  averageRank: number;
  firstPlaceVotes: number;
}

/** Podium accents for the top three, neutral ink for the rest. */
const PODIUM = [
  { bar: "#e4a23e", badge: "bg-[#e4a23e] text-white" },
  { bar: "#9189eb", badge: "bg-[#9189eb] text-white" },
  { bar: "#43b7a6", badge: "bg-[#43b7a6] text-white" },
];
const REST = { bar: "#5268e8", badge: "bg-(--cf-cream) text-(--cf-ink) border border-(--cf-line-strong)" };

export function RankingViewer({
  slide,
  analytics,
  isPreview,
  showQuestion = true,
  hideResults,
}: Props) {
  const isHidden =
    hideResults !== undefined
      ? hideResults
      : (slide.responseSettings?.hideResultsFromAudience ?? false);

  /**
   * Prefer the live Borda tally from the socket. Otherwise fall back to
   * slide.options, where the REST enrichment stores Borda points in voteCount
   * (already best-first) — that path feeds the results tab. With no data at all
   * this degrades to the authoring order at zero points, so the presenter still
   * sees the list they are asking about instead of an empty stage.
   */
  const rows = useMemo<RankedRow[]>(() => {
    if (analytics?.results?.length) {
      return (analytics.results as any[]).map((r) => ({
        id: String(r.id),
        label: String(r.label ?? ""),
        points: Number(r.points ?? 0),
        averageRank: Number(r.averageRank ?? 0),
        firstPlaceVotes: Number(r.firstPlaceVotes ?? 0),
      }));
    }
    return (slide.options ?? [])
      .map((opt) => ({
        id: opt.id,
        label: opt.label,
        points: opt.voteCount ?? 0,
        averageRank: 0,
        firstPlaceVotes: 0,
      }))
      .sort((a, b) => b.points - a.points);
  }, [analytics, slide.options]);

  const totalResponses = Number(
    analytics?.totalResponses ?? (slide.totalResponses ?? 0),
  );
  const maxPoints = Math.max(1, ...rows.map((r) => r.points));
  const hasVotes = totalResponses > 0 && rows.some((r) => r.points > 0);

  const textColor = slide.designSettings.textColor || "#17171c";

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
                : "mx-auto mb-2 max-w-4xl text-2xl sm:text-3xl md:text-4xl lg:text-5xl"
            }`}
          >
            {slide.question || "Rank these in order"}
          </h2>

          <div className="mb-2 flex h-6 items-center justify-center">
            <AnimatePresence mode="wait">
              {isHidden ? (
                <motion.div
                  key="hidden"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="inline-flex items-center gap-1.5 rounded-(--hex-radius) border border-(--cf-line-strong) bg-(--cf-cream-2) px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase text-(--cf-ink)"
                >
                  <EyeOff className="h-3 w-3 text-(--cf-ink-soft)" />
                  <span>Responses hidden</span>
                </motion.div>
              ) : totalResponses > 0 && !isPreview ? (
                <motion.span
                  key="count"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="font-mono text-[11px] font-bold tracking-wider uppercase text-(--cf-ink-soft) tabular-nums"
                >
                  {totalResponses.toLocaleString()}{" "}
                  {totalResponses === 1 ? "ranking" : "rankings"} submitted
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      )}

      {isHidden ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400">
          <EyeOff className={`mb-3 ${isPreview ? "size-7" : "size-10"}`} />
          <p className={`font-medium ${isPreview ? "text-xs" : "text-sm"}`}>
            Results are hidden from audience
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400">
          <ListOrdered className={`mb-3 ${isPreview ? "size-7" : "size-10"}`} />
          <p className={`font-medium ${isPreview ? "text-xs" : "text-sm"}`}>
            Add items to rank
          </p>
        </div>
      ) : (
        <div
          className={`flex min-h-0 flex-1 flex-col justify-center ${
            isPreview ? "gap-1.5" : "gap-2 sm:gap-2.5"
          }`}
        >
          {rows.map((row, index) => {
            const accent = PODIUM[index] ?? REST;
            // Keep a sliver of bar visible so every row stays readable at zero.
            const fill = hasVotes ? Math.max(2, (row.points / maxPoints) * 100) : 0;

            return (
              <motion.div
                key={row.id}
                layout
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className="flex items-center gap-2 sm:gap-3"
              >
                {/* Position */}
                <span
                  className={`grid shrink-0 place-items-center rounded-lg font-mono font-bold tabular-nums ${
                    accent.badge
                  } ${
                    isPreview
                      ? "size-5 text-[10px]"
                      : "size-8 text-sm sm:size-9 sm:text-base"
                  }`}
                >
                  {index + 1}
                </span>

                {/* Label + bar */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span
                      className={`truncate font-semibold tracking-[-0.02em] ${
                        isPreview ? "text-[11px]" : "text-sm sm:text-base md:text-lg"
                      }`}
                      title={row.label}
                    >
                      {row.label || "Untitled item"}
                    </span>

                    {hasVotes && (
                      <span
                        className={`shrink-0 font-mono tabular-nums text-(--cf-ink-soft) ${
                          isPreview ? "text-[9px]" : "text-[10px] sm:text-xs"
                        }`}
                      >
                        <strong className="text-(--cf-ink)">{row.points}</strong> pts
                        {row.averageRank > 0 && (
                          <span className="ml-1.5 hidden sm:inline">
                            avg #{row.averageRank}
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  <div
                    className={`w-full overflow-hidden rounded-full border border-(--cf-line) bg-(--cf-cream) ${
                      isPreview ? "h-2" : "h-4 sm:h-5"
                    }`}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: accent.bar }}
                      initial={false}
                      animate={{ width: `${fill}%` }}
                      transition={{ type: "spring", stiffness: 90, damping: 18, mass: 0.8 }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}

          {!hasVotes && !isPreview && (
            <p className="mt-2 shrink-0 text-center font-mono text-[11px] font-bold tracking-wider uppercase text-(--cf-ink-soft)">
              Waiting for rankings…
            </p>
          )}
        </div>
      )}
    </section>
  );
}
