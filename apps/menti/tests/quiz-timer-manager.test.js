import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* The quiz timer is the one piece of menti that must fire exactly once across
 * however many replicas are running: two processes ending the same quiz means
 * two leaderboard broadcasts and a double-counted slide. The claim in Redis is
 * what makes it exclusive, and the fallback when Redis is down is deliberately
 * permissive. Both halves are tested here. */

const Session = {
  findOneAndUpdate: vi.fn(),
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  find: vi.fn(),
};
vi.mock("../src/core/database/models/index.js", () => ({
  Session,
  Slide: {},
  Response: {},
  Participant: {},
  User: {},
  Presentation: {},
}));

const syncer = { broadcastState: vi.fn() };
vi.mock("../realtime/syncer.js", () => ({ syncer }));

const invalidateCachedSession = vi.fn();
vi.mock("../realtime/cache.js", () => ({
  invalidateCachedSession,
  invalidateCachedSlide: vi.fn(),
  getCachedSession: vi.fn(),
  getCachedSlide: vi.fn(),
  onInvalidate: vi.fn(),
  subscribeToCacheInvalidation: vi.fn(),
}));

const redis = { set: vi.fn(), del: vi.fn() };
vi.mock("../src/core/database/redis.js", () => ({
  redis,
  createSubscriber: vi.fn(),
  closeRedis: vi.fn(),
}));

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("../src/core/logger/logger.js", () => ({ logger, default: logger }));

const { quizTimerManager } = await import("../src/modules/quiz/quizTimerManager.js");

const SESSION = "session-1";
const SLIDE = "slide-1";

/** A lean() -able mongoose query stub. */
const lean = (value) => ({ lean: () => Promise.resolve(value) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

  Session.findOneAndUpdate.mockResolvedValue({ _id: SESSION });
  Session.findByIdAndUpdate.mockResolvedValue({});
  Session.findById.mockReturnValue(lean({ _id: SESSION, status: "live" }));
  Session.find.mockReturnValue(lean([]));
  redis.set.mockResolvedValue("OK");
  redis.del.mockResolvedValue(1);
  syncer.broadcastState.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

/* ─── Duration ─────────────────────────────────────────────────────────── */

describe("startQuizTimer — the window it opens", () => {
  it("reports a start, an end and a duration", async () => {
    const result = await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30);

    expect(result.durationMs).toBe(30_000);
    expect(result.endsAt.getTime() - result.startedAt.getTime()).toBe(30_000);
  });

  it("defaults to thirty seconds", async () => {
    expect((await quizTimerManager.startQuizTimer(SESSION, SLIDE)).durationMs).toBe(30_000);
  });

  it.each([0, null, "nonsense", Number.NaN])(
    "falls back to thirty seconds for a time limit of %j",
    async (limit) => {
      expect((await quizTimerManager.startQuizTimer(SESSION, SLIDE, limit)).durationMs).toBe(30_000);
    },
  );

  it("clamps a negative limit to the floor rather than the default", async () => {
    /* Number(-10) is truthy, so the `|| 30` fallback never fires and the
     * Math.max floor decides. Same shape as calculateQuizPoints with a negative
     * maxPoints — the one bad input that misses the documented default. */
    expect((await quizTimerManager.startQuizTimer(SESSION, SLIDE, -10)).durationMs).toBe(5_000);
  });

  it("never opens a window shorter than five seconds", async () => {
    expect((await quizTimerManager.startQuizTimer(SESSION, SLIDE, 1)).durationMs).toBe(5_000);
    expect((await quizTimerManager.startQuizTimer(SESSION, SLIDE, 3)).durationMs).toBe(5_000);
  });

  it("honours a longer limit", async () => {
    expect((await quizTimerManager.startQuizTimer(SESSION, SLIDE, 120)).durationMs).toBe(120_000);
  });
});

/* ─── Persistence ──────────────────────────────────────────────────────── */

describe("startQuizTimer — what it writes", () => {
  it("makes the session live and unlocks voting", async () => {
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30, 2);

    const [, update] = Session.findOneAndUpdate.mock.calls[0];
    expect(update.$set.status).toBe("live");
    expect(update.$set.isVotingLocked).toBe(false);
    expect(update.$set.currentSlideId).toBe(SLIDE);
    expect(update.$set.currentSlidePosition).toBe(2);
  });

  it("persists the window so a restart can recover it", async () => {
    const { startedAt, endsAt, durationMs } = await quizTimerManager.startQuizTimer(SESSION, SLIDE, 45);

    const [, update] = Session.findOneAndUpdate.mock.calls[0];
    expect(update.$set.quizState).toEqual({
      slideId: SLIDE,
      startedAt,
      endsAt,
      durationMs,
      isLocked: false,
    });
  });

  it("bumps the version and the event sequence", async () => {
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30);
    const [, update] = Session.findOneAndUpdate.mock.calls[0];
    expect(update.$inc).toEqual({ version: 1, eventSequence: 1 });
  });

  it("drops the cached session so the next read sees the new state", async () => {
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30);
    expect(invalidateCachedSession).toHaveBeenCalledWith(SESSION);
  });
});

