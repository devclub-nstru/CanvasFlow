import { Session, Slide } from "../../src/core/database/models/index.js";
import { syncer } from "../syncer.js";
import { wipePresentationSessionData } from "../../src/modules/session/session.service.js";
import { invalidateCachedSession, invalidateCachedSlide } from "../cache.js";
import { quizTimerManager } from "../../src/modules/quiz/quizTimerManager.js";
import { clearPresence } from "../presence.js";

/* Gate for every action in this file.
 *
 * This used to check only that the socket carried a session id and that the
 * session existed — which every participant satisfies, because
 * handleConnection assigns socket.sessionId to participants too. Since these
 * handlers are registered on every connection, not just host ones, any
 * attendee could emit change_slide or change_session_status and drive the
 * deck. Two things are now required: the socket must have authenticated into
 * the host role, and the authenticated identity must be the session's own
 * presenter — so holding a session id for someone else's session is not
 * enough either.
 */
const verifyHost = async (socket) => {
  const sessionId = socket.sessionId || socket.data?.sessionId;
  const role = socket.data?.role;
  const userId = socket.data?.userId;

  if (role !== "host" || !userId || !sessionId) {
    throw new Error("Unauthorized: Only the host can perform this action");
  }

  const session = await Session.findById(sessionId).lean();

  if (!session) {
    throw new Error("Unauthorized: Session not found");
  }

  if (!session.presenterId || session.presenterId.toString() !== userId.toString()) {
    throw new Error("Unauthorized: Only the host can perform this action");
  }

  return session;
};

const updateSessionWithOCC = async (socket, updateFieldsBuilder, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const session = await verifyHost(socket);
    const versionVal = typeof session.version === "number" ? session.version : 0;

    const versionQuery = {
      _id: socket.sessionId,
      $or: [{ version: versionVal }, { version: { $exists: false } }],
    };

    const updateFields =
      typeof updateFieldsBuilder === "function"
        ? updateFieldsBuilder(session)
        : updateFieldsBuilder;

    const updated = await Session.findOneAndUpdate(versionQuery, updateFields, {
      new: true,
    });
    if (updated) {
      return { updatedSession: updated, session };
    }
  }
  throw new Error("Conflict: Concurrent session update detected. Please try again.");
};

export const handleSessionStatusChange = async (socket, { status }) => {
  const validStatuses = ["waiting", "live", "paused", "finished"];
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
    );
  }

  const { session } = await updateSessionWithOCC(socket, (sess) => {
    const updateFields = {
      $set: { status, lastActivityAt: new Date() },
      $inc: { version: 1, eventSequence: 1 },
    };

    if (status === "live" && !sess.startedAt) {
      updateFields.$set.startedAt = new Date();
    } else if (status === "paused") {
      updateFields.$set.pausedAt = new Date();
    } else if (status === "finished") {
      updateFields.$set.endedAt = new Date();
    }

    return updateFields;
  });

  if (status === "waiting") {
    await wipePresentationSessionData(session.presentationId);
    const slides = await Slide.find({ presentationId: session.presentationId }).lean();
    for (const slide of slides) {
      await syncer.broadcastSlideAnalytics(socket.sessionId, slide._id, slide.type);
    }
  }

  if (status === "finished") {
    syncer.cleanupSession(socket.sessionId);
    /* Release the Redis presence set rather than leaving it to its TTL. */
    await clearPresence(socket.sessionId);
  }

  invalidateCachedSession(socket.sessionId);

  console.log(
    `[WS Host] Session ${socket.sessionId} status changed to: ${status}`,
  );

  await syncer.broadcastState(socket.sessionId);

  return { status };
};

export const handleToggleVotingLock = async (socket, { isLocked }) => {
  if (typeof isLocked !== "boolean") {
    throw new Error("isLocked must be a boolean");
  }

  await updateSessionWithOCC(socket, {
    $set: {
      isVotingLocked: isLocked,
      lastActivityAt: new Date(),
    },
    $inc: { version: 1, eventSequence: 1 },
  });

  invalidateCachedSession(socket.sessionId);

  console.log(
    `[WS Host] Session ${socket.sessionId} voting lock changed to: ${isLocked}`,
  );

  await syncer.broadcastState(socket.sessionId);

  return { isVotingLocked: isLocked };
};

