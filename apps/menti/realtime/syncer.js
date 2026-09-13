import mongoose from "mongoose";
import { Participant, Response, Slide } from "../src/core/database/models/index.js";
import { redis } from "../src/core/database/redis.js";
import { redisKey } from "../src/core/env/env.js";
import { logger } from "../src/core/logger/logger.js";
import { getIo } from "./server.js";
import { getCachedSession, getCachedSlide, onInvalidate } from "./cache.js";
import { getParticipantCount } from "./presence.js";

/* How long a computed base state may be reused across sockets. Short enough
 * that a slide change is never served stale (slide changes broadcast
 * immediately and bust this cache explicitly), long enough that a burst of
 * joins shares one computation. */
const BASE_STATE_TTL_MS = 750;

/* Only one process may broadcast a given session in a given window, so running
 * more than one replica does not deliver N copies of every frame. */
async function claimBroadcast(kind, sessionId, windowMs) {
  const slot = Math.floor(Date.now() / windowMs);
  const key = redisKey("bcast", kind, sessionId.toString(), String(slot));

  try {
    /* The value is irrelevant — presence of the key is the claim. TTL is two
     * windows so a clock skew between processes cannot double-emit. */
    const acquired = await redis.set(key, "1", "PX", windowMs * 2, "NX");
    return acquired === "OK";
  } catch (error) {
    /* Redis is unreachable. A duplicate frame is a cosmetic problem; a session
     * that stops updating is not. Broadcast. */
    logger.error("broadcast claim failed, emitting anyway:", error.message);
    return true;
  }
}

class Syncer {
  constructor() {
    this._broadcastStateTimers = new Map();
    this._analyticsTimers = new Map();
    this._leaderboardTimers = new Map();
    this._lastLeaderboardSnapshots = new Map();
    this._baseStateCache = new Map();
  }

  /**
   * High-Performance Analytics Compiler
   * Uses MongoDB aggregation pipelines ($group, $unwind, $limit) instead of loading all responses into Node memory.
   */
  async compileAnalytics(slideId, slideType) {
    /* Read through, NOT through getCachedSlide.
     *
     * Vote tallies for choice slides live on the slide document itself and are
     * bumped with $inc on every response, so the cached copy — which exists to
     * serve the slide's *definition* — is stale by construction here. Serving
     * analytics from it pins every bar at whatever the count was when the slide
     * was first cached. The read is debounced to roughly three a second per
     * slide, so going to Mongo for it is cheap. */
    const slide = await Slide.findById(slideId).lean();
    if (!slide) return null;

    const effectiveType = slide.type || slideType;
    const targetSlideId = new mongoose.Types.ObjectId(slideId.toString());

    if (
      effectiveType === "BAR_GRAPH" ||
      effectiveType === "QUIZ" ||
      effectiveType === "select" ||
      effectiveType === "multi_select"
    ) {
      const results = (slide.options || []).map((opt) => ({
        id: opt.id,
        label: opt.label,
        count: opt.voteCount || 0,
        isCorrect: Boolean(opt.isCorrect),
      }));

      const totalVotes = results.reduce((sum, r) => sum + r.count, 0);

      return {
        slideId: slideId.toString(),
        type: effectiveType === "QUIZ" ? "QUIZ" : "BAR_GRAPH",
        results,
        totalVotes,
      };
    }

    if (effectiveType === "WORD_CLOUD" || effectiveType === "text" || effectiveType === "multi_text") {
      // MongoDB Aggregation Pipeline: processes word counts inside DB engine and returns top 100 words
      const wordAgg = await Response.aggregate([
        { $match: { slideId: targetSlideId } },
        { $unwind: "$answer.raw" },
        {
          $project: {
            cleanWord: { $trim: { input: { $toLower: "$answer.raw" } } },
            rawWord: "$answer.raw",
          },
        },
        { $match: { cleanWord: { $ne: "" } } },
        {
          $group: {
            _id: "$cleanWord",
            value: { $sum: 1 },
            text: { $first: "$rawWord" },
          },
        },
        { $sort: { value: -1 } },
        { $limit: 100 },
      ]);

      const totalResponses = wordAgg.reduce((sum, item) => sum + item.value, 0);

      const wordCloud = wordAgg.map((item) => ({
        text: item.text,
        value: item.value,
      }));

      const wordCloudOptions = wordAgg.map((item, index) => ({
        id: `word-${index}-${item.text}`,
        label: item.text,
        voteCount: item.value,
      }));

      /* Persisted so the editor and results views can read the cloud without
       * re-running the aggregation. Fire-and-forget: the broadcast below is the
       * live path and must not wait on a write. */
      Slide.updateOne({ _id: slideId }, { $set: { options: wordCloudOptions } })
        .exec()
        .catch((err) => logger.error("word cloud persist failed:", err.message));

      return {
        slideId,
        type: "WORD_CLOUD",
        wordCloud,
        options: wordCloudOptions,
        results: wordCloudOptions,
        totalResponses,
      };
    }

    if (effectiveType === "SCALES" || effectiveType === "rating") {
      const min = slide.responseSettings?.minRating !== undefined ? slide.responseSettings.minRating : 1;
      const max = slide.responseSettings?.maxRating !== undefined ? slide.responseSettings.maxRating : 5;

      const ratingAgg = await Response.aggregate([
        { $match: { slideId: targetSlideId } },
        {
          $group: {
            _id: "$answer.rating",
            count: { $sum: 1 },
            sum: { $sum: "$answer.rating" },
          },
        },
      ]);

      const statsMap = {};
      for (const item of ratingAgg) {
        if (item._id !== null && item._id !== undefined) {
          statsMap[item._id] = { count: item.count, sum: item.sum };
        }
      }

      const results = [];
      let totalResponses = 0;

      for (let i = min; i <= max; i++) {
        const stats = statsMap[i] || { count: 0, sum: 0 };
        totalResponses += stats.count;
        const mean = stats.count > 0 ? Number((stats.sum / stats.count).toFixed(2)) : 0;
        results.push({
          id: `rate-${i}`,
          label: String(i),
          mean,
          count: stats.count,
        });
      }

      return {
        slideId,
        type: "SCALES",
        results,
        totalResponses,
      };
    }

    return {
      slideId,
      type: effectiveType,
      data: null,
    };
  }