describe("startQuizTimer — optimistic locking", () => {
  it("matches on the version when the caller supplies one", async () => {
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30, 0, 7);
    expect(Session.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: SESSION, version: 7 });
  });

  it("matches on the id alone when no version is given", async () => {
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30);
    expect(Session.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: SESSION });
  });

  it("rejects a start that lost the race", async () => {
    Session.findOneAndUpdate.mockResolvedValue(null);
    await expect(quizTimerManager.startQuizTimer(SESSION, SLIDE, 30, 0, 7)).rejects.toThrow(
      /Concurrent session update/,
    );
  });

  it("does not treat a missing session as a conflict when no version was given", async () => {
    Session.findOneAndUpdate.mockResolvedValue(null);
    await expect(quizTimerManager.startQuizTimer(SESSION, SLIDE, 30)).resolves.toBeDefined();
  });
});

/* ─── The cross-process claim ──────────────────────────────────────────── */

describe("startQuizTimer — claiming the wake-up", () => {
  it("claims the session with an expiring, set-if-absent key", async () => {
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30);

    const [key, value, unit, ttl, mode] = redis.set.mock.calls[0];
    expect(key).toBe(`cf:menti:quiztimer:${SESSION}`);
    expect(value).toBe("1");
    expect(unit).toBe("PX");
    expect(ttl).toBe(35_000);
    expect(mode, "NX is what makes the claim exclusive").toBe("NX");
  });

  it("outlives the timer it guards, so a dead process releases it late rather than early", async () => {
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30);
    const ttl = redis.set.mock.calls[0][3];
    expect(ttl).toBeGreaterThan(30_000);
  });

  it("schedules the timeout when the claim succeeds", async () => {
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30);
    Session.findByIdAndUpdate.mockClear();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(Session.findByIdAndUpdate).toHaveBeenCalled();
  });

  it("schedules nothing when another process already holds the claim", async () => {
    redis.set.mockResolvedValue(null);
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30);
    Session.findByIdAndUpdate.mockClear();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(Session.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("still persists the session state when the claim is lost", async () => {
    redis.set.mockResolvedValue(null);
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30);
    expect(Session.findOneAndUpdate).toHaveBeenCalled();
  });

  it("schedules locally when Redis is unreachable, rather than never ending the quiz", async () => {
    redis.set.mockRejectedValue(new Error("connection reset"));
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30);
    Session.findByIdAndUpdate.mockClear();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(Session.findByIdAndUpdate).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("quiz timer claim failed"),
      "connection reset",
    );
  });

  it("replaces an existing timer rather than running two for one session", async () => {
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30);
    await quizTimerManager.startQuizTimer(SESSION, SLIDE, 30);
    Session.findByIdAndUpdate.mockClear();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(Session.findByIdAndUpdate).toHaveBeenCalledOnce();
  });
});

/* ─── Expiry ───────────────────────────────────────────────────────────── */

