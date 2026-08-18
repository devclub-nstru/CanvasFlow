import type { Socket } from "socket.io";
import { Session, Slide } from "../../core/database/models/index.js";
import { syncer } from "../syncer.js";
import { invalidateCachedSession, invalidateCachedSlide } from "../cache.js";
import { wordCloudStore } from "../wordCloudStore.js";

const verifyHost = async (socket: Socket) => {
  const user = (socket as any).user;
  const sessionId = (socket as any).sessionId;

  if (!user || !sessionId) {
    throw new Error("Unauthorized: Only the host can perform this action");
  }

  const session = await Session.findOne({
    _id: sessionId,
    presenterId: user._id,
  }).lean();

  if (!session) {
    throw new Error("Unauthorized: You do not have permission to modify this session");
  }

  return session;
};

export const handleSessionStatusChange = async (socket: Socket, { status }: { status: string }) => {
  const validStatuses = ["waiting", "live", "paused", "finished"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const session = await verifyHost(socket);
  const sessionId = (socket as any).sessionId as string;

  const updateFields: Record<string, any> = {
    $set: { status, lastActivityAt: new Date() },
    $inc: { version: 1, eventSequence: 1 },
  };

  if (status === "live" && !session.startedAt) {
    updateFields["$set"].startedAt = new Date();
  } else if (status === "paused") {
    updateFields["$set"].pausedAt = new Date();
  } else if (status === "finished") {
    updateFields["$set"].endedAt = new Date();
    // Make sure the final word tally is durable before the session closes.
    if (session.currentSlideId) {
      void wordCloudStore.maybePersist(session.currentSlideId.toString(), true);
    }
  }

  await Session.findByIdAndUpdate(sessionId, updateFields);
  invalidateCachedSession(sessionId);

  console.log(`[WS Host] Session ${sessionId} status changed to: ${status}`);

  await syncer.broadcastState(sessionId);

  return { status };
};

export const handleToggleVotingLock = async (socket: Socket, { isLocked }: { isLocked: boolean }) => {
  if (typeof isLocked !== "boolean") {
    throw new Error("isLocked must be a boolean");
  }

  const sessionId = (socket as any).sessionId as string;
  await verifyHost(socket);

  await Session.findByIdAndUpdate(sessionId, {
    $set: { isVotingLocked: isLocked, lastActivityAt: new Date() },
    $inc: { version: 1, eventSequence: 1 },
  });
  invalidateCachedSession(sessionId);

  console.log(`[WS Host] Session ${sessionId} voting lock changed to: ${isLocked}`);

  await syncer.broadcastState(sessionId);

  return { isVotingLocked: isLocked };
};

export const handleStartQuestion = async (socket: Socket) => {
  const session = await verifyHost(socket);
  const sessionId = (socket as any).sessionId as string;

  if (!session.currentSlideId) throw new Error("No slide is currently active");

  const slide = await Slide.findById(session.currentSlideId).lean();
  if (!slide) throw new Error("The active slide no longer exists");
  if (slide.type !== "QUIZ") throw new Error("Only quiz slides use a timed question");

  const startedAt = new Date();

  await Session.findByIdAndUpdate(sessionId, {
    $set: {
      questionStartedAt: startedAt,
      [`questionTimings.${slide._id}`]: startedAt,
      isVotingLocked: false,
      lastActivityAt: startedAt,
    },
    $inc: { version: 1, eventSequence: 1 },
  });
  invalidateCachedSession(sessionId);

  console.log(`[WS Host] Session ${sessionId} started question on slide ${slide._id}`);

  await syncer.broadcastState(sessionId, true);

  return { questionStartedAt: startedAt.toISOString(), serverNow: Date.now() };
};

export const handleSlideChange = async (socket: Socket, { slideId }: { slideId: string }) => {
  if (!slideId) throw new Error("slideId is required");

  const session = await verifyHost(socket);
  const sessionId = (socket as any).sessionId as string;

  const targetSlide = await Slide.findOne({
    _id: slideId,
    presentationId: session.presentationId,
  }).lean();

  if (!targetSlide) {
    throw new Error("Invalid slide: This slide does not belong to the active presentation");
  }

  const previousSlideId = session.currentSlideId?.toString();
  if (previousSlideId && previousSlideId !== slideId.toString()) {
    void wordCloudStore.maybePersist(previousSlideId, true);
  }

  const isQuiz = targetSlide.type === "QUIZ";
  const timings = ((session as any).questionTimings ?? {}) as Record<string, Date | string>;
  const alreadyRunAt = timings[slideId.toString()];

  const questionStartedAt = isQuiz
    ? alreadyRunAt
      ? new Date(alreadyRunAt)
      : new Date()
    : null;

  const update: Record<string, any> = {
    $set: {
      currentSlideId: slideId,
      currentSlidePosition: targetSlide.position,
      isVotingLocked: false,
      questionStartedAt,
      lastActivityAt: new Date(),
    },
    $inc: { version: 1, eventSequence: 1 },
  };

  // Record the first run so later visits can restore it.
  if (isQuiz && !alreadyRunAt && questionStartedAt) {
    update.$set[`questionTimings.${slideId}`] = questionStartedAt;
  }

  await Session.findByIdAndUpdate(sessionId, update);
  // Must invalidate: the submit path reads the session through a 5s cache and
  // would otherwise reject answers against a stale questionStartedAt.
  invalidateCachedSession(sessionId);
  invalidateCachedSlide(slideId);

  console.log(`[WS Host] Session ${sessionId} changed to slide: ${slideId}`);

  await syncer.broadcastState(sessionId, true);
  // Immediately push fresh (empty) analytics for the new slide so clients
  // don't keep displaying the previous slide's analytics.
  await syncer.broadcastSlideAnalytics(sessionId, slideId, targetSlide.type, true);

  return { currentSlideId: slideId, order: targetSlide.position };
};
