"use client";

import React from "react";
import { Trophy, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";
import { motion } from "motion/react";
import { MentiSlide } from "~/lib/menti";
import type { LastQuizResult } from "~/hooks/useMentiRealtime";

interface Props {
  slide: MentiSlide;
  /** Verdict from the quiz question this leaderboard is scoring. */
  lastQuizResult?: LastQuizResult | null;
}

/**
 * Leaderboard slides take no input. Instead of pointing at the main screen, this
 * shows the participant their own verdict from the question just scored — which
 * is the thing they actually want to know while the standings animate.
 */
export function LeaderboardAudience({ slide, lastQuizResult }: Props) {
  // No verdict means they did not answer (or joined after the question ran).
  if (!lastQuizResult) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-10 text-center select-none">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="grid size-16 place-items-center rounded-full border-2 border-(--cf-line-strong) bg-(--cf-cream) cf-raised"
        >
          <Clock className="size-8 text-(--cf-ink-soft)" />
        </motion.div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-bold tracking-[-0.03em] text-(--cf-ink) sm:text-xl">
            No answer recorded
          </h3>
          <p className="mx-auto max-w-xs text-xs leading-relaxed text-(--cf-ink-soft) sm:text-sm">
            You did not answer the last question. Standings are on the main
            screen — get ready for the next one.
          </p>
        </div>
      </div>
    );
  }

  const good = lastQuizResult.isCorrect;

  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center select-none">
      <motion.div
        initial={{ scale: 0.5, rotate: good ? -12 : 0, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 16 }}
        className={`grid size-16 place-items-center rounded-full border-2 cf-raised ${
          good
            ? "border-emerald-300 bg-emerald-50 text-emerald-600"
            : "border-rose-300 bg-rose-50 text-rose-600"
        }`}
      >
        {good ? <CheckCircle2 className="size-8" /> : <XCircle className="size-8" />}
      </motion.div>

      <div className="space-y-1">
        <h3 className="text-xl font-black tracking-[-0.03em] text-(--cf-ink)">
          {good ? "You got it right!" : "That one was wrong"}
        </h3>
        <p className="text-xs text-(--cf-ink-soft)">
          Answered in {(lastQuizResult.responseTimeMs / 1000).toFixed(1)}s
        </p>
      </div>

      {good && (
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-1.5 rounded-full border-2 border-(--cf-line-strong) bg-white px-4 py-1.5 cf-raised"
        >
          <Zap className="size-4 text-(--cf-orange)" />
          <span className="font-mono text-lg font-black text-(--cf-ink) tabular-nums">
            +{lastQuizResult.pointsAwarded}
          </span>
        </motion.div>
      )}

      <div className="flex items-center gap-1.5 pt-1 text-(--cf-ink-soft)">
        <Trophy className="size-3.5 text-amber-600" />
        <span className="font-mono text-[10px] font-bold tracking-wider uppercase">
          {slide.question || "Leaderboard"} on the main screen
        </span>
      </div>
    </div>
  );
}
