"use client";

import { useEffect, useState } from "react";
import type { MentiSlideResponseSettings, QuizPhase } from "./menti";

/**
 * Client mirror of apps/menti/src/realtime/quizEngine.ts.
 *
 * This drives the countdown UI only. The server re-derives the same window when
 * validating a submission, so it stays the authority — nothing here can widen a
 * participant's answering window.
 */

export const DEFAULT_COUNTDOWN_SECONDS = 5;
export const DEFAULT_TIME_LIMIT_SECONDS = 20;
export const DEFAULT_BASE_POINTS = 1000;

export interface QuizTiming {
  countdownMs: number;
  limitMs: number;
  basePoints: number;
}

export interface QuizWindow {
  phase: QuizPhase;
  msRemaining: number;
  msSinceOpen: number;
  /** 0..1 through the current phase, for progress rings and bars. */
  progress: number;
}

export function readTiming(settings?: MentiSlideResponseSettings): QuizTiming {
  const countdownSeconds = settings?.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS;
  const timeLimitSeconds = settings?.timeLimitSeconds ?? DEFAULT_TIME_LIMIT_SECONDS;
  const basePoints = settings?.basePoints ?? DEFAULT_BASE_POINTS;

  return {
    countdownMs: Math.max(0, countdownSeconds) * 1000,
    limitMs: Math.max(1, timeLimitSeconds) * 1000,
    basePoints: Math.max(0, basePoints),
  };
}

export function getQuizWindow(
  questionStartedAt: string | Date | null | undefined,
  timing: QuizTiming,
  now: number,
): QuizWindow {
  if (!questionStartedAt) {
    return { phase: "idle", msRemaining: 0, msSinceOpen: 0, progress: 0 };
  }

  const startedAt = new Date(questionStartedAt).getTime();
  if (Number.isNaN(startedAt)) {
    return { phase: "idle", msRemaining: 0, msSinceOpen: 0, progress: 0 };
  }

  const opensAt = startedAt + timing.countdownMs;
  const closesAt = opensAt + timing.limitMs;
  const msSinceOpen = now - opensAt;

  if (now < opensAt) {
    /*
     * Clamped to the configured countdown. If clock correction puts `now`
     * slightly before the start instant, the raw remainder exceeds the countdown
     * and the display would briefly show a larger number than was configured
     * (a "7" on a 5-second timer) before snapping back.
     */
    const msRemaining = Math.min(opensAt - now, timing.countdownMs);
    return {
      phase: "countdown",
      msRemaining,
      msSinceOpen,
      progress: timing.countdownMs > 0 ? 1 - msRemaining / timing.countdownMs : 1,
    };
  }

  if (now < closesAt) {
    const msRemaining = closesAt - now;
    return {
      phase: "open",
      msRemaining,
      msSinceOpen,
      progress: 1 - msRemaining / timing.limitMs,
    };
  }

  return { phase: "ended", msRemaining: 0, msSinceOpen, progress: 1 };
}

/**
 * Whether the correct answer and the vote tally may be shown.
 *
 * Deliberately strict: `idle` never reveals during a live presentation. That
 * phase is the gap between the host advancing to a quiz slide and the server
 * confirming the round has started, and treating it as finished flashed the
 * answer onto the projector for a split second.
 *
 * `isReview` is the only escape hatch — a finished session being read back,
 * where there is no clock and nothing left to protect.
 */
export function shouldRevealAnswers(args: {
  phase: QuizPhase;
  isReview?: boolean;
  hideResults?: boolean;
}): boolean {
  if (args.hideResults) return false;
  if (args.isReview) return true;
  return args.phase === "ended";
}

/**
 * The question timer, but only if it belongs to the slide being displayed.
 *
 * Presenter navigation is optimistic, so just after advancing, the rendered
 * slide is the new one while the session still reports the previous question's
 * start instant. Using it would make a fresh quiz compute as already finished.
 * A mismatch therefore reads as "not started".
 */
export function timerForDisplayedSlide(
  serverCurrentSlideId: string | null | undefined,
  displayedSlideId: string | null | undefined,
  questionStartedAt: string | null | undefined,
): string | null {
  if (!serverCurrentSlideId || !displayedSlideId) return null;
  if (String(serverCurrentSlideId) !== String(displayedSlideId)) return null;
  return questionStartedAt ?? null;
}

/**
 * The instant a round stops accepting answers, in epoch ms — or null when no
 * round is running. Callers can wait on this with a single timer instead of
 * polling the phase.
 */
export function roundClosesAt(
  questionStartedAt: string | Date | null | undefined,
  timing: QuizTiming,
): number | null {
  if (!questionStartedAt) return null;
  const startedAt = new Date(questionStartedAt).getTime();
  if (Number.isNaN(startedAt)) return null;
  return startedAt + timing.countdownMs + timing.limitMs;
}

/**
 * Whether the presenter should be prevented from moving forward.
 *
 * A quiz question in its countdown or answering window must not be skipped —
 * doing so abandons participants mid-answer and leaves the round unscoreable.
 * Everything else (including a finished quiz) is free to advance.
 */
export function shouldBlockAdvance(args: {
  slideType?: string | null;
  questionStartedAt?: string | Date | null;
  timing: QuizTiming;
  now: number;
}): boolean {
  if (args.slideType !== "QUIZ") return false;
  const { phase } = getQuizWindow(args.questionStartedAt, args.timing, args.now);
  return phase === "countdown" || phase === "open";
}

/** Points a correct answer would earn right now — used for the live "worth" hint. */
export function projectedPoints(msSinceOpen: number, timing: QuizTiming): number {
  const fraction = Math.min(1, Math.max(0, msSinceOpen / timing.limitMs));
  return Math.round(timing.basePoints * (1 - 0.5 * fraction));
}

/**
 * Ticking quiz window, corrected for clock skew.
 *
 * `serverOffsetMs` comes from the `serverNow` field on every state sync; without
 * it a device whose clock is a few seconds off would show a wrong countdown.
 * Ticks stop once the round ends so an idle slide costs no renders.
 */
export function useQuizWindow(
  questionStartedAt: string | Date | null | undefined,
  timing: QuizTiming,
  serverOffsetMs = 0,
): QuizWindow {
  const [now, setNow] = useState(() => Date.now() + serverOffsetMs);

  useEffect(() => {
    setNow(Date.now() + serverOffsetMs);
    if (!questionStartedAt) return;

    const startedAt = new Date(questionStartedAt).getTime();
    if (Number.isNaN(startedAt)) return;
    const closesAt = startedAt + timing.countdownMs + timing.limitMs;

    // 100ms keeps the countdown digit and the timer bar smooth without
    // re-rendering the option grid every frame.
    const id = setInterval(() => {
      const next = Date.now() + serverOffsetMs;
      setNow(next);
      if (next >= closesAt) clearInterval(id);
    }, 100);

    return () => clearInterval(id);
  }, [questionStartedAt, serverOffsetMs, timing.countdownMs, timing.limitMs]);

  return getQuizWindow(questionStartedAt, timing, now);
}
