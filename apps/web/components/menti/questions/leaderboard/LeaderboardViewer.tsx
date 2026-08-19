"use client";

import React, { useMemo } from "react";
import { MentiSlide, MentiLeaderboardSnapshot, MentiLeaderboardParticipant } from "~/lib/menti";
import { Trophy, Award } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  slide: MentiSlide;
  analytics?: any;
  leaderboard?: MentiLeaderboardSnapshot | null;
  isPreview?: boolean;
}

const AVATAR_COLORS = [
  "#5268e8",
  "#ff7378",
  "#313c8e",
  "#9189eb",
  "#43b7a6",
  "#e4a23e",
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
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-(--cf-line-strong) cf-raised rounded-full text-xs font-mono font-bold uppercase tracking-wider mb-2">
          <Trophy className="w-3.5 h-3.5 text-(--cf-orange)" />
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
          <div className="size-14 rounded-2xl bg-white border-2 border-(--cf-line-strong) cf-raised flex items-center justify-center mb-4">
            <Award className="size-7 text-(--cf-ink-soft)" />
          </div>
          <h3 className="cf-display text-xl sm:text-2xl uppercase tracking-tight text-(--cf-ink)">
            No results yet
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-(--cf-ink-soft) leading-relaxed">
            Quiz participants and scores will appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="w-full max-w-xl mx-auto flex-1 flex flex-col justify-center gap-2 py-4 overflow-hidden">
                  <AnimatePresence mode="popLayout">
            {participants.map((player, index) => {
              const rank = player.rank || index + 1;
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;
              const color = AVATAR_COLORS[index % AVATAR_COLORS.length];

              return (
                <motion.div
                  key={player.participantId || `player-${index}`}
                  layout="position"
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    layout: { type: "spring", stiffness: 260, damping: 24 },
                    opacity: { duration: 0.2 },
                  }}
                  className={`w-full cf-raised px-4 py-2.5 sm:py-3 rounded-xl border-2 flex items-center justify-between gap-4 transition-colors ${
                    isFirst
                      ? "bg-amber-50/90 border-amber-500 ring-1 ring-amber-400"
                      : isSecond
                      ? "bg-slate-50 border-slate-400"
                      : isThird
                      ? "bg-amber-50/30 border-amber-700/50"
                      : "bg-white border-(--cf-line-strong)"
                  }`}
                >
                  {/* Left: Rank Badge + Avatar + Nickname */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Badge */}
                    <div
                      className={`size-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        isFirst
                          ? "bg-amber-500 text-white"
                          : isSecond
                          ? "bg-slate-400 text-white"
                          : isThird
                          ? "bg-amber-700 text-white"
                          : "bg-(--cf-cream) border border-(--cf-line-strong) text-(--cf-ink)"
                      }`}
                    >
                      #{rank}
                    </div>

                    {/* Avatar Circle */}
                    <div
                      className="size-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0 uppercase"
                      style={{ backgroundColor: color }}
                    >
                      {player.nickname.slice(0, 2)}
                    </div>

                    {/* Participant Name */}
                    <span className="font-semibold text-sm sm:text-base text-(--cf-ink) truncate">
                      {player.nickname}
                    </span>
                  </div>

                  {/* Right: Total Score */}
                  <div className="flex items-center gap-1.5 shrink-0 font-mono font-bold text-sm sm:text-base text-(--cf-ink) tabular-nums">
                    {(player.score || 0).toLocaleString()}{" "}
                    <span className="text-xs font-normal text-(--cf-ink-soft)">pts</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

