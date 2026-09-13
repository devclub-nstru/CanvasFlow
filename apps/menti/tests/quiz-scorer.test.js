import { describe, expect, it } from "vitest";
import { calculateQuizPoints } from "../src/modules/quiz/quizScorer.js";

describe("calculateQuizPoints — a wrong answer", () => {
  it("scores nothing, whatever the scheme", () => {
    for (const gradingScheme of ["time_based", "answer_based"]) {
      expect(
        calculateQuizPoints({ gradingScheme, maxPoints: 1000, elapsedMs: 0, isCorrect: false }),
      ).toBe(0);
    }
  });

  it("scores nothing even for an instant answer", () => {
    expect(calculateQuizPoints({ maxPoints: 1000, elapsedMs: 0, isCorrect: false })).toBe(0);
  });

  it("defaults to incorrect when correctness is not stated", () => {
    expect(calculateQuizPoints({ maxPoints: 1000 })).toBe(0);
  });
});

describe("calculateQuizPoints — answer_based", () => {
  it("awards full marks regardless of how long it took", () => {
    for (const elapsedMs of [0, 5_000, 30_000, 999_999]) {
      expect(
        calculateQuizPoints({
          gradingScheme: "answer_based",
          maxPoints: 1000,
          elapsedMs,
          isCorrect: true,
        }),
      ).toBe(1000);
    }
  });
});

describe("calculateQuizPoints — time_based", () => {
  const base = {
    gradingScheme: "time_based",
    maxPoints: 1000,
    timeLimitSeconds: 30,
    isCorrect: true,
  };

  it("awards full marks for an instant answer", () => {
    expect(calculateQuizPoints({ ...base, elapsedMs: 0 })).toBe(1000);
  });

  it("awards half marks at the buzzer", () => {
    expect(calculateQuizPoints({ ...base, elapsedMs: 30_000 })).toBe(500);
  });

  it("decays linearly in between", () => {
    expect(calculateQuizPoints({ ...base, elapsedMs: 15_000 })).toBe(750);
    expect(calculateQuizPoints({ ...base, elapsedMs: 7_500 })).toBe(875);
  });

  it("never drops below half marks, however late the answer", () => {
    expect(calculateQuizPoints({ ...base, elapsedMs: 60_000 })).toBe(500);
    expect(calculateQuizPoints({ ...base, elapsedMs: 10_000_000 })).toBe(500);
  });

  it("never exceeds the maximum, however early the clock claims it was", () => {
    expect(calculateQuizPoints({ ...base, elapsedMs: -5_000 })).toBe(1000);
  });

  it("rewards a faster answer more than a slower one", () => {
    const fast = calculateQuizPoints({ ...base, elapsedMs: 2_000 });
    const slow = calculateQuizPoints({ ...base, elapsedMs: 20_000 });
    expect(fast).toBeGreaterThan(slow);
  });

  it("is monotonically non-increasing across the whole window", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let elapsedMs = 0; elapsedMs <= 30_000; elapsedMs += 500) {
      const points = calculateQuizPoints({ ...base, elapsedMs });
      expect(points).toBeLessThanOrEqual(previous);
      previous = points;
    }
  });

  it("always returns a whole number of points", () => {
    for (let elapsedMs = 0; elapsedMs <= 30_000; elapsedMs += 137) {
      expect(Number.isInteger(calculateQuizPoints({ ...base, elapsedMs }))).toBe(true);
    }
  });
});

describe("calculateQuizPoints — the duration it measures against", () => {
  it("prefers an explicit duration over the time limit", () => {
    expect(
      calculateQuizPoints({
        gradingScheme: "time_based",
        maxPoints: 1000,
        timeLimitSeconds: 30,
        durationMs: 10_000,
        elapsedMs: 10_000,
        isCorrect: true,
      }),
    ).toBe(500);
  });

  it("falls back to a 30 second window when neither is given", () => {
    expect(
      calculateQuizPoints({ gradingScheme: "time_based", maxPoints: 1000, elapsedMs: 30_000, isCorrect: true }),
    ).toBe(500);
  });

  it("falls back to 30 seconds when the time limit is unusable", () => {
    for (const timeLimitSeconds of [0, null, undefined, "nonsense"]) {
      expect(
        calculateQuizPoints({
          gradingScheme: "time_based",
          maxPoints: 1000,
          timeLimitSeconds,
          elapsedMs: 30_000,
          isCorrect: true,
        }),
      ).toBe(500);
    }
  });
});

describe("calculateQuizPoints — defaults and bad input", () => {
  it("defaults to the time-based scheme", () => {
    expect(calculateQuizPoints({ maxPoints: 1000, elapsedMs: 30_000, isCorrect: true })).toBe(500);
  });

  it("defaults the maximum to 100 points", () => {
    expect(calculateQuizPoints({ elapsedMs: 0, isCorrect: true })).toBe(100);
  });

  it.each([0, null, undefined, "nonsense", Number.NaN])(
    "falls back to 100 points when maxPoints is %j",
    (maxPoints) => {
      expect(calculateQuizPoints({ maxPoints, elapsedMs: 0, isCorrect: true })).toBe(100);
    },
  );

  it("clamps a negative maximum to a single point rather than the default", () => {
    /* Number(-5) is truthy, so the `|| 100` fallback never fires and the
     * Math.max(1, ...) floor is what decides. Worth pinning: it is the one
     * bad input that does not land on the documented default. */
    expect(calculateQuizPoints({ maxPoints: -5, elapsedMs: 0, isCorrect: true })).toBe(1);
  });

  it("treats an unusable elapsed time as instant", () => {
    for (const elapsedMs of [null, undefined, "nonsense", Number.NaN]) {
      expect(
        calculateQuizPoints({ maxPoints: 1000, timeLimitSeconds: 30, elapsedMs, isCorrect: true }),
      ).toBe(1000);
    }
  });

  it("treats an unknown scheme as time-based rather than throwing", () => {
    expect(
      calculateQuizPoints({
        gradingScheme: "vibes_based",
        maxPoints: 1000,
        elapsedMs: 30_000,
        isCorrect: true,
      }),
    ).toBe(500);
  });

  it("keeps the floor sane for a one-point question", () => {
    expect(calculateQuizPoints({ maxPoints: 1, elapsedMs: 30_000, isCorrect: true })).toBe(1);
  });

  it("is deterministic: the same inputs always give the same score", () => {
    const args = { maxPoints: 1000, timeLimitSeconds: 30, elapsedMs: 9_123, isCorrect: true };
    const first = calculateQuizPoints(args);
    for (let i = 0; i < 10; i++) expect(calculateQuizPoints(args)).toBe(first);
  });
});
