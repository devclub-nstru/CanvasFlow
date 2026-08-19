"use client";

import React, { useState, useEffect } from "react";
import { MentiSlide } from "~/lib/menti";
import { Crown, Trophy, Award, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ParticipantScore {
  id: string;
  name: string;
  avatarColor: string;
  score: number;
  pointsGained?: number;
  rank: number;
}

interface Props {
  slide: MentiSlide;
  analytics?: any;
  isPreview?: boolean;
}

const DEFAULT_SAMPLE_LEADERBOARD: ParticipantScore[] = [
  { id: "p-1", name: "Alex Rivers", avatarColor: "#2d5cf6", score: 2840, pointsGained: 950, rank: 1 },
  { id: "p-2", name: "Elena Rostova", avatarColor: "#ff7378", score: 2620, pointsGained: 920, rank: 2 },
  { id: "p-3", name: "Marcus Chen", avatarColor: "#43b7a6", score: 2410, pointsGained: 880, rank: 3 },
  { id: "p-4", name: "Sarah Connor", avatarColor: "#9189eb", score: 1980, pointsGained: 740, rank: 4 },
  { id: "p-5", name: "David Kim", avatarColor: "#e4a23e", score: 1850, pointsGained: 650, rank: 5 },
  { id: "p-6", name: "Priya Patel", avatarColor: "#313c8e", score: 1620, pointsGained: 0, rank: 6 },
];

export function LeaderboardViewer({ slide, analytics, isPreview = false }: Props) {
  const [participants, setParticipants] = useState<ParticipantScore[]>(() => {
    if (analytics?.leaderboard && Array.isArray(analytics.leaderboard) && analytics.leaderboard.length > 0) {
      return analytics.leaderboard;
    }
    // In preview mode or when analytics has data, use sample or live scores
    return isPreview ? DEFAULT_SAMPLE_LEADERBOARD : [];
  });

  useEffect(() => {
    if (analytics?.leaderboard && Array.isArray(analytics.leaderboard)) {
      setParticipants(analytics.leaderboard);
    }
  }, [analytics]);

  const heading = slide.question || slide.designSettings.leaderboardTitle || "Quiz leaderboard";
  const textColor = slide.designSettings.textColor || "#17171c";

  const hasData = participants.length > 0;

  return (
    <section
      className="flex flex-col justify-between items-center h-full w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 select-none relative"
      style={{ color: textColor }}
    >
      {/* 1. Heading Title */}
      <div className="w-full flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-300 text-amber-800 rounded-full text-xs font-mono font-bold uppercase tracking-wider mb-2">
          <Trophy className="size-3.5 text-amber-600" />
          <span>Live Standings</span>
        </div>
        <h2
          className={`font-medium leading-[1.1] tracking-[-0.04em] ${
            isPreview
              ? "text-2xl sm:text-3xl max-w-xl"
              : "text-3xl sm:text-4xl md:text-5xl lg:text-6xl max-w-3xl"
          }`}
        >
          {heading}
        </h2>
      </div>

      {/* 2. Content Area: Empty State vs Live Ranked Board */}
      {!hasData ? (
        // Empty State (1:1 with Reference Screenshot 2)
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto my-auto py-8">
          <div className="size-16 rounded-2xl bg-(--cf-cream) border-2 border-(--cf-line-strong) flex items-center justify-center mb-4 shadow-sm">
            <Award className="size-8 text-(--cf-ink-soft)" />
          </div>
          <h3 className="cf-display text-2xl sm:text-3xl uppercase tracking-tight text-neutral-900">
            No results yet
          </h3>
          <p className="mt-2 text-sm sm:text-base text-(--cf-ink-soft) leading-relaxed">
            Top Quiz participants will be displayed here once there are results!
          </p>
        </div>
      ) : (
        // Live Leaderboard with Smooth Layout Physics & Re-sorting
        <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center gap-2.5 py-4 overflow-hidden">
          <AnimatePresence>
            {participants.map((player, index) => {
              const rank = index + 1;
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;

              return (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{
                    type: "spring",
                    stiffness: 80,
                    damping: 14,
                    delay: index * 0.05,
                  }}
                  className={`w-full cf-panel cf-raised px-4 py-3 sm:py-3.5 rounded-xl border-2 flex items-center justify-between gap-4 transition-colors ${
                    isFirst
                      ? "bg-amber-50/90 border-amber-500 shadow-md ring-1 ring-amber-400"
                      : isSecond
                      ? "bg-slate-50 border-slate-400"
                      : isThird
                      ? "bg-amber-50/40 border-amber-700/60"
                      : "bg-white border-(--cf-line-strong)"
                  }`}
                >
                  {/* Left: Rank Badge + Avatar + Nickname */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Badge */}
                    <div
                      className={`size-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm shrink-0 shadow-xs ${
                        isFirst
                          ? "bg-amber-500 text-white"
                          : isSecond
                          ? "bg-slate-400 text-white"
                          : isThird
                          ? "bg-amber-700 text-white"
                          : "bg-(--cf-cream) border border-(--cf-line-strong) text-(--cf-ink)"
                      }`}
                    >
                      {isFirst ? (
                        <Crown className="size-4.5 fill-current" />
                      ) : (
                        `#${rank}`
                      )}
                    </div>

                    {/* Avatar Circle */}
                    <div
                      className="size-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 uppercase shadow-xs"
                      style={{ backgroundColor: player.avatarColor || "#2d5cf6" }}
                    >
                      {player.name.slice(0, 2)}
                    </div>

                    {/* Participant Name */}
                    <span className="font-bold text-sm sm:text-base text-neutral-900 truncate">
                      {player.name}
                    </span>
                  </div>

                  {/* Right: Score Delta + Total Score */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Points gained this question */}
                    {Boolean(player.pointsGained) && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + index * 0.05 }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-md text-xs font-mono font-bold"
                      >
                        <TrendingUp className="size-3" />
                        <span>+{player.pointsGained}</span>
                      </motion.span>
                    )}

                    {/* Total Score */}
                    <div className="text-right font-mono font-bold text-base sm:text-lg text-neutral-900 tabular-nums">
                      {player.score.toLocaleString()}{" "}
                      <span className="text-xs font-normal text-(--cf-ink-soft)">
                        pts
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* 3. Footer Branding / Subtitle */}
      <div className="w-full flex items-center justify-center pt-2">
        <span className="cf-meta text-(--cf-ink-soft) text-[10px]">
          CanvasFlow Real-time Quiz Engine
        </span>
      </div>
    </section>
  );
}
