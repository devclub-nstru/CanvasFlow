"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MentiSlide } from "~/lib/menti";
import { Trophy, Medal, Award, ChevronUp, ChevronDown, Minus, Sparkles } from "lucide-react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "motion/react";
import {
  claimReveal,
  hasPlayedReveal,
  orderForDisplay,
  selectVisible,
  standingsSignature,
  type RevealMode,
} from "~/lib/leaderboard";

interface Props {
  slide: MentiSlide;
  analytics?: any;
  isPreview?: boolean;
  showQuestion?: boolean;
}

interface RawRow {
  participantId: string;
  nickname: string;
  totalPoints: number;
  correctCount: number;
  answered: number;
}

interface Row {
  participantId: string;
  nickname: string;
  points: number;
  prevPoints: number;
  delta: number;
  rank: number;
  /** null when this player had no score before this question. */
  prevRank: number | null;
}

const PODIUM = [
  { icon: Trophy, bar: "#e4a23e", chip: "bg-[#e4a23e]", glow: "shadow-[0_0_0_3px_rgba(228,162,62,0.18)]" },
  { icon: Medal, bar: "#9189eb", chip: "bg-[#9189eb]", glow: "shadow-[0_0_0_3px_rgba(145,137,235,0.16)]" },
  { icon: Award, bar: "#43b7a6", chip: "bg-[#43b7a6]", glow: "shadow-[0_0_0_3px_rgba(67,183,166,0.16)]" },
];
const REST_BAR = "#5268e8";

const MAX_ROWS = 10;

/*
 * Choreography, in three beats:
 *
 *   hold      — the previous standings sit still, so the room reads them
 *   counting  — scores begin climbing
 *   ordered   — positions glide to their new places, part-way through the climb
 *
 * The third beat is deliberately late. Reordering at the same instant the count
 * starts made the rows snap to their final places while the numbers were still
 * moving, which read backwards: the outcome arrived before the reason for it.
 */
const REVEAL_DELAY_MS = 700;
const COUNT_UP_S = 1.6;
const SWAP_AFTER_MS = 600;

/** Gap between each row starting its climb — reads as a cascade, not a jolt. */
const ROW_STAGGER_S = 0.06;

/**
 * Long, heavily damped glide for the position change. Softer than a snappy UI
 * spring on purpose: this is the moment the audience is watching, and overshoot
 * on a rank swap looks like a mistake.
 */
const REORDER_SPRING = { type: "spring", stiffness: 170, damping: 24, mass: 1 } as const;
/** Matches the count-up so bar and number arrive together. */
const COUNT_EASE = [0.16, 1, 0.3, 1] as const;

type Stage =
  | "hold" // previous standings, still
  | "counting" // scores climbing
  | "ordered" // positions moved, animation finishing
  | "settled"; // final result, shown without animating