  /**
   * The session-wide half of the live state — identical for every socket in the
   * room, so it is computed once and shared for BASE_STATE_TTL_MS.
   *
   * This is what makes a join stampede cheap: 1000 participants arriving at the
   * same moment used to mean 1000 × (session read + slide read + count), all of
   * it recomputing the same answer.
   */
  async _getBaseState(sessionId) {
    const key = sessionId.toString();
    const cached = this._baseStateCache.get(key);
    if (cached && Date.now() - cached.at < BASE_STATE_TTL_MS) return cached.state;

    const session = await getCachedSession(sessionId);
    if (!session) throw new Error("Session not found");

    let currentSlide = null;
    // Only expose currentSlide if presentation is actively live
    if (session.status === "live" && session.currentSlideId) {
      currentSlide = await getCachedSlide(session.currentSlideId);
    }

    const [participantCount, leaderboard] = await Promise.all([
      getParticipantCount(sessionId),
      currentSlide?.type === "LEADERBOARD" ? this.compileLeaderboard(sessionId) : Promise.resolve(null),
    ]);

    const state = {
      session: {
        id: session._id,
        code: session.code,
        status: session.status,
        version: session.version,
        settings: session.settings,
        currentSlideId: session.currentSlideId,
        isVotingLocked: session.isVotingLocked,
        quizState: session.quizState || null,
      },
      participantCount,
      currentSlide,
      leaderboard,
    };

    this._baseStateCache.set(key, { state, at: Date.now() });
    return state;
  }

  invalidateBaseState(sessionId) {
    if (sessionId) this._baseStateCache.delete(sessionId.toString());
  }

  async getLiveState(sessionId, participantId = null) {
    const base = await this._getBaseState(sessionId);

    let submittedSlideIds = [];
    if (participantId) {
      /* Participant-scoped and highly selective, so this is the only part of
       * the payload that costs a query per socket. */
      const responses = await Response.find({ sessionId, participantId })
        .select("slideId")
        .lean();

      const rawIds = Array.from(new Set(responses.map((r) => r.slideId.toString())));
      const currentSlide = base.currentSlide;

      if (
        currentSlide &&
        currentSlide.type === "WORD_CLOUD" &&
        (currentSlide.responseSettings?.multipleSubmissions === true ||
          currentSlide.responseSettings?.maxEntriesPerParticipant === 0)
      ) {
        submittedSlideIds = rawIds.filter((id) => id !== currentSlide._id.toString());
      } else {
        submittedSlideIds = rawIds;
      }
    }

    return {
      ...base,
      currentParticipantId: participantId ? participantId.toString() : null,
      submittedSlideIds,
    };
  }

  async compileLeaderboard(sessionId) {
    const participants = await Participant.find({
      sessionId,
      status: { $ne: "banned" },
    })
      .sort({ score: -1, joinedAt: 1 })
      .limit(10)
      .select("_id nickname score")
      .lean();

    const topParticipants = participants.map((p, index) => ({
      participantId: p._id.toString(),
      nickname: p.nickname,
      score: p.score || 0,
      rank: index + 1,
    }));

    return {
      sessionId: sessionId.toString(),
      topParticipants,
    };
  }

  async sendStateToSocket(socket, sessionId) {
    try {
      const participantId = socket.participant ? socket.participant._id : null;
      const state = await this.getLiveState(sessionId, participantId);
      socket.emit("session_state_sync", state);
    } catch (error) {
      logger.error("failed to send state to socket:", error.message);
    }
  }

