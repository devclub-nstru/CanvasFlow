"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { MentiSlide, MentiLeaderboardSnapshot, MentiLeaderboardParticipant } from "~/lib/menti";
import { Trophy, Award, TrendingUp } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

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

/** Stable deterministic color generator per participant identity */
function getParticipantColor(participantId?: string, nickname?: string) {
  const str = participantId || nickname || "participant";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Counts from the previously displayed score to the target.
 *
 * It seeds at 0 rather than at `value`, so the FIRST render animates upward
 * instead of snapping straight to the final number. That first render is
 * exactly the moment the presenter lands on the leaderboard slide — the slide
 * unmounts and remounts on every visit — so this is what makes arriving on the
 * standings feel like a reveal rather than a static table. Subsequent live
 * updates still tween from wherever the counter already was.
 */
function AnimatedScoreNumber({
  value,
  delayMs = 0,
  animateOnMount = true,
}: {
  value: number;
  delayMs?: number;
  animateOnMount?: boolean;
}) {
  const [displayed, setDisplayed] = useState(animateOnMount ? 0 : value);
  const prevRef = useRef(animateOnMount ? 0 : value);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    if (from === to) {
      setDisplayed(to);
      return;
    }

    /* Only the entrance is staggered; a live score change should land
     * immediately, not queue behind a rank-ordered delay. */
    const delay = hasMountedRef.current ? 0 : delayMs;
    hasMountedRef.current = true;

    let animId: number;
    let timeoutId: ReturnType<typeof setTimeout>;

    const run = () => {
    const startTime = performance.now();
    const duration = 750; // ms

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (to - from) * eased));

      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      }
    };

      animId = requestAnimationFrame(animate);
    };

    if (delay > 0) timeoutId = setTimeout(run, delay);
    else run();

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(animId);
    };
  }, [value, delayMs]);

  return <span>{displayed.toLocaleString()}</span>;
}

export function LeaderboardViewer({ slide, analytics, leaderboard, isPreview = false }: Props) {
  /* A full-screen leaderboard filling in is a lot of motion. Honour the
   * viewer's OS-level preference and render the final state directly. */
  const prefersReducedMotion = useReducedMotion();

  /* Rank-ordered stagger, so the standings build from the bottom of the board
   * up to first place instead of every row landing at once. */
  const ENTRANCE_STEP_MS = 90;
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

  // Keep a map of previous scores to calculate round points gained
  const prevScoresMapRef = useRef<Record<string, number>>({});

  // Compute displayed list sorted by current score
  const displayedParticipants = useMemo(() => {
    if (rawParticipants.length === 0) return [];

    const prevMap = prevScoresMapRef.current;

    const mapped = rawParticipants.map((p) => {
      const id = p.participantId || p.nickname;
      const prevScore = prevMap[id] ?? 0;
      const currentScore = p.score || 0;
      const pointsGained = prevScore > 0 ? Math.max(0, currentScore - prevScore) : 0;

      return {
        ...p,
        prevScore,
        currentScore,
        pointsGained,
      };
    });

    // Always sort descending by current score and strictly cap to top 10
    return mapped
      .sort((a, b) => b.currentScore - a.currentScore)
      .slice(0, 10)
      .map((p, idx) => ({
        ...p,
        rank: idx + 1,
      }));
  }, [rawParticipants]);

  // Update previous scores ref when data stabilizes
  useEffect(() => {
    if (rawParticipants.length > 0) {
      const newMap: Record<string, number> = {};
      rawParticipants.forEach((p) => {
        const id = p.participantId || p.nickname;
        newMap[id] = p.score || 0;
      });
      prevScoresMapRef.current = newMap;
    }
  }, [rawParticipants]);

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
          className={`font-medium leading-snug tracking-[-0.035em] break-words w-full max-w-5xl ${
            isPreview
              ? "text-lg sm:text-xl max-w-lg"
              : "text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] max-w-3xl"
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
              const rank = player.rank;
              /* Last place animates first, #1 last. */
              const entranceDelayMs = prefersReducedMotion
                ? 0
                : (displayedParticipants.length - 1 - index) * ENTRANCE_STEP_MS;
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;
              const color = getParticipantColor(player.participantId, player.nickname);

              const barFillPercent =
                maxScore > 0 ? Math.max(6, (player.currentScore / maxScore) * 100) : 0;

              return (
                <motion.div
                  key={player.participantId || `player-${player.nickname}`}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{
                    layout: { type: "spring", stiffness: 120, damping: 20 },
                    opacity: { duration: 0.25, delay: entranceDelayMs / 1000 },
                    y: { duration: 0.3, delay: entranceDelayMs / 1000 },
                    scale: { duration: 0.3, delay: entranceDelayMs / 1000 },
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
                  {/* Dynamic Animated Horizontal Bar Fill with Smooth Spring Physics matching BarGraph */}
                  <motion.div
                    /* `initial` applies only at mount, so the bar grows from
                     * zero when the slide is opened while later live updates
                     * still tween smoothly from their current width. */
                    initial={prefersReducedMotion ? false : { width: 0 }}
                    animate={{
                      width: `${barFillPercent}%`,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 75,
                      damping: 15,
                      mass: 0.85,
                      delay: entranceDelayMs / 1000,
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

                    {/* Avatar Circle with Stable Color */}
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
                    {/* Points Gained Pill */}
                    {player.pointsGained > 0 && (
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

                    {/* Score Number with Smooth Counter */}
                    <div
                      className={`font-mono font-bold ${
                        isCompact ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                      } text-(--cf-ink) tabular-nums`}
                    >
                      <AnimatedScoreNumber
                        value={player.currentScore}
                        delayMs={entranceDelayMs}
                        animateOnMount={!prefersReducedMotion}
                      />{" "}
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

