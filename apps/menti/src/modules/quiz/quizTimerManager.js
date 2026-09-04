import { Session } from "../../core/database/models/index.js";
import { syncer } from "../../../realtime/syncer.js";
import { invalidateCachedSession } from "../../../realtime/cache.js";
import { redis } from "../../core/database/redis.js";
import { redisKey } from "../../core/env/env.js";
import { logger } from "../../core/logger/logger.js";

/* A quiz timer must fire exactly once for a session, no matter how many
 * replicas are running. Whichever process schedules the timeout first claims
 * the session for the timer's duration; the others skip. The claim expires with
 * the timer, so a process that dies mid-quiz releases it and restart recovery
 * can pick the session back up. */
async function claimTimer(sessionId, durationMs) {
  const key = redisKey("quiztimer", sessionId.toString());
  try {
    const acquired = await redis.set(key, "1", "PX", durationMs + 5_000, "NX");
    return acquired === "OK";
  } catch (error) {
    /* Single-process deployments are the norm, so a Redis failure must not stop
     * quizzes from ever ending. */
    logger.error("quiz timer claim failed, scheduling locally:", error.message);
    return true;
  }
}

async function releaseTimer(sessionId) {
  try {
    await redis.del(redisKey("quiztimer", sessionId.toString()));
  } catch {
    /* Expires on its own. */
  }
}

class QuizTimerManager {
  constructor() {
    this._timers = new Map();
  }

  /**
   * Starts an authoritative server quiz timer for a session.
   */
  async startQuizTimer(sessionId, slideId, timeLimitSeconds = 30, position = 0, currentVersion = undefined) {
    const key = sessionId.toString();

    if (this._timers.has(key)) {
      clearTimeout(this._timers.get(key));
      this._timers.delete(key);
    }

    const durationMs = Math.max(5000, (Number(timeLimitSeconds) || 30) * 1000);
    const now = Date.now();
    const startedAt = new Date(now);
    const endsAt = new Date(now + durationMs);

    const filter = currentVersion !== undefined ? { _id: sessionId, version: currentVersion } : { _id: sessionId };

    // Persist server-authoritative timer state in MongoDB and ensure session is live
    const updated = await Session.findOneAndUpdate(filter, {
      $set: {
        status: "live",
        currentSlideId: slideId,
        currentSlidePosition: position,
        isVotingLocked: false,
        quizState: {
          slideId,
          startedAt,
          endsAt,
          durationMs,
          isLocked: false,
        },
        lastActivityAt: startedAt,
      },
      $inc: { version: 1, eventSequence: 1 },
    }, { new: true });

    if (!updated && currentVersion !== undefined) {
      throw new Error("Conflict: Concurrent session update detected. Please try again.");
    }

    invalidateCachedSession(sessionId);

    /* The session state above is authoritative and already persisted; only the
     * wake-up is exclusive. */
    if (await claimTimer(sessionId, durationMs)) {
      const timer = setTimeout(() => {
        this._timers.delete(key);
        this.handleQuizTimeout(sessionId, slideId);
      }, durationMs);
      timer.unref?.();

      this._timers.set(key, timer);
    }

    return { startedAt, endsAt, durationMs };
  }

  /**
   * Called when a quiz timer expires. Locks quiz, updates session, and auto-advances to LEADERBOARD if next.
   */
  async handleQuizTimeout(sessionId, slideId) {
    try {
      const key = sessionId.toString();
      if (this._timers.has(key)) {
        clearTimeout(this._timers.get(key));
        this._timers.delete(key);
      }

      const session = await Session.findById(sessionId).lean();
      if (!session || session.status !== "live") return;

      // Lock voting and set quizState.isLocked = true
      await Session.findByIdAndUpdate(sessionId, {
        $set: {
          isVotingLocked: true,
          "quizState.isLocked": true,
          lastActivityAt: new Date(),
        },
        $inc: { version: 1, eventSequence: 1 },
      });

      invalidateCachedSession(sessionId);
      await releaseTimer(sessionId);
      logger.info(`quiz timer expired for session ${sessionId}; slide locked`);
      await syncer.broadcastState(sessionId, true);
    } catch (error) {
      logger.error("error handling quiz timeout:", error.message);
    }
  }

  /**
   * Node.js Process Restart Recovery:
   * Restores authoritative quiz timers from persisted session state in MongoDB on server startup.
   */
  async initRestartRecovery() {
    try {
      const activeSessions = await Session.find({
        status: "live",
        "quizState.endsAt": { $ne: null },
        "quizState.isLocked": false,
      }).lean();

      const now = Date.now();

      for (const session of activeSessions) {
        const { slideId, endsAt } = session.quizState;
        if (!endsAt || !slideId) continue;

        const expirationTime = new Date(endsAt).getTime();
        const remainingMs = expirationTime - now;

        if (remainingMs <= 0) {
          // Expired during downtime -> trigger timeout immediately
          logger.info(`recovered expired quiz timer for session ${session._id}`);
          this.handleQuizTimeout(session._id, slideId);
        } else if (await claimTimer(session._id, remainingMs)) {
          // Still active and unclaimed -> re-schedule on this process
          logger.info(`restored quiz timer for session ${session._id} (${Math.round(remainingMs / 1000)}s remaining)`);
          const key = session._id.toString();
          const timer = setTimeout(() => {
            this._timers.delete(key);
            this.handleQuizTimeout(session._id, slideId);
          }, remainingMs);
          timer.unref?.();

          this._timers.set(key, timer);
        }
      }
    } catch (error) {
      logger.error("restart recovery error:", error.message);
    }
  }
}

export const quizTimerManager = new QuizTimerManager();
