"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { MentiSlide, MentiLeaderboardSnapshot, MentiLeaderboardParticipant } from "~/lib/menti";
import { Trophy, Award, TrendingUp } from "lucide-react";
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

/** Smoothly counts up from previous score to target score */
function AnimatedScoreNumber({ target, initial }: { target: number; initial: number }) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (initial === target) {
      setValue(target);
      return;
    }
    const startTime = performance.now();
    const duration = 800; // ms

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(initial + (target - initial) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const handle = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(handle);
  }, [target, initial]);

  return <span>{value.toLocaleString()}</span>;
}

export function LeaderboardViewer({ slide, analytics, leaderboard, isPreview = false }: Props) {
  // Extract raw participants from props
  const rawParticipants = useMemo<MentiLeaderboardParticipant[]>(() => {
    let rawList: MentiLeaderboardParticipant[] = [];
    if (leaderboard?.topParticipants && Array.isArray(leaderboard.topParticipants) && leaderboard.topParticipants.length > 0) {
      rawList = leaderboard.topParticipants;
    } else if (analytics?.topParticipants && Array.isArray(analytics.topParticipants) && analytics.topParticipants.length > 0) {
      rawList = analytics.topParticipants;
    } else if (analytics?.leaderboard && Array.isArray(analytics.leaderboard) && analytics.leaderboard.length > 0) {
      rawList = analytics.leaderboard.map((p: any, idx: number) => ({
        participantId: String(p.participantId || p.id || `p-${idx}`),
        nickname: p.nickname || p.name || `Player ${idx + 1}`,
        score: typeof p.score === "number" ? p.score : 0,
        rank: p.rank || idx + 1,
      }));
    } else if (isPreview) {
      rawList = PREVIEW_SAMPLE_LEADERBOARD;
    }
    return rawList;
  }, [leaderboard, analytics, isPreview]);

  // Stage 0: Initial mount with previous scores
  // Stage 1: Horizontal bar growth & score count-up (at 500ms)
  // Stage 2: Smooth reordering into new ranks (at 1400ms)
  const [animationPhase, setAnimationPhase] = useState<"initial" | "grow" | "reorder">("initial");

  // Read previous scores from sessionStorage or ref to know previous baseline
  const prevScoresMapRef = useRef<Record<string, number>>({});

  useEffect(() => {
    // 1. Read stored previous scores from session storage
    if (typeof window !== "undefined" && !isPreview) {
      try {
        const stored = sessionStorage.getItem("cf_menti_leaderboard_prev_scores");
        if (stored) {
          prevScoresMapRef.current = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Failed to read prev leaderboard scores", e);
      }
    }

    // Reset phase on slide mount
    setAnimationPhase("initial");

    // Timer 1: Grow horizontal bars and count up numbers
    const timer1 = setTimeout(() => {
      setAnimationPhase("grow");
    }, 500);

    // Timer 2: Reorder cards by new rank
    const timer2 = setTimeout(() => {
      setAnimationPhase("reorder");

      // Save current scores as new previous baseline for next round
      if (typeof window !== "undefined" && !isPreview && rawParticipants.length > 0) {
        try {
          const newMap: Record<string, number> = {};
          rawParticipants.forEach((p) => {
            if (p.participantId) newMap[p.participantId] = p.score || 0;
          });
          sessionStorage.setItem("cf_menti_leaderboard_prev_scores", JSON.stringify(newMap));
          prevScoresMapRef.current = newMap;
        } catch (e) {
          console.error("Failed to save prev leaderboard scores", e);
        }
      }
    }, 1400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [slide.id, rawParticipants, isPreview]);

  // Compute displayed list based on animation phase
  const displayedParticipants = useMemo(() => {
    if (rawParticipants.length === 0) return [];

    const prevMap = prevScoresMapRef.current;

    // Map participants with previous score and points gained
    const mapped = rawParticipants.map((p) => {
      const prevScore = prevMap[p.participantId] ?? 0;
      const currentScore = p.score || 0;
      const pointsGained = Math.max(0, currentScore - prevScore);

      return {
        ...p,
        prevScore,
        currentScore,
        pointsGained,
      };
    });

    // If initial or grow phase: sort by previous score (or current if all prev scores were 0)
    const hasPriorHistory = mapped.some((m) => m.prevScore > 0);
    if (animationPhase !== "reorder" && hasPriorHistory) {
      mapped.sort((a, b) => b.prevScore - a.prevScore);
    } else {
      mapped.sort((a, b) => b.currentScore - a.currentScore);
    }

    // Always strictly cap to top 10
    return mapped.slice(0, 10).map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));
  }, [rawParticipants, animationPhase]);

  // Calculate highest score to scale horizontal bar widths proportionally (0% to 100%)
  const maxScore = useMemo(() => {
    const highest = Math.max(1, ...displayedParticipants.map((p) => p.currentScore));
    return highest;
  }, [displayedParticipants]);

  const heading = slide.question || slide.designSettings?.leaderboardTitle || "Quiz leaderboard";
  const textColor = slide.designSettings?.textColor || "#17171c";
  const hasData = displayedParticipants.length > 0;
  const isCompact = displayedParticipants.length > 6;

  return (
    <section
      className="flex flex-col justify-between items-center h-full w-full max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 select-none relative"
      style={{ color: textColor }}
    >
      {/* 1. Heading Title */}
      <div className="w-full flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-white border-2 border-(--cf-line-strong) cf-raised rounded-full text-xs font-mono font-bold uppercase tracking-wider mb-1.5">
          <Trophy className="w-4 h-4 text-(--cf-orange)" />
          <span>Top 10 Standings</span>
        </div>
        <h2
          className={`font-medium leading-[1.1] tracking-[-0.04em] ${
            isPreview
              ? "text-2xl sm:text-3xl max-w-xl"
              : isCompact
              ? "text-2xl sm:text-3xl md:text-4xl max-w-3xl"
              : "text-3xl sm:text-4xl md:text-5xl lg:text-6xl max-w-3xl"
          }`}
        >
          {heading}
        </h2>
      </div>

      {/* 2. Content Area: Empty State vs Animated Horizontal Bar Leaderboard */}
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
        <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center gap-2 sm:gap-2.5 py-2 max-h-[66vh] overflow-y-auto overflow-x-hidden pr-0.5">
          <AnimatePresence mode="popLayout">
            {displayedParticipants.map((player, index) => {
              const rank = player.rank || index + 1;
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;
              const color = AVATAR_COLORS[index % AVATAR_COLORS.length];

              // Target score and fill calculation based on animation phase
              const activeScore =
                animationPhase === "initial"
                  ? player.prevScore
                  : player.currentScore;

              const barFillPercent =
                maxScore > 0
                  ? Math.max(6, (activeScore / maxScore) * 100)
                  : 0;

              return (
                <motion.div
                  key={player.participantId || `player-${index}`}
                  layout="position"
                  initial={{ opacity: 0, y: 15, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{
                    layout: { type: "spring", stiffness: 240, damping: 24 },
                    opacity: { duration: 0.2 },
                  }}
                  className={`w-full relative overflow-hidden rounded-xl border-2 cf-raised flex items-center justify-between px-3 sm:px-4 ${
                    isCompact ? "h-11 sm:h-12" : "h-12 sm:h-14"
                  } transition-colors ${
                    isFirst
                      ? "bg-amber-50/80 border-amber-500 ring-2 ring-amber-400/50"
                      : isSecond
                      ? "bg-slate-50/80 border-slate-400"
                      : isThird
                      ? "bg-amber-50/30 border-amber-700/50"
                      : "bg-white border-(--cf-line-strong)"
                  }`}
                >
                  {/* Dynamic Animated Horizontal Bar Fill */}
                  <motion.div
                    initial={false}
                    animate={{
                      width: `${barFillPercent}%`,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 65,
                      damping: 15,
                      mass: 0.85,
                    }}
                    className={`absolute inset-y-0 left-0 rounded-l-lg opacity-25 sm:opacity-30 ${
                      isFirst ? "bg-amber-400 opacity-40" : ""
                    }`}
                    style={{ backgroundColor: isFirst ? "#f59e0b" : color }}
                  />

                  {/* Left Layer: Rank Badge + Avatar + Player Name */}
                  <div className="relative z-10 flex items-center gap-2.5 sm:gap-3 min-w-0 pointer-events-none">
                    {/* Rank Badge */}
                    <div
                      className={`${
                        isCompact ? "size-6 text-[11px]" : "size-7 text-xs"
                      } rounded-lg flex items-center justify-center font-mono font-bold shrink-0 shadow-xs ${
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
                      className={`${
                        isCompact ? "size-6 text-[10px]" : "size-7 text-[11px]"
                      } rounded-full flex items-center justify-center text-white font-bold shrink-0 uppercase shadow-xs`}
                      style={{ backgroundColor: color }}
                    >
                      {player.nickname.slice(0, 2)}
                    </div>

                    {/* Nickname */}
                    <span
                      className={`font-semibold ${
                        isCompact ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                      } text-(--cf-ink) truncate`}
                    >
                      {player.nickname}
                    </span>
                  </div>

                  {/* Right Layer: Score Counter + Gained Points Pill */}
                  <div className="relative z-10 flex items-center gap-2 shrink-0 pointer-events-none">
                    {/* Points Gained Pill (animates in when points were gained) */}
                    {animationPhase !== "initial" && player.pointsGained > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, x: 8 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 18 }}
                        className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-mono font-bold uppercase"
                      >
                        <TrendingUp className="size-3 text-emerald-600 stroke-[3]" />
                        <span>+{player.pointsGained}</span>
                      </motion.div>
                    )}

                    {/* Score Number with Counting Animation */}
                    <div
                      className={`font-mono font-bold ${
                        isCompact ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                      } text-(--cf-ink) tabular-nums`}
                    >
                      {animationPhase === "initial" ? (
                        <span>{(player.prevScore || 0).toLocaleString()}</span>
                      ) : (
                        <AnimatedScoreNumber
                          target={player.currentScore}
                          initial={player.prevScore}
                        />
                      )}{" "}
                      <span className="text-[10px] sm:text-xs font-normal text-(--cf-ink-soft)">pts</span>
                    </div>
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

