import mongoose from "mongoose";
import { Session, Participant, Slide, Response } from "../core/database/models/index.js";
import { getIo } from "./server.js";
import { wordCloudStore } from "./wordCloudStore.js";
import { getQuizWindow, readTiming, type QuizPhase } from "./quizEngine.js";

const WORD_CLOUD_BROADCAST_LIMIT = 60;

class Syncer {
  private _broadcastStateTimers = new Map<string, NodeJS.Timeout>();
  private _analyticsTimers = new Map<string, NodeJS.Timeout>();
  private _analyticsPressure = new Map<string, number>();

  async compileLeaderboard(
    sessionId: string,
    limit = 20,
    excludeSlideId?: string,
  ): Promise<any[]> {
    if (!sessionId) return [];

    const match: Record<string, unknown> = {
      sessionId: new mongoose.Types.ObjectId(sessionId.toString()),
    };
    if (excludeSlideId) {
      match.slideId = { $ne: new mongoose.Types.ObjectId(excludeSlideId.toString()) };
    }

    return Response.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$participantId",
          totalPoints: { $sum: "$pointsAwarded" },
          correctCount: { $sum: { $cond: ["$isCorrect", 1, 0] } },
          answered: { $sum: 1 },
          // Tiebreak on total speed so a faster player outranks an equal score.
          totalTimeMs: { $sum: { $ifNull: ["$responseTimeMs", 0] } },
        },
      },

      { $sort: { totalPoints: -1, totalTimeMs: 1, _id: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "participants",
          localField: "_id",
          foreignField: "_id",
          as: "participant",
        },
      },
      { $unwind: { path: "$participant", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          participantId: "$_id",
          nickname: { $ifNull: ["$participant.nickname", "Unknown"] },
          totalPoints: 1,
          correctCount: 1,
          answered: 1,
        },
      },
    ]);
  }

  async compileAnalytics(slideId: string, slideType?: string, sessionId?: string): Promise<any> {
    const slide = await Slide.findById(slideId).lean();
    if (!slide) return null;

    const effectiveType: string = slide.type || slideType || "";
    const targetSlideId = new mongoose.Types.ObjectId(slideId.toString());

    if (effectiveType === "LEADERBOARD") {
      if (!sessionId) {
        return { slideId, type: "LEADERBOARD", leaderboard: [], previous: [], scoredSlideId: null };
      }

      const scoredSlide = await Slide.findOne({
        presentationId: slide.presentationId,
        type: "QUIZ",
        position: { $lt: slide.position },
      })
        .sort({ position: -1 })
        .select("_id")
        .lean();

      const scoredSlideId = scoredSlide?._id?.toString() ?? null;

      const [leaderboard, previous] = await Promise.all([
        this.compileLeaderboard(sessionId, 50),
        scoredSlideId
          ? this.compileLeaderboard(sessionId, 50, scoredSlideId)
          : Promise.resolve([]),
      ]);

      return { slideId, type: "LEADERBOARD", leaderboard, previous, scoredSlideId };
    }

    if (effectiveType === "QUIZ") {
      const options = slide.options || [];
      const correctOptionIds = options.filter((opt) => opt.isCorrect).map((opt) => opt.id);
      const [tally, totals, fastest] = await Promise.all([
        Response.aggregate([
          { $match: { slideId: targetSlideId } },
          { $unwind: "$answer.optionIds" },
          { $group: { _id: "$answer.optionIds", count: { $sum: 1 } } },
        ]),
        Response.aggregate([
          { $match: { slideId: targetSlideId } },
          {
            $group: {
              _id: null,
              totalResponses: { $sum: 1 },
              correctResponses: { $sum: { $cond: ["$isCorrect", 1, 0] } },
              averageTimeMs: { $avg: "$responseTimeMs" },
            },
          },
        ]),
        // Whoever got it right first — the headline of a speed round.
        Response.find({ slideId: targetSlideId, isCorrect: true })
          .sort({ responseTimeMs: 1 })
          .limit(1)
          .populate<{ participantId: { nickname?: string } }>("participantId", "nickname")
          .lean(),
      ]);

      const countById = new Map(tally.map((row) => [String(row._id), row.count as number]));
      const summary = totals[0] ?? { totalResponses: 0, correctResponses: 0, averageTimeMs: null };
      const winner = fastest[0] as any;

      return {
        slideId,
        type: "QUIZ",
        results: options.map((opt) => ({
          id: opt.id,
          label: opt.label,
          count: countById.get(opt.id) ?? 0,
          isCorrect: Boolean(opt.isCorrect),
        })),
        correctOptionIds,
        totalVotes: summary.totalResponses,
        totalResponses: summary.totalResponses,
        correctResponses: summary.correctResponses,
        averageTimeMs:
          summary.averageTimeMs === null ? null : Math.round(summary.averageTimeMs),
        fastestCorrect: winner
          ? {
              nickname: winner.participantId?.nickname ?? "Unknown",
              responseTimeMs: winner.responseTimeMs ?? 0,
              pointsAwarded: winner.pointsAwarded ?? 0,
            }
          : null,
      };
    }

    if (effectiveType === "BAR_GRAPH" || effectiveType === "select" || effectiveType === "multi_select") {
      const results = (slide.options || []).map((opt) => ({
        id: opt.id,
        label: opt.label,
        count: opt.voteCount || 0,
      }));
      const totalVotes = results.reduce((sum, r) => sum + r.count, 0);
      return { slideId, type: "BAR_GRAPH", results, totalVotes };
    }

    if (effectiveType === "WORD_CLOUD" || effectiveType === "text" || effectiveType === "multi_text") {
      const { words, totalWords, uniqueWords } = await wordCloudStore.snapshot(
        slideId,
        WORD_CLOUD_BROADCAST_LIMIT,
      );

      // Mirror onto Slide.options in the background, rate limited internally.
      void wordCloudStore.maybePersist(slideId);

      const wordCloudOptions = words.map((word, index) => ({
        id: `word-${index}-${word.text}`,
        label: word.text,
        voteCount: word.value,
      }));

      return {
        slideId,
        type: "WORD_CLOUD",
        wordCloud: words,
        options: wordCloudOptions,
        results: wordCloudOptions,
        totalResponses: totalWords,
        uniqueWords,
      };
    }

    if (effectiveType === "RANKING") {
      const options = slide.options || [];
      const itemCount = options.length;

      if (itemCount === 0) {
        return { slideId, type: "RANKING", results: [], totalResponses: 0, itemCount: 0 };
      }

      /*
       * Borda count. Each response stores option IDs ordered best-first, so the
       * array index is the rank: index 0 scores `itemCount` points, the last
       * index scores 1. Summing per option gives the consensus ordering.
       */
      const [agg, totalResponses] = await Promise.all([
        Response.aggregate([
          { $match: { slideId: targetSlideId } },
          { $unwind: { path: "$answer.optionIds", includeArrayIndex: "position" } },
          {
            $group: {
              _id: "$answer.optionIds",
              points: { $sum: { $subtract: [itemCount, "$position"] } },
              averageRank: { $avg: { $add: ["$position", 1] } },
              firstPlaceVotes: { $sum: { $cond: [{ $eq: ["$position", 0] }, 1, 0] } },
              count: { $sum: 1 },
            },
          },
        ]),
        Response.countDocuments({ slideId: targetSlideId }),
      ]);

      const statsById = new Map(agg.map((row) => [String(row._id), row]));

      const results = options
        .map((opt) => {
          const stats = statsById.get(opt.id);
          return {
            id: opt.id,
            label: opt.label,
            points: stats?.points ?? 0,
            averageRank: stats ? Number(stats.averageRank.toFixed(2)) : 0,
            firstPlaceVotes: stats?.firstPlaceVotes ?? 0,
            count: stats?.count ?? 0,
          };
        })
        .sort(
          (a, b) =>
            b.points - a.points ||
            // An option nobody ranked has averageRank 0; keep it last.
            (a.averageRank || Infinity) - (b.averageRank || Infinity) ||
            a.label.localeCompare(b.label),
        );

      return { slideId, type: "RANKING", results, totalResponses, itemCount };
    }

    if (effectiveType === "SCALES" || effectiveType === "rating") {
      const min = (slide.responseSettings?.minRating as number | undefined) ?? 1;
      const max = (slide.responseSettings?.maxRating as number | undefined) ?? 5;

      const ratingAgg = await Response.aggregate([
        { $match: { slideId: targetSlideId } },
        { $group: { _id: "$answer.rating", count: { $sum: 1 }, sum: { $sum: "$answer.rating" } } },
      ]);

      const statsMap: Record<number, { count: number; sum: number }> = {};
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
        results.push({ id: `rate-${i}`, label: String(i), mean, count: stats.count });
      }

      return { slideId, type: "SCALES", results, totalResponses };
    }

    return { slideId, type: effectiveType, data: null };
  }

  async getLiveState(sessionId: string, participantId?: string | null): Promise<any> {
    const session = await Session.findById(sessionId).lean();
    if (!session) throw new Error("Session not found");

    const io = getIo();
    let participantCount = 0;

    if (io) {
      const roomName = `session_${sessionId}`;
      const hostRoomName = `session_${sessionId}_host`;
      const room = io.sockets.adapter.rooms.get(roomName);
      const hostRoom = io.sockets.adapter.rooms.get(hostRoomName);
      const totalSockets = room ? room.size : 0;
      const hostSockets = hostRoom ? hostRoom.size : 0;
      participantCount = Math.max(0, totalSockets - hostSockets);
    } else {
      participantCount = await Participant.countDocuments({ sessionId, status: "active" });
    }

    let currentSlide = null;
    if (session.status === "live" && session.currentSlideId) {
      currentSlide = await Slide.findById(session.currentSlideId).lean();
    }

    let submittedSlideIds: string[] = [];
    if (participantId) {
      const responses = await Response.find({ sessionId, participantId }).select("slideId").lean();
      const rawIds = Array.from(new Set(responses.map((r) => r.slideId.toString())));

      if (
        currentSlide &&
        (currentSlide as any).type === "WORD_CLOUD" &&
        ((currentSlide as any).responseSettings?.multipleSubmissions === true ||
          (currentSlide as any).responseSettings?.maxEntriesPerParticipant === 0)
      ) {
        submittedSlideIds = rawIds.filter((id) => id !== (currentSlide as any)._id.toString());
      } else {
        submittedSlideIds = rawIds;
      }
    }

    let safeSlide = currentSlide;
    let quizPhase: QuizPhase | null = null;

    if (currentSlide && (currentSlide as any).type === "QUIZ") {
      const timing = readTiming((currentSlide as any).responseSettings);
      quizPhase = getQuizWindow(session.questionStartedAt, timing).phase;

      safeSlide = {
        ...(currentSlide as any),
        options: ((currentSlide as any).options || []).map((opt: any) => ({
          id: opt.id,
          label: opt.label,
          color: opt.color,
        })),
      };
    }

    return {
      session: {
        id: session._id,
        code: session.code,
        status: session.status,
        version: session.version,
        settings: session.settings,
        currentSlideId: session.currentSlideId,
        isVotingLocked: session.isVotingLocked,
        questionStartedAt: session.questionStartedAt ?? null,
        quizPhase,
      },
      participantCount,
      currentSlide: safeSlide,
      submittedSlideIds,
      serverNow: Date.now(),
    };
  }

  async sendStateToSocket(socket: any, sessionId: string): Promise<void> {
    try {
      const participantId = socket.participant ? socket.participant._id : null;
      const state = await this.getLiveState(sessionId, participantId);
      socket.emit("session_state_sync", state);
    } catch (error: any) {
      console.error("[Syncer] Failed to send state to socket:", error.message);
    }
  }

  async broadcastState(sessionId: string, immediate = false): Promise<void> {
    if (!sessionId) return;
    const key = sessionId.toString();

    if (immediate) {
      if (this._broadcastStateTimers.has(key)) {
        clearTimeout(this._broadcastStateTimers.get(key)!);
        this._broadcastStateTimers.delete(key);
      }
      return this._doBroadcastState(sessionId);
    }

    if (this._broadcastStateTimers.has(key)) return;

    const timer = setTimeout(() => {
      this._broadcastStateTimers.delete(key);
      this._doBroadcastState(sessionId);
    }, 250);

    this._broadcastStateTimers.set(key, timer);
  }

  private async _doBroadcastState(sessionId: string): Promise<void> {
    try {
      const io = getIo();
      const roomName = `session_${sessionId}`;
      const sockets = await io.in(roomName).fetchSockets();
      if (sockets.length === 0) return;
      const state = await this.getLiveState(sessionId);
      io.to(roomName).emit("session_state_sync", state);
    } catch (error: any) {
      console.error("[Syncer] Failed to broadcast state:", error.message);
    }
  }

  private _analyticsWindowFor(pressure: number): number {
    if (pressure > 400) return 1200;
    if (pressure > 120) return 800;
    if (pressure > 30) return 450;
    return 250;
  }

  async broadcastSlideAnalytics(sessionId: string, slideId: string, slideType?: string, immediate = false): Promise<void> {
    if (!slideId) return;
    const key = slideId.toString();

    this._analyticsPressure.set(key, (this._analyticsPressure.get(key) ?? 0) + 1);

    if (immediate) {
      if (this._analyticsTimers.has(key)) {
        clearTimeout(this._analyticsTimers.get(key)!);
        this._analyticsTimers.delete(key);
      }
      this._analyticsPressure.set(key, 0);
      return this._doBroadcastSlideAnalytics(sessionId, slideId, slideType);
    }

    if (this._analyticsTimers.has(key)) return;

    const window = this._analyticsWindowFor(this._analyticsPressure.get(key) ?? 0);

    const timer = setTimeout(() => {
      this._analyticsTimers.delete(key);
      this._analyticsPressure.set(key, 0);
      this._doBroadcastSlideAnalytics(sessionId, slideId, slideType);
    }, window);

    this._analyticsTimers.set(key, timer);
  }

  private async _doBroadcastSlideAnalytics(sessionId: string, slideId: string, slideType?: string): Promise<void> {
    try {
      const io = getIo();
      const hostRoomName = `session_${sessionId}_host`;
      const sockets = await io.in(hostRoomName).fetchSockets();
      if (sockets.length === 0) return;
      const analytics = await this.compileAnalytics(slideId, slideType, sessionId);
      io.to(hostRoomName).emit("slide_analytics_update", analytics);
    } catch (error: any) {
      console.error("[Syncer] Failed to broadcast slide analytics:", error.message);
    }
  }
}

export const syncer = new Syncer();