  /**
   * Debounced broadcast of full state payload per sessionId (250ms window).
   * Prevents 750 rapid connections from triggering 280,000 JSON frames.
   */
  async broadcastState(sessionId, immediate = false) {
    if (!sessionId) return;
    const key = sessionId.toString();

    if (immediate) {
      if (this._broadcastStateTimers.has(key)) {
        clearTimeout(this._broadcastStateTimers.get(key));
        this._broadcastStateTimers.delete(key);
      }
      /* An immediate broadcast is always a state change (slide moved, status
       * changed), so the shared snapshot must not be reused. */
      this.invalidateBaseState(sessionId);
      return this._doBroadcastState(sessionId);
    }

    if (this._broadcastStateTimers.has(key)) {
      return;
    }

    const timer = setTimeout(() => {
      this._broadcastStateTimers.delete(key);
      this._doBroadcastState(sessionId);
    }, 250);
    timer.unref?.();

    this._broadcastStateTimers.set(key, timer);
  }

  async _doBroadcastState(sessionId) {
    try {
      const io = getIo();
      const roomName = `session_${sessionId}`;

      if (!(await claimBroadcast("state", sessionId, 250))) return;

      const state = await this.getLiveState(sessionId);
      io.to(roomName).emit("session_state_sync", state);
    } catch (error) {
      logger.error("failed to broadcast state:", error.message);
    }
  }

  /**
   * Debounced analytics broadcast per slideId (300ms window).
   * Aggregates rapid vote bursts into a single DB compile query instead of 1,500 concurrent table scans.
   */
  async broadcastSlideAnalytics(sessionId, slideId, slideType, immediate = false) {
    if (!slideId) return;
    const key = slideId.toString();

    if (immediate) {
      if (this._analyticsTimers.has(key)) {
        clearTimeout(this._analyticsTimers.get(key));
        this._analyticsTimers.delete(key);
      }
      return this._doBroadcastSlideAnalytics(sessionId, slideId, slideType);
    }

    if (this._analyticsTimers.has(key)) {
      return;
    }

    const timer = setTimeout(() => {
      this._analyticsTimers.delete(key);
      this._doBroadcastSlideAnalytics(sessionId, slideId, slideType);
    }, 300);
    timer.unref?.();

    this._analyticsTimers.set(key, timer);
  }

  async _doBroadcastSlideAnalytics(sessionId, slideId, slideType) {
    try {
      const io = getIo();
      const roomName = `session_${sessionId}`;

      if (!(await claimBroadcast("analytics", slideId, 300))) return;

      const analytics = await this.compileAnalytics(slideId, slideType);
      if (!analytics) return;

      /* The host room is a subset of the session room, so emitting to both
       * delivered every analytics frame to the presenter twice. */
      io.to(roomName).emit("slide_analytics_update", analytics);
    } catch (error) {
      logger.error("failed to broadcast slide analytics:", error.message);
    }
  }

  /**
   * Debounced leaderboard broadcast per sessionId (300ms window).
   * Coalesces high-concurrency score updates and suppresses broadcasts if top 10 snapshot hasn't changed.
   */
  async broadcastLeaderboard(sessionId, immediate = false) {
    if (!sessionId) return;
    const key = sessionId.toString();

    if (immediate) {
      if (this._leaderboardTimers.has(key)) {
        clearTimeout(this._leaderboardTimers.get(key));
        this._leaderboardTimers.delete(key);
      }
      return this._doBroadcastLeaderboard(sessionId, true);
    }

    if (this._leaderboardTimers.has(key)) {
      return;
    }

    const timer = setTimeout(() => {
      this._leaderboardTimers.delete(key);
      this._doBroadcastLeaderboard(sessionId, false);
    }, 300);
    timer.unref?.();

    this._leaderboardTimers.set(key, timer);
  }

  async _doBroadcastLeaderboard(sessionId, force = false) {
    try {
      const io = getIo();
      const roomName = `session_${sessionId}`;

      const leaderboard = await this.compileLeaderboard(sessionId);
      const snapshotHash = JSON.stringify(leaderboard.topParticipants);
      const previousHash = this._lastLeaderboardSnapshots.get(sessionId.toString());

      if (!force && previousHash === snapshotHash) {
        return;
      }

      if (!(await claimBroadcast("leaderboard", sessionId, 300))) return;

      this._lastLeaderboardSnapshots.set(sessionId.toString(), snapshotHash);

      io.to(roomName).emit("leaderboard_update", leaderboard);
    } catch (error) {
      logger.error("failed to broadcast leaderboard:", error.message);
    }
  }

  cleanupSession(sessionId) {
    if (!sessionId) return;
    const key = sessionId.toString();

    for (const map of [this._broadcastStateTimers, this._leaderboardTimers, this._analyticsTimers]) {
      if (map.has(key)) {
        clearTimeout(map.get(key));
        map.delete(key);
      }
    }

    this._lastLeaderboardSnapshots.delete(key);
    this._baseStateCache.delete(key);
  }
}

export const syncer = new Syncer();

/* A session or slide document changing invalidates the shared snapshot built
 * from it — on every process, since the cache layer relays invalidations over
 * Redis. Without this a replica that is not driving the session could keep
 * handing joiners the previous slide for up to BASE_STATE_TTL_MS. */
onInvalidate((type, id) => {
  if (type === "session") {
    syncer.invalidateBaseState(id);
    return;
  }

  /* A slide id does not identify the session holding it, and the snapshot is
   * short-lived anyway, so drop all of them rather than track a reverse index. */
  syncer._baseStateCache.clear();
});