describe("handleQuizTimeout", () => {
  it("locks voting and the quiz state", async () => {
    await quizTimerManager.handleQuizTimeout(SESSION, SLIDE);

    const [id, update] = Session.findByIdAndUpdate.mock.calls[0];
    expect(id).toBe(SESSION);
    expect(update.$set.isVotingLocked).toBe(true);
    expect(update.$set["quizState.isLocked"]).toBe(true);
    expect(update.$inc).toEqual({ version: 1, eventSequence: 1 });
  });

  it("broadcasts the locked state to the room", async () => {
    await quizTimerManager.handleQuizTimeout(SESSION, SLIDE);
    expect(syncer.broadcastState).toHaveBeenCalledWith(SESSION, true);
  });

  it("releases the claim so a later quiz on the same session can be scheduled", async () => {
    await quizTimerManager.handleQuizTimeout(SESSION, SLIDE);
    expect(redis.del).toHaveBeenCalledWith(`cf:menti:quiztimer:${SESSION}`);
  });

  it("does nothing for a session that has gone", async () => {
    Session.findById.mockReturnValue(lean(null));
    await quizTimerManager.handleQuizTimeout(SESSION, SLIDE);

    expect(Session.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(syncer.broadcastState).not.toHaveBeenCalled();
  });

  it("does nothing for a session that is no longer live", async () => {
    Session.findById.mockReturnValue(lean({ _id: SESSION, status: "ended" }));
    await quizTimerManager.handleQuizTimeout(SESSION, SLIDE);
    expect(Session.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("never throws, because it runs from a timer with no caller to catch it", async () => {
    Session.findByIdAndUpdate.mockRejectedValue(new Error("mongo down"));
    await expect(quizTimerManager.handleQuizTimeout(SESSION, SLIDE)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith("error handling quiz timeout:", "mongo down");
  });

  it("survives a Redis failure while releasing the claim", async () => {
    redis.del.mockRejectedValue(new Error("connection reset"));
    await expect(quizTimerManager.handleQuizTimeout(SESSION, SLIDE)).resolves.toBeUndefined();
    expect(syncer.broadcastState).toHaveBeenCalled();
  });
});

/* ─── Restart recovery ─────────────────────────────────────────────────── */

describe("initRestartRecovery", () => {
  const liveSession = (overrides = {}) => ({
    _id: SESSION,
    quizState: { slideId: SLIDE, endsAt: new Date("2026-01-01T00:00:20Z") },
    ...overrides,
  });

  it("looks only for live sessions with an unlocked quiz still running", async () => {
    await quizTimerManager.initRestartRecovery();
    expect(Session.find).toHaveBeenCalledWith({
      status: "live",
      "quizState.endsAt": { $ne: null },
      "quizState.isLocked": false,
    });
  });

  it("does nothing when there is nothing to recover", async () => {
    await quizTimerManager.initRestartRecovery();
    expect(Session.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("ends a quiz immediately if it expired while the process was down", async () => {
    Session.find.mockReturnValue(
      lean([liveSession({ quizState: { slideId: SLIDE, endsAt: new Date("2025-12-31T23:59:00Z") } })]),
    );

    await quizTimerManager.initRestartRecovery();
    await vi.advanceTimersByTimeAsync(0);

    expect(Session.findByIdAndUpdate).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("recovered expired"));
  });

  it("reschedules a quiz that still has time left", async () => {
    Session.find.mockReturnValue(lean([liveSession()]));

    await quizTimerManager.initRestartRecovery();
    expect(Session.findByIdAndUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(20_000);
    expect(Session.findByIdAndUpdate).toHaveBeenCalled();
  });

  it("claims a rescheduled timer for only the time remaining", async () => {
    Session.find.mockReturnValue(lean([liveSession()]));
    await quizTimerManager.initRestartRecovery();

    expect(redis.set.mock.calls[0][3]).toBe(25_000);
  });

  it("leaves a session another process already claimed alone", async () => {
    redis.set.mockResolvedValue(null);
    Session.find.mockReturnValue(lean([liveSession()]));

    await quizTimerManager.initRestartRecovery();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(Session.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("skips a session whose recorded quiz state is incomplete", async () => {
    Session.find.mockReturnValue(
      lean([
        liveSession({ quizState: { slideId: null, endsAt: new Date("2026-01-01T00:00:20Z") } }),
        liveSession({ quizState: { slideId: SLIDE, endsAt: null } }),
      ]),
    );

    await quizTimerManager.initRestartRecovery();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("never throws on a database failure during boot", async () => {
    Session.find.mockImplementation(() => {
      throw new Error("mongo unreachable");
    });

    await expect(quizTimerManager.initRestartRecovery()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith("restart recovery error:", "mongo unreachable");
  });
});
