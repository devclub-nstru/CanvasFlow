/**
 * Quiz Scoring Engine
 * Isolated strategy pattern for calculating points based on correctness, time elapsed, and scheme.
 */

/**
 * Calculates quiz points deterministically based on configured grading scheme.
 * 
 * @param {Object} params
 * @param {string} params.gradingScheme - "answer_based" | "time_based"
 * @param {number} params.maxPoints - Maximum point value (e.g. 1000)
 * @param {number} [params.timeLimitSeconds=30] - Quiz time limit in seconds
 * @param {number} [params.durationMs] - Quiz duration in milliseconds
 * @param {number} params.elapsedMs - Elapsed time from quiz start to submission in ms
 * @param {boolean} params.isCorrect - Whether the submitted answer is correct
 * @returns {number} Integer points awarded
 */
export function calculateQuizPoints({
  gradingScheme = "time_based",
  maxPoints = 100,
  timeLimitSeconds = 30,
  durationMs,
  elapsedMs = 0,
  isCorrect = false,
}) {
  if (!isCorrect) {
    return 0;
  }

  const effectiveMaxPoints = Math.max(1, Number(maxPoints) || 100);

  if (gradingScheme === "answer_based") {
    return effectiveMaxPoints;
  }

  // "time_based" linear decay strategy
  const totalDuration = durationMs || (Number(timeLimitSeconds) || 30) * 1000;
  const validElapsed = Math.max(0, Math.min(totalDuration, Number(elapsedMs) || 0));

  // Ratio from 0.0 (instant) to 1.0 (end of timer)
  const ratio = totalDuration > 0 ? validElapsed / totalDuration : 0;

  // Linear formula: 100% points for instant answer, down to 50% points at the timer boundary
  const points = Math.round(effectiveMaxPoints * (1 - ratio * 0.5));
  const minPointsFloor = Math.max(1, Math.round(effectiveMaxPoints * 0.5));

  return Math.max(minPointsFloor, Math.min(effectiveMaxPoints, points));
}
