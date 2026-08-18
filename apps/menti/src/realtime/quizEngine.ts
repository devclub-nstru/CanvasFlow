export type QuizPhase = "idle" | "countdown" | "open" | "ended";

export const DEFAULT_COUNTDOWN_SECONDS = 5;
export const DEFAULT_TIME_LIMIT_SECONDS = 20;
export const DEFAULT_BASE_POINTS = 1000;

export const LATE_GRACE_MS = 1500;

export interface QuizTiming {
  countdownMs: number;
  limitMs: number;
  basePoints: number;
}

export interface QuizWindow {
  phase: QuizPhase;
  /** ms until the current phase ends; 0 when idle or ended. */
  msRemaining: number;
  /** ms since answering opened; negative during the countdown. */
  msSinceOpen: number;
}

/** Read timing off a slide's responseSettings, applying defaults. */
export function readTiming(responseSettings?: {
  countdownSeconds?: number;
  timeLimitSeconds?: number;
  basePoints?: number;
}): QuizTiming {
  const countdownSeconds = responseSettings?.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS;
  const timeLimitSeconds = responseSettings?.timeLimitSeconds ?? DEFAULT_TIME_LIMIT_SECONDS;
  const basePoints = responseSettings?.basePoints ?? DEFAULT_BASE_POINTS;

  return {
    countdownMs: Math.max(0, countdownSeconds) * 1000,
    // A zero-length window would make every answer late.
    limitMs: Math.max(1, timeLimitSeconds) * 1000,
    basePoints: Math.max(0, basePoints),
  };
}

/** Where the round currently sits, given when it started. */
export function getQuizWindow(
  questionStartedAt: Date | null | undefined,
  timing: QuizTiming,
  now: number = Date.now(),
): QuizWindow {
  if (!questionStartedAt) {
    return { phase: "idle", msRemaining: 0, msSinceOpen: 0 };
  }

  const startedAt = questionStartedAt.getTime();
  const opensAt = startedAt + timing.countdownMs;
  const closesAt = opensAt + timing.limitMs;
  const msSinceOpen = now - opensAt;

  if (now < opensAt) {
    return {
      phase: "countdown",
      msRemaining: Math.min(opensAt - now, timing.countdownMs),
      msSinceOpen,
    };
  }
  if (now < closesAt) {
    return { phase: "open", msRemaining: closesAt - now, msSinceOpen };
  }
  return { phase: "ended", msRemaining: 0, msSinceOpen };
}

export type SubmissionRejection = "not_started" | "too_early" | "too_late";

export interface SubmissionCheck {
  accepted: boolean;
  reason?: SubmissionRejection;
  /** Response time used for scoring, clamped into [0, limitMs]. */
  responseTimeMs: number;
}

/**
 * Decide whether an answer arriving `now` counts, and at what response time.
 *
 * Answers during the countdown are refused outright — the options are not
 * revealed yet, so an early answer means a tampered client.
 */
export function checkSubmissionWindow(
  questionStartedAt: Date | null | undefined,
  timing: QuizTiming,
  now: number = Date.now(),
): SubmissionCheck {
  if (!questionStartedAt) {
    return { accepted: false, reason: "not_started", responseTimeMs: 0 };
  }

  const { msSinceOpen } = getQuizWindow(questionStartedAt, timing, now);

  if (msSinceOpen < 0) {
    return { accepted: false, reason: "too_early", responseTimeMs: 0 };
  }
  if (msSinceOpen > timing.limitMs + LATE_GRACE_MS) {
    return { accepted: false, reason: "too_late", responseTimeMs: timing.limitMs };
  }

  return {
    accepted: true,
    responseTimeMs: Math.min(Math.max(0, msSinceOpen), timing.limitMs),
  };
}

export function scoreAnswer(
  isCorrect: boolean,
  responseTimeMs: number,
  timing: QuizTiming,
): number {
  if (!isCorrect) return 0;

  const fraction = Math.min(1, Math.max(0, responseTimeMs / timing.limitMs));
  return Math.round(timing.basePoints * (1 - 0.5 * fraction));
}

export function isAnswerCorrect(
  chosenOptionIds: string[],
  correctOptionIds: string[],
): boolean {
  if (correctOptionIds.length === 0) return false;
  if (chosenOptionIds.length !== correctOptionIds.length) return false;

  const correct = new Set(correctOptionIds);
  return chosenOptionIds.every((id) => correct.has(id));
}
