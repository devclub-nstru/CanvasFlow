"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MentiSlide } from "~/lib/menti";
import { CheckCircle2, XCircle, Clock, Zap, Hourglass } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { projectedPoints, readTiming, useQuizWindow } from "~/lib/quiz";

interface Props {
  slide: MentiSlide;
  onSubmit: (optionIds: string[]) => Promise<any> | void;
  hasSubmitted?: boolean;
  questionStartedAt?: string | null;
  serverOffsetMs?: number;
}

interface Outcome {
  isCorrect: boolean;
  pointsAwarded: number;
  responseTimeMs: number;
}

/** Fixed shapes/colours per answer slot, the way Kahoot keys them. */
const SLOTS = [
  { color: "#5268e8", glyph: "▲" },
  { color: "#ff7378", glyph: "◆" },
  { color: "#e4a23e", glyph: "●" },
  { color: "#43b7a6", glyph: "■" },
  { color: "#9189eb", glyph: "★" },
  { color: "#313c8e", glyph: "✚" },
];

export function QuizAudience({
  slide,
  onSubmit,
  hasSubmitted,
  questionStartedAt,
  serverOffsetMs = 0,
}: Props) {
  const timing = useMemo(() => readTiming(slide.responseSettings), [slide.responseSettings]);
  const { phase, msRemaining, msSinceOpen } = useQuizWindow(
    questionStartedAt,
    timing,
    serverOffsetMs,
  );

  const [lockedId, setLockedId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // A new question resets everything, including a previous round's verdict.
  useEffect(() => {
    setLockedId(null);
    setOutcome(null);
    setRejection(null);
    setPending(false);
  }, [slide.id, questionStartedAt]);

  /*
   * `hasSubmitted` comes from the server's record, so it survives a refresh —
   * local `lockedId` does not. Without it a participant could reload mid-question
   * and tap again, only to hit a confusing server rejection.
   */
  const answered = lockedId !== null || Boolean(hasSubmitted);

  const handlePick = async (optionId: string) => {
    if (answered || pending || phase !== "open") return;

    // Lock instantly — at speed-scoring stakes the tap must feel committed
    // before the round trip completes.
    setLockedId(optionId);
    setPending(true);
    setRejection(null);

    try {
      const result: any = await onSubmit([optionId]);
      if (result && typeof result.isCorrect === "boolean") {
        setOutcome({
          isCorrect: result.isCorrect,
          pointsAwarded: Number(result.pointsAwarded ?? 0),
          responseTimeMs: Number(result.responseTimeMs ?? 0),
        });
      }
    } catch (err: any) {
      // Server refused (too late, clock skew, duplicate) — release the lock so
      // the UI never claims an answer that was not recorded.
      setLockedId(null);
      setRejection(err?.message || "Your answer could not be recorded");
    } finally {
      setPending(false);
    }
  };

  const secondsLeft = Math.ceil(msRemaining / 1000);

  /* ── waiting for the host to start ─────────────────────────────────────── */

  if (phase === "idle") {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-10 text-center select-none">
        <Hourglass className="size-8 animate-pulse text-(--cf-ink-soft)" />
        <p className="text-sm font-bold text-(--cf-ink)">Get ready…</p>
        <p className="max-w-xs text-xs leading-relaxed text-(--cf-ink-soft)">
          The host is about to start this question.
        </p>
      </div>
    );
  }

  /* ── countdown: read the question, answers not yet open ───────────────── */

  if (phase === "countdown") {
    return (
      <div className="flex flex-col items-center space-y-5 py-6 text-center select-none">
        <h2 className="text-base font-bold leading-snug tracking-[-0.03em] text-(--cf-ink) sm:text-lg md:text-xl">
          {slide.question || "Get ready"}
        </h2>

        <motion.div
          key={secondsLeft}
          initial={{ scale: 0.55, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="grid size-24 place-items-center rounded-full border-4 border-(--cf-ink) bg-(--cf-cream) font-mono text-4xl font-black text-(--cf-ink) tabular-nums cf-raised"
        >
          {secondsLeft}
        </motion.div>

        <p className="font-mono text-[11px] font-bold tracking-wider uppercase text-(--cf-ink-soft)">
          Answers open in a moment
        </p>
      </div>
    );
  }

  /* ── answered, but the verdict is unknown (e.g. reloaded the page) ─────── */

  if (phase === "ended" && answered && !outcome) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-10 text-center select-none animate-in fade-in zoom-in-95 duration-200">
        <div className="grid size-14 place-items-center rounded-full border-2 border-(--cf-line-strong) bg-(--cf-cream) cf-raised">
          <CheckCircle2 className="size-7 text-(--cf-orange)" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold tracking-[-0.03em] text-(--cf-ink) sm:text-xl">
            Answer recorded
          </h3>
          <p className="mx-auto max-w-xs text-xs leading-relaxed text-(--cf-ink-soft) sm:text-sm">
            Check the main screen for the correct answer and the leaderboard.
          </p>
        </div>
      </div>
    );
  }

  /* ── time up without an answer ─────────────────────────────────────────── */

  if (phase === "ended" && !answered && !outcome) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-10 text-center select-none animate-in fade-in zoom-in-95 duration-200">
        <div className="grid size-14 place-items-center rounded-full border-2 border-(--cf-line-strong) bg-(--cf-cream) cf-raised">
          <Clock className="size-7 text-(--cf-ink-soft)" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold tracking-[-0.03em] text-(--cf-ink) sm:text-xl">
            Time&rsquo;s up!
          </h3>
          <p className="mx-auto max-w-xs text-xs leading-relaxed text-(--cf-ink-soft) sm:text-sm">
            No answer recorded for this one. Wait for the next question.
          </p>
        </div>
      </div>
    );
  }

  /* ── verdict ───────────────────────────────────────────────────────────── */

  if (outcome) {
    const good = outcome.isCorrect;
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center select-none animate-in fade-in zoom-in-95 duration-200">
        <motion.div
          initial={{ scale: 0.5, rotate: good ? -12 : 0 }}
          animate={{ scale: 1, rotate: 0 }}
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
            {good ? "Correct!" : "Not quite"}
          </h3>
          <p className="text-xs text-(--cf-ink-soft)">
            Answered in {(outcome.responseTimeMs / 1000).toFixed(1)}s
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
              +{outcome.pointsAwarded}
            </span>
          </motion.div>
        )}

        <p className="max-w-xs text-xs leading-relaxed text-(--cf-ink-soft)">
          Waiting for the host to reveal the results…
        </p>
      </div>
    );
  }

  /* ── open: pick an answer ──────────────────────────────────────────────── */

  const worth = projectedPoints(Math.max(0, msSinceOpen), timing);
  const urgent = msRemaining <= 5000;

  return (
    <div className="flex w-full flex-col space-y-4 select-none">
      <div className="space-y-1">
        <h2 className="text-base font-bold leading-snug tracking-[-0.03em] text-(--cf-ink) sm:text-lg md:text-xl">
          {slide.question || "Pick the correct answer"}
        </h2>
        <div className="flex items-center justify-between gap-3">
          <span className="cf-meta text-[11px] text-(--cf-ink-soft)">
            {answered ? "Answer locked in" : "Fastest correct answer scores most"}
          </span>
          {!answered && (
            <span className="font-mono text-[11px] font-bold text-(--cf-ink-soft) tabular-nums">
              worth {worth}
            </span>
          )}
        </div>
      </div>

      {/* Time remaining */}
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-sm font-black tabular-nums ${
            urgent ? "text-rose-600" : "text-(--cf-ink)"
          }`}
        >
          {secondsLeft}s
        </span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-(--cf-line) bg-(--cf-cream)">
          <motion.div
            className={`h-full rounded-full ${urgent ? "bg-rose-500" : "bg-(--cf-orange)"}`}
            initial={false}
            animate={{ width: `${Math.max(0, (msRemaining / timing.limitMs) * 100)}%` }}
            transition={{ ease: "linear", duration: 0.1 }}
          />
        </div>
      </div>

      <AnimatePresence>
        {rejection && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border-2 border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
          >
            {rejection}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {(slide.options ?? []).map((option, index) => {
          const slot = SLOTS[index % SLOTS.length]!;
          const isLocked = lockedId === option.id;
          const dimmed = answered && !isLocked;

          return (
            <motion.button
              key={option.id}
              type="button"
              disabled={answered || pending}
              onClick={() => handlePick(option.id)}
              whileTap={answered ? undefined : { scale: 0.97 }}
              animate={{ opacity: dimmed ? 0.35 : 1 }}
              className={`flex min-h-[60px] items-center gap-3 rounded-xl border-2 p-3 text-left transition-shadow ${
                isLocked
                  ? "border-(--cf-ink) ring-2 ring-(--cf-ink) cf-raised"
                  : "border-(--cf-line-strong) hover:shadow-md"
              } disabled:cursor-default`}
              style={{ backgroundColor: isLocked ? slot.color : "#fff" }}
            >
              <span
                className="grid size-8 shrink-0 place-items-center rounded-lg text-base font-black text-white"
                style={{ backgroundColor: slot.color }}
              >
                {slot.glyph}
              </span>
              <span
                className={`min-w-0 flex-1 text-sm font-bold break-words ${
                  isLocked ? "text-white" : "text-(--cf-ink)"
                }`}
              >
                {option.label || `Option ${index + 1}`}
              </span>
              {isLocked && <CheckCircle2 className="size-5 shrink-0 text-white" />}
            </motion.button>
          );
        })}
      </div>

      {answered && !outcome && (
        <p className="text-center font-mono text-[11px] font-bold tracking-wider uppercase text-(--cf-ink-soft)">
          {pending ? "Recording your answer…" : "Locked in"}
        </p>
      )}
    </div>
  );
}
