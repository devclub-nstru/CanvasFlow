import crypto from "crypto";
import {
  Session,
  Slide,
  Response,
  Participant,
} from "../../src/core/database/models/index.js";
import { syncer } from "../syncer.js";
import { getCachedSession, getCachedSlide } from "../cache.js";
import { calculateQuizPoints } from "../../src/modules/quiz/quizScorer.js";

const ALREADY_SUBMITTED = "You have already submitted a response for this slide";

/* Single insert path for every slide type.
 *
 * The unique index on (sessionId, slideId, participantId, submissionSlot) is
 * what actually enforces one-answer-per-participant, so every branch inserts
 * and translates a duplicate-key error into a message the participant can
 * read. This replaced the per-branch `Response.exists()` pre-checks, which
 * were both racy — two sockets could pass the check before either inserted —
 * and an extra round trip in the hottest path in the system.
 */
async function insertResponse(doc, duplicateMessage = ALREADY_SUBMITTED) {
  try {
    return await Response.create(doc);
  } catch (err) {
    if (err.code === 11000) throw new Error(duplicateMessage);
    throw err;
  }
}

/* Decides what one submission means for this slide — see the submissionSlot
 * field on the Response schema. */
export function resolveSubmissionSlot(slide, commandId) {
  const unlimited =
    slide.responseSettings?.multipleSubmissions === true ||
    slide.responseSettings?.maxEntriesPerParticipant === 0;

  return unlimited ? commandId : "single";
}

