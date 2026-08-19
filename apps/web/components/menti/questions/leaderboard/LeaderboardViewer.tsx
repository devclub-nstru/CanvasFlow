"use client";

import React, { useMemo } from "react";
import { MentiSlide, MentiLeaderboardSnapshot, MentiLeaderboardParticipant } from "~/lib/menti";
import { Crown, Trophy, Award } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  slide: MentiSlide;
  analytics?: any;
  leaderboard?: MentiLeaderboardSnapshot | null;
  isPreview?: boolean;
}

const AVATAR_COLORS = [
  "#2d5cf6",
  "#ff7378",
  "#43b7a6",
  "#9189eb",
  "#e4a23e",
  "#313c8e",
  "#10b981",
  "#f59e0b",
];

const PREVIEW_SAMPLE_LEADERBOARD: MentiLeaderboardParticipant[] = [
  { participantId: "p-1", nickname: "Alex Rivers", score: 2840, rank: 1 },
  { participantId: "p-2", nickname: "Elena Rostova", score: 2620, rank: 2 },
  { participantId: "p-3", nickname: "Marcus Chen", score: 2410, rank: 3 },
  { participantId: "p-4", nickname: "Sarah Connor", score: 1980, rank: 4 },
  { participantId: "p-5", nickname: "David Kim", score: 1850, rank: 5 },
  { participantId: "p-6", nickname: "Priya Patel", score: 1620, rank: 6 },
];

export function LeaderboardViewer({ slide, analytics, leaderboard, isPreview = false }: Props) {
  const participants = useMemo<MentiLeaderboardParticipant[]>(() => {
    // 1. Direct leaderboard prop from realtime syncer
    if (leaderboard?.topParticipants && Array.isArray(leaderboard.topParticipants) && leaderboard.topParticipants.length > 0) {
      return leaderboard.topParticipants;
    }
    // 2. Analytics wrapper fallback
    if (analytics?.topParticipants && Array.isArray(analytics.topParticipants) && analytics.topParticipants.length > 0) {
      return analytics.topParticipants;
    }
    if (analytics?.leaderboard && Array.isArray(analytics.leaderboard) && analytics.leaderboard.length > 0) {
      return analytics.leaderboard.map((p: any, idx: number) => ({
        participantId: p.participantId || p.id || `p-${idx}`,
        nickname: p.nickname || p.name || `Player ${idx + 1}`,
        score: typeof p.score === "number" ? p.score : 0,
        rank: p.rank || idx + 1,
      }));
    }
    // 3. Preview mode only (for template/editor preview)
    return isPreview ? PREVIEW_SAMPLE_LEADERBOARD : [];
  }, [leaderboard, analytics, isPreview]);

  const heading = slide.question || slide.designSettings?.leaderboardTitle || "Quiz leaderboard";
  const textColor = slide.designSettings?.textColor || "#17171c";

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
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto my-auto py-8">
          <div className="size-16 rounded-2xl bg-(--cf-cream) border-2 border-(--cf-line-strong) flex items-center justify-center mb-4 shadow-xs">
            <Award className="size-8 text-(--cf-ink-soft)" />
          </div>
          <h3 className="cf-display text-2xl sm:text-3xl uppercase tracking-tight text-neutral-900">
            No results yet
          </h3>
          <p className="mt-2 text-sm sm:text-base text-(--cf-ink-soft) leading-relaxed">
            Top Quiz participants will be displayed here once answers are submitted!
          </p>
        </div>
      ) : (
        <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center gap-2.5 py-4 overflow-hidden">
          <AnimatePresence>
            {participants.map((player, index) => {
              const rank = player.rank || index + 1;
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;
              const color = AVATAR_COLORS[index % AVATAR_COLORS.length];

              return (
                <motion.div
                  key={player.participantId || `player-${index}`}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{
                    type: "spring",
                    stiffness: 80,
                    damping: 14,
                    delay: index * 0.04,
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
                      style={{ backgroundColor: color }}
                    >
                      {player.nickname.slice(0, 2)}
                    </div>

                    {/* Participant Name */}
                    <span className="font-bold text-sm sm:text-base text-neutral-900 truncate">
                      {player.nickname}
                    </span>
                  </div>

                  {/* Right: Total Score */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right font-mono font-bold text-base sm:text-lg text-neutral-900 tabular-nums">
                      {(player.score || 0).toLocaleString()}{" "}
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