export const handleSlideChange = async (socket, { slideId }) => {
  if (!slideId) {
    throw new Error("slideId is required");
  }

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const session = await verifyHost(socket);

      const targetSlide = await Slide.findOne({
        _id: slideId,
        presentationId: session.presentationId,
      }).lean();

      if (!targetSlide) {
        throw new Error(
          "Invalid slide: This slide does not belong to the active presentation",
        );
      }

      if (targetSlide.type === "QUIZ") {
        const existingQuizState = session.quizState;
        const isSameQuizSlide =
          existingQuizState &&
          existingQuizState.slideId &&
          existingQuizState.slideId.toString() === slideId.toString();

        const hasAlreadyRun = isSameQuizSlide && Boolean(existingQuizState.startedAt);
        const isStillActive =
          hasAlreadyRun &&
          existingQuizState.endsAt &&
          Date.now() < new Date(existingQuizState.endsAt).getTime() &&
          !existingQuizState.isLocked;

        if (isStillActive) {
          // Timer is currently running in the future -> keep it running with active lock = false
          const versionVal = typeof session.version === "number" ? session.version : 0;
          const updatedSession = await Session.findOneAndUpdate(
            {
              _id: socket.sessionId,
              $or: [{ version: versionVal }, { version: { $exists: false } }],
            },
            {
              $set: {
                status: "live",
                currentSlideId: slideId,
                currentSlidePosition: targetSlide.position,
                isVotingLocked: false,
                lastActivityAt: new Date(),
              },
              $inc: { version: 1, eventSequence: 1 },
            },
            { new: true }
          );

          if (!updatedSession) {
            throw new Error("Conflict: Concurrent session update detected. Please try again.");
          }
          invalidateCachedSession(socket.sessionId);
          invalidateCachedSlide(slideId);
        } else if (hasAlreadyRun) {
          // Timer was already completed / answers revealed -> KEEP LOCKED permanently!
          const versionVal = typeof session.version === "number" ? session.version : 0;
          const updatedSession = await Session.findOneAndUpdate(
            {
              _id: socket.sessionId,
              $or: [{ version: versionVal }, { version: { $exists: false } }],
            },
            {
              $set: {
                status: "live",
                currentSlideId: slideId,
                currentSlidePosition: targetSlide.position,
                isVotingLocked: true,
                "quizState.isLocked": true,
                lastActivityAt: new Date(),
              },
              $inc: { version: 1, eventSequence: 1 },
            },
            { new: true }
          );

          if (!updatedSession) {
            throw new Error("Conflict: Concurrent session update detected. Please try again.");
          }
          invalidateCachedSession(socket.sessionId);
          invalidateCachedSlide(slideId);
        } else {
          // First time opening this quiz slide -> start full timer!
          const timeLimit = targetSlide.quizSettings?.timeLimitSeconds || 30;
          const versionVal = typeof session.version === "number" ? session.version : 0;
          await quizTimerManager.startQuizTimer(socket.sessionId, slideId, timeLimit, targetSlide.position, versionVal);
        }
      } else {
        // Standard presentation slides (BAR_GRAPH, WORD_CLOUD, SCALES, CONTENT, LEADERBOARD)
        const versionVal = typeof session.version === "number" ? session.version : 0;
        const updateDoc = {
          $set: {
            status: "live",
            currentSlideId: slideId,
            currentSlidePosition: targetSlide.position,
            isVotingLocked: false, // Auto-reset lock when moving to non-quiz slides
            lastActivityAt: new Date(),
          },
          $inc: { version: 1, eventSequence: 1 },
        };
        if (!session.startedAt) {
          updateDoc.$set.startedAt = new Date();
        }

        const updatedSession = await Session.findOneAndUpdate(
          {
            _id: socket.sessionId,
            $or: [{ version: versionVal }, { version: { $exists: false } }],
          },
          updateDoc,
          { new: true }
        );

        if (!updatedSession) {
          throw new Error("Conflict: Concurrent session update detected. Please try again.");
        }
        invalidateCachedSession(socket.sessionId);
        invalidateCachedSlide(slideId);
      }

      // If host moved to LEADERBOARD slide, immediately compile and broadcast top 10 snapshot
      if (targetSlide.type === "LEADERBOARD") {
        await syncer.broadcastLeaderboard(socket.sessionId, true);
      }

      console.log(
        `[WS Host] Session ${socket.sessionId} changed to slide: ${slideId} (${targetSlide.type})`,
      );

      // Broadcast authoritative state change immediately so ALL participants move to the current slide
      await syncer.broadcastState(socket.sessionId, true);

      /* Push the new slide's tallies straight away.
       *
       * Analytics were previously only emitted in response to a vote, so
       * arriving on a slide that already had responses (a revisit, or a late
       * joiner's screen) showed an empty chart until somebody voted again. The
       * client keys analytics by slide id, so this frame also replaces whatever
       * the previous slide had left on screen. */
      if (targetSlide.type !== "LEADERBOARD" && targetSlide.type !== "CONTENT") {
        await syncer.broadcastSlideAnalytics(
          socket.sessionId,
          slideId,
          targetSlide.type,
          true,
        );
      }

      return { currentSlideId: slideId, order: targetSlide.position };

    } catch (error) {
      if (error.message.includes("Conflict") && attempt < maxRetries - 1) {
        console.warn(`[WS Host] Version conflict during slide change, retrying (attempt ${attempt + 1}/${maxRetries})...`);
        continue;
      }
      throw error;
    }
  }
};