export const handleSubmitResponse = async (socket, { slideId, answer }) => {
  const participantId = socket.data?.participantId || socket.participant?._id;
  const sessionId = socket.data?.sessionId || socket.sessionId;

  if (!participantId || !sessionId) {
    throw new Error("Unauthorized: Only participants can submit responses");
  }

  const session = await getCachedSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  if (session.status === "finished" || session.status === "cancelled") {
    throw new Error("Cannot submit response: The session has ended");
  }
  if (session.isVotingLocked) {
    throw new Error("Voting is currently locked for this session");
  }

  // Fetch slide details from cache / DB
  const slide = await getCachedSlide(slideId);
  if (!slide) {
    throw new Error("Slide not found");
  }

  const commandId = crypto.randomUUID();
  const submissionSlot = resolveSubmissionSlot(slide, commandId);

  switch (slide.type) {
    case "QUIZ": {
      // 1. Server-authoritative timer check
      const serverNow = Date.now();
      if (session.quizState?.isLocked) {
        throw new Error("Voting is locked for this quiz");
      }
      if (session.quizState?.endsAt) {
        const expiresAt = new Date(session.quizState.endsAt).getTime();
        if (serverNow > expiresAt + 2000) {
          throw new Error("Time has expired for this quiz");
        }
      }

      // 2. Validate selected option
      const selectedOptionId =
        typeof answer === "string"
          ? answer.trim()
          : Array.isArray(answer)
          ? answer[0]
          : typeof answer === "object" && answer !== null
          ? answer.optionId || answer.id || null
          : null;
      if (!selectedOptionId) {
        throw new Error("You must select an answer option");
      }

      const targetOption = (slide.options || []).find((opt) => opt.id === selectedOptionId);
      if (!targetOption) {
        throw new Error("Selected answer option does not exist on this slide");
      }

      // 3. Determine elapsed time and correctness
      const startedAtMs = session.quizState?.startedAt ? new Date(session.quizState.startedAt).getTime() : serverNow;
      const elapsedMs = Math.max(0, serverNow - startedAtMs);
      const durationMs = session.quizState?.durationMs || (slide.quizSettings?.timeLimitSeconds || 30) * 1000;
      const isCorrect = targetOption.isCorrect === true;

      // 4. Calculate points using isolated strategy
      const pointsAwarded = calculateQuizPoints({
        gradingScheme: slide.quizSettings?.gradingScheme || "time_based",
        maxPoints: slide.quizSettings?.maxPoints || 100,
        timeLimitSeconds: slide.quizSettings?.timeLimitSeconds || 30,
        durationMs,
        elapsedMs,
        isCorrect,
      });

      // 5. Insert. The unique index is what makes this one-answer-per-participant.
      await insertResponse(
        {
          sessionId,
          presentationId: session.presentationId,
          slideId,
          participantId,
          type: "select",
          answer: { optionIds: [selectedOptionId] },
          pointsAwarded,
          isCorrect,
          elapsedMs,
          commandId,
          submissionSlot,
        },
        "You have already submitted an answer for this quiz",
      );

      // 6. Atomic MongoDB score increment
      const updatedParticipant = await Participant.findByIdAndUpdate(
        participantId,
        { $inc: { score: pointsAwarded } },
        { new: true }
      ).select("score").lean();

      // 7. Update slide vote counts & trigger immediate analytics/leaderboard broadcasts
      await Slide.updateOne(
        { _id: slideId },
        { $inc: { "options.$[elem].voteCount": 1 } },
        { arrayFilters: [{ "elem.id": selectedOptionId }] }
      );

      /* Deliberately no cache invalidation here. A response changes the
       * participant's score and the slide's vote tallies — never the session
       * document — and compileAnalytics reads tallies straight from Mongo. The
       * two invalidations that used to sit here fired once per answer, so a
       * 1000-person quiz published 2000 Redis invalidation messages and threw
       * away the shared state snapshot on every single submission. */

      await syncer.broadcastSlideAnalytics(sessionId, slideId, slide.type, false);
      await syncer.broadcastLeaderboard(sessionId, false);

      return {
        success: true,
        isCorrect,
        pointsAwarded,
        totalScore: updatedParticipant?.score || 0,
        selectedOptionId,
      };
    }
    case "BAR_GRAPH":
    case "select":
    case "multi_select": {
      let optionIds = [];
      if (Array.isArray(answer)) {
        optionIds = answer;
      } else if (typeof answer === "string" && answer.trim()) {
        optionIds = [answer.trim()];
      } else {
        throw new Error("Answer must be a selected option ID or array of IDs");
      }

      await insertResponse({
        sessionId,
        presentationId: session.presentationId,
        slideId,
        participantId,
        type: "select",
        answer: { optionIds },
        commandId,
        submissionSlot,
      });

      // Update voteCount on slide options in DB
      if (optionIds.length > 0) {
        await Slide.updateOne(
          { _id: slideId },
          { $inc: { "options.$[elem].voteCount": 1 } },
          { arrayFilters: [{ "elem.id": { $in: optionIds } }] }
        );
      }
      break;
    }

    case "WORD_CLOUD":
    case "text":
    case "multi_text": {
      let words = [];
      if (Array.isArray(answer)) {
        words = answer
          .map((w) => (typeof w === "string" ? w.trim().slice(0, 50) : String(w).trim().slice(0, 50)))
          .filter((w) => w.length > 0)
          .slice(0, 5);
      } else if (typeof answer === "string" && answer.trim()) {
        words = [answer.trim().slice(0, 50)];
      }

      if (words.length === 0) {
        throw new Error("Answer must contain at least one non-empty word");
      }

      /* No unlimited/limited branch here any more. submissionSlot already
       * encodes the difference — "single" for a one-entry cloud, the unique
       * commandId for an unlimited one — so a single insert is correct for
       * both, and the index enforces whichever applies. */
      await insertResponse({
        sessionId,
        presentationId: session.presentationId,
        slideId,
        participantId,
        type: "text",
        answer: {
          text: words.join(", "),
          raw: words,
        },
        commandId,
        submissionSlot,
      });
      break;
    }

    case "SCALES":
    case "rating": {
      const base = {
        sessionId,
        presentationId: session.presentationId,
        slideId,
        participantId,
        type: "rating",
        commandId,
        submissionSlot,
      };

      if (typeof answer === "number") {
        await insertResponse({ ...base, answer: { rating: answer, raw: answer } });
      } else if (typeof answer === "object" && answer !== null) {
        await insertResponse({ ...base, answer: { raw: answer } });
      } else if (typeof answer === "string" && !isNaN(Number(answer))) {
        const num = Number(answer);
        await insertResponse({ ...base, answer: { rating: num, raw: num } });
      } else {
        throw new Error("Answer must be a valid rating number or object");
      }
      break;
    }

    case "CONTENT": {
      break;
    }

    default:
      throw new Error(`Unsupported slide type: ${slide.type}`);
  }

  await syncer.broadcastSlideAnalytics(sessionId, slideId, slide.type);

  return { success: true };
};