function RankDelta({ row, visible }: { row: Row; visible: boolean }) {
  return (
    <span className="flex w-10 items-center justify-end">
      <AnimatePresence>
        {visible && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex items-center gap-0.5 font-mono text-[10px] font-black tabular-nums"
          >
            {row.prevRank === null ? (
              <span className="flex items-center gap-0.5 text-(--cf-orange)">
                <Sparkles className="size-3" />
                NEW
              </span>
            ) : row.prevRank === row.rank ? (
              <Minus className="size-3 text-(--cf-ink-soft)" />
            ) : row.prevRank > row.rank ? (
              <span className="flex items-center gap-0.5 text-emerald-600">
                <ChevronUp className="size-3 stroke-[3]" />
                {row.prevRank - row.rank}
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-rose-500">
                <ChevronDown className="size-3 stroke-[3]" />
                {row.rank - row.prevRank}
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function LeaderboardRow({
  row,
  counting,
  ordered,
  instant,
  maxPoints,
  isPreview,
}: {
  row: Row;
  /** Scores are climbing. */
  counting: boolean;
  /** Positions have moved to their final order. */
  ordered: boolean;
  /** Render the finished result with no animation (a revisit). */
  instant: boolean;
  maxPoints: number;
  isPreview: boolean;
}) {
  /*
   * The score climbs on a motion value rather than React state. Driving it with
   * setState re-rendered every row on every animation frame, which is what made
   * the reorder stutter. Framer writes the DOM directly instead, and the bar and
   * the number read from the same value so they can never drift apart.
   */
  const score = useMotionValue(row.prevPoints);

  // Read through a ref so the transform always uses the current scale.
  const maxRef = useRef(maxPoints);
  maxRef.current = maxPoints;

  const scoreLabel = useTransform(score, (value) => Math.round(value).toLocaleString());
  const barWidth = useTransform(score, (value) => {
    const ceiling = Math.max(1, maxRef.current);
    return `${Math.max(2, Math.min(100, (value / ceiling) * 100))}%`;
  });

  /*
   * Stagger from the FINAL rank, not the display index. The display index
   * changes when positions swap, and using it here restarted the count-up
   * mid-climb because it sits in this effect's dependencies.
   */
  const staggerIndex = Math.max(0, row.rank - 1);

  useEffect(() => {
    // A revisit jumps straight to the final total — no second count-up.
    if (instant) {
      score.set(row.points);
      return;
    }
    if (!counting) {
      score.set(row.prevPoints);
      return;
    }

    const controls = animate(score, row.points, {
      duration: COUNT_UP_S,
      delay: staggerIndex * ROW_STAGGER_S,
      ease: COUNT_EASE,
    });
    return () => controls.stop();
  }, [instant, counting, row.points, row.prevPoints, staggerIndex, score]);

  /*
   * Position comes from the data, never from the array index. The index was
   * unreliable while exiting rows were still mounted, which is what produced
   * duplicated rank badges during the reorder.
   */
  const displayRank = ordered ? row.rank : row.prevRank;
  const podium = ordered && row.rank <= PODIUM.length ? PODIUM[row.rank - 1] : undefined;
  const Icon = podium?.icon;

  return (
    <motion.div
      /*
       * `layout` owns every positional change. The entrance animates opacity
       * only — a `y` transition here also writes to transform, and the two
       * fought each other on every reorder, which was the visible stutter.
       */
      /*
       * Layout tracking is switched OFF once settled. Belt and braces with the
       * first-render decision above: if the standings were to arrive late on a
       * revisit, framer would otherwise animate the correction into place and the
       * rows would appear to re-shuffle.
       */
      layout={instant ? false : "position"}
      // On a revisit there is nothing to reveal, so skip the fade-in cascade too.
      initial={instant ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        layout: REORDER_SPRING,
        opacity: instant
          ? { duration: 0 }
          : { duration: 0.35, ease: "easeOut", delay: staggerIndex * 0.04 },
      }}
      className={`relative flex items-center gap-2.5 overflow-hidden rounded-2xl border-2 bg-white transition-[border-color,box-shadow] duration-500 ${
        isPreview ? "px-2 py-1" : "px-3 py-2.5"
      } ${podium ? `border-(--cf-line-strong) ${podium.glow}` : "border-(--cf-line)"}`}
    >
      {/* Score bar, sharing the count-up's motion value. */}
      <motion.div
        className="absolute inset-y-0 left-0"
        style={{
          width: barWidth,
          backgroundColor: podium?.bar ?? REST_BAR,
          opacity: 0.16,
        }}
      />

      <span
        className={`relative grid shrink-0 place-items-center rounded-xl font-mono font-black text-white tabular-nums transition-colors duration-500 ${
          podium ? podium.chip : "bg-(--cf-ink)"
        } ${isPreview ? "size-5 text-[10px]" : "size-9 text-sm"}`}
      >
        {Icon && !isPreview ? <Icon className="size-4" /> : (displayRank ?? "–")}
      </span>

      <span
        className={`relative min-w-0 flex-1 truncate font-bold text-(--cf-ink) ${
          isPreview ? "text-[11px]" : "text-base sm:text-lg"
        }`}
        title={row.nickname}
      >
        {row.nickname}
      </span>

      {!isPreview && <RankDelta row={row} visible={ordered} />}

      {/* Points gained on the question that just finished. A one-off flourish,
          so it is not replayed when the host steps back to this slide. */}
      <AnimatePresence>
        {counting && !instant && row.delta > 0 && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{
              duration: COUNT_UP_S + 0.3,
              times: [0, 0.15, 0.75, 1],
              ease: "easeOut",
              delay: staggerIndex * ROW_STAGGER_S,
            }}
            className={`relative shrink-0 font-mono font-black text-emerald-600 tabular-nums ${
              isPreview ? "text-[9px]" : "text-sm"
            }`}
          >
            +{row.delta}
          </motion.span>
        )}
      </AnimatePresence>

      <motion.span
        className={`relative shrink-0 font-mono font-black text-(--cf-ink) tabular-nums ${
          isPreview ? "text-[10px]" : "text-lg sm:text-xl"
        }`}
      >
        {scoreLabel}
      </motion.span>
    </motion.div>
  );
}

export function LeaderboardViewer({ slide, analytics, isPreview, showQuestion = true }: Props) {
  /*
   * Only a LEADERBOARD payload may drive this slide. Other slide types carry
   * their own analytics shapes, and consuming one here produced an animation
   * from an empty baseline that then restarted.
   */
  const board = analytics?.type === "LEADERBOARD" ? analytics : null;

  /**
   * The "before" snapshot, captured once per slide.
   *
   * Analytics is re-broadcast on a throttle, so reading `previous` straight from
   * every payload changed the count-up's starting value mid-animation and the
   * numbers visibly restarted. Freezing it means the reveal plays exactly once.
   */
  const baselineRef = useRef<{
    slideId: string;
    points: Map<string, number>;
    ranks: Map<string, number>;
  } | null>(null);

  /*
   * Computed from the payload directly, BEFORE rows, so the reveal decision is
   * available while rows are still being built. Only ids and points matter.
   */
  const signature = useMemo(() => {
    const current = (board?.leaderboard ?? []) as RawRow[];
    return standingsSignature(
      current.map((row) => ({
        participantId: String(row.participantId),
        points: row.totalPoints,
      })),
    );
  }, [board]);

  /*
   * Resolved during the FIRST render, not in an effect.
   *
   * Deciding it in an effect meant the initial paint still showed the pre-reveal
   * state and was corrected a tick later; framer's layout tracking saw those
   * positions change and animated the correction, so the count-up was skipped
   * while the rows still visibly shifted.
   */
  const [stage, setStage] = useState<Stage>(() =>
    hasPlayedReveal(slide.id, signature) ? "settled" : "hold",
  );

  const instant = stage === "settled";

  const rows = useMemo<Row[]>(() => {
    if (!board) return [];

    const current = (board.leaderboard ?? []) as RawRow[];

    /*
     * Already revealed: collapse "before" onto "after".
     *
     * With prevPoints === points and prevRank === rank there is no delta to
     * count up, no reordering between the pre- and post-swap lists, and the
     * score's motion value initialises at its final value. Nothing in the
     * settled state can animate, rather than relying on flags being applied
     * before the first paint.
     */
    if (instant) {
      return current.map((row, index) => ({
        participantId: String(row.participantId),
        nickname: row.nickname || "Unknown",
        points: row.totalPoints,
        prevPoints: row.totalPoints,
        delta: 0,
        rank: index + 1,
        prevRank: index + 1,
      }));
    }

    if (!baselineRef.current || baselineRef.current.slideId !== slide.id) {
      const previous = (board.previous ?? []) as RawRow[];
      const points = new Map<string, number>();
      const ranks = new Map<string, number>();
      previous.forEach((row, index) => {
        points.set(String(row.participantId), row.totalPoints);
        ranks.set(String(row.participantId), index + 1);
      });
      baselineRef.current = { slideId: slide.id, points, ranks };
    }

    const baseline = baselineRef.current;

    return current.map((row, index) => {
      const id = String(row.participantId);
      const prevPoints = baseline.points.get(id) ?? 0;
      return {
        participantId: id,
        nickname: row.nickname || "Unknown",
        points: row.totalPoints,
        prevPoints,
        delta: row.totalPoints - prevPoints,
        rank: index + 1,
        prevRank: baseline.ranks.get(id) ?? null,
      };
    });
  }, [board, slide.id, instant]);

  /**
   * The reveal decision for this mount.
   *
   * Held in a ref so it survives StrictMode's double effect invocation in
   * development — re-claiming would report "settled" on the second pass and skip
   * the animation entirely.
   */
  const decisionRef = useRef<{ signature: string; mode: RevealMode } | null>(null);

  useEffect(() => {
    if (!signature) return;
    // Settled at first render already: nothing to arm.
    if (instant) return;

    let mode: RevealMode;
    if (decisionRef.current?.signature === signature) {
      mode = decisionRef.current.mode;
    } else {
      mode = claimReveal(slide.id, signature);
      decisionRef.current = { signature, mode };
    }

    // Already revealed these standings: render the finished result outright.
    if (mode === "settled") {
      setStage("settled");
      return;
    }

    setStage("hold");

    const startCount = setTimeout(() => setStage("counting"), REVEAL_DELAY_MS);
    const startSwap = setTimeout(
      () => setStage("ordered"),
      REVEAL_DELAY_MS + SWAP_AFTER_MS,
    );

    return () => {
      clearTimeout(startCount);
      clearTimeout(startSwap);
    };
  }, [signature, slide.id, instant]);

  const counting = stage !== "hold";
  const ordered = stage === "ordered" || instant;

  /*
   * Membership is fixed by FINAL rank and held for the whole reveal.
   *
   * Slicing after reordering changed who was in the top ten mid-animation, so
   * players who dropped out were removed while AnimatePresence was still fading
   * them. Those exiting rows kept their place in the flow, which briefly pushed
   * the list past ten entries — the duplicated rank badges and overlapping rows.
   * Keeping the same players throughout means the reveal only ever reorders.
   */
  const visible = useMemo(
    () => selectVisible(rows, isPreview ? 5 : MAX_ROWS),
    [rows, isPreview],
  );

  const shown = useMemo(() => orderForDisplay(visible, ordered), [visible, ordered]);

  const maxPoints = Math.max(1, ...rows.map((row) => row.points));
  const hidden = rows.length - shown.length;
  const textColor = slide.designSettings.textColor || "#17171c";

  return (
    <section
      className="relative mx-auto flex h-full w-full max-w-3xl flex-col select-none"
      style={{ color: textColor }}
    >
      {showQuestion && (
        <div className="flex w-full shrink-0 flex-col items-center text-center">
          <h2
            className={`font-medium leading-[1.1] tracking-[-0.04em] ${
              isPreview ? "mb-1 text-xl sm:text-2xl" : "mb-1 text-3xl sm:text-4xl md:text-5xl"
            }`}
          >
            {slide.question || "Leaderboard"}
          </h2>
          <div className="mb-2 flex h-5 items-center">
            {rows.length > 0 && (
              <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-(--cf-ink-soft) tabular-nums">
                {rows.length} {rows.length === 1 ? "player" : "players"}
              </span>
            )}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400">
          <Trophy className={`mb-3 ${isPreview ? "size-7" : "size-10"}`} />
          <p className={`font-medium ${isPreview ? "text-xs" : "text-sm"}`}>
            Scores appear once a quiz question has been answered
          </p>
        </div>
      ) : (
        <div className={`flex min-h-0 flex-1 flex-col justify-center ${isPreview ? "gap-1" : "gap-2"}`}>
          {/* popLayout takes exiting rows out of the flow, so a genuine removal
              (membership changing between questions) cannot push the remaining
              rows around while it fades. */}
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((row) => (
              <LeaderboardRow
                key={row.participantId}
                row={row}
                counting={counting}
                ordered={ordered}
                instant={instant}
                maxPoints={maxPoints}
                isPreview={!!isPreview}
              />
            ))}
          </AnimatePresence>

          {hidden > 0 && (
            <p className="mt-1 text-center font-mono text-[10px] font-bold tracking-wider uppercase text-(--cf-ink-soft)">
              +{hidden} more {hidden === 1 ? "player" : "players"}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
