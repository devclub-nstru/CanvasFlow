import crypto from "crypto";
import type { Socket } from "socket.io";
import { Session, Slide, Response } from "../../core/database/models/index.js";
import { syncer } from "../syncer.js";
import { getCachedSession, getCachedSlide } from "../cache.js";
import { wordCloudStore } from "../wordCloudStore.js";
import {
  checkSubmissionWindow,
  isAnswerCorrect,
  readTiming,
  scoreAnswer,
} from "../quizEngine.js";

export const handleSubmitResponse = async (socket: Socket, { slideId, answer }: { slideId: string; answer: any }) => {
  const participantId = socket.data?.participantId || (socket as any).participant?._id;
  const sessionId = socket.data?.sessionId || (socket as any).sessionId;

  if (!participantId || !sessionId) {
    throw new Error("Unauthorized: Only participants can submit responses");
  }

  const session = await getCachedSession(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status !== "live") throw new Error("Cannot submit response: The session is not live");
  if (session.isVotingLocked) throw new Error("Voting is currently locked for this session");

  const slide = await getCachedSlide(slideId);
  if (!slide) throw new Error("Slide not found");

  const commandId = crypto.randomUUID();

  switch (slide.type) {
    case "BAR_GRAPH":
    case "select":
    case "multi_select": {
      let optionIds: string[] = [];
      if (Array.isArray(answer)) {
        optionIds = answer;
      } else if (typeof answer === "string" && answer.trim()) {
        optionIds = [answer.trim()];
      } else {
        throw new Error("Answer must be a selected option ID or array of IDs");
      }

      try {
        await Response.create({
          sessionId,
          presentationId: session.presentationId,
          slideId,
          participantId,
          type: "select",
          answer: { optionIds },
          commandId,
        });
      } catch (err: any) {
        if (err.code === 11000) {
          throw new Error("You have already submitted a response for this slide");
        }
        throw err;
      }

      if (optionIds.length > 0) {
        await Slide.updateOne(
          { _id: slideId },
          { $inc: { "options.$[elem].voteCount": 1 } },
          { arrayFilters: [{ "elem.id": { $in: optionIds } }] },
        );
      }
      break;
    }

    case "WORD_CLOUD":
    case "text":
    case "multi_text": {
      let words: string[] = [];
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

      const isUnlimited = Boolean(
        slide.responseSettings?.multipleSubmissions === true ||
          slide.responseSettings?.maxEntriesPerParticipant === 0,
      );

      if (!isUnlimited) {
        const exists = await Response.exists({ sessionId, slideId, participantId });
        if (exists) throw new Error("You have already submitted a response for this slide");
      }

      const created = await Response.create({
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
      });

      await wordCloudStore.ingest(slideId, words, created.submittedAt ?? new Date());
      break;
    }

    case "QUIZ": {
      const timing = readTiming(slide.responseSettings);

      const window = checkSubmissionWindow(session.questionStartedAt, timing, Date.now());

      if (!window.accepted) {
        if (window.reason === "not_started") throw new Error("This question has not started yet");
        if (window.reason === "too_early") throw new Error("Answers are not open yet");
        throw new Error("Time is up for this question");
      }

      let optionIds: string[] = [];
      if (Array.isArray(answer)) {
        optionIds = answer.map((entry) => String(entry ?? "").trim()).filter(Boolean);
      } else if (typeof answer === "string" && answer.trim()) {
        optionIds = [answer.trim()];
      }

      const quizValidIds = new Set<string>((slide.options || []).map((opt: any) => opt.id));
      optionIds = Array.from(new Set(optionIds)).filter((id) => quizValidIds.has(id));

      if (optionIds.length === 0) {
        throw new Error("Answer must be a selected option ID");
      }

      const correctOptionIds = (slide.options || [])
        .filter((opt: any) => opt.isCorrect)
        .map((opt: any) => opt.id);

      const correct = isAnswerCorrect(optionIds, correctOptionIds);
      const points = scoreAnswer(correct, window.responseTimeMs, timing);

      const previous = await Response.findOneAndUpdate(
        { sessionId, slideId, participantId },
        {
          $setOnInsert: {
            presentationId: session.presentationId,
            type: "select",
            answer: { optionIds },
            commandId,
            isCorrect: correct,
            responseTimeMs: window.responseTimeMs,
            pointsAwarded: points,
            submittedAt: new Date(),
          },
        },
        { upsert: true, new: false },
      ).lean();

      if (previous) {
        throw new Error("You have already submitted a response for this slide");
      }

      await Slide.updateOne(
        { _id: slideId },
        { $inc: { "options.$[elem].voteCount": 1 } },
        { arrayFilters: [{ "elem.id": { $in: optionIds } }] },
      );

      await syncer.broadcastSlideAnalytics(sessionId, slideId, slide.type);

      return {
        success: true,
        isCorrect: correct,
        pointsAwarded: points,
        responseTimeMs: window.responseTimeMs,
      };
    }

    case "RANKING": {
      if (!Array.isArray(answer)) {
        throw new Error("Answer must be an ordered array of option IDs");
      }

      const validIds = new Set<string>((slide.options || []).map((opt: any) => opt.id));
      const ordered: string[] = [];
      const seen = new Set<string>();

      for (const entry of answer) {
        const id = typeof entry === "string" ? entry.trim() : String(entry ?? "").trim();
        if (!id || !validIds.has(id) || seen.has(id)) continue;
        seen.add(id);
        ordered.push(id);
      }

      if (ordered.length !== validIds.size) {
        throw new Error(
          "This ranking is out of date because the options changed — please refresh and try again",
        );
      }

      const rankingExists = await Response.exists({ sessionId, slideId, participantId });
      if (rankingExists) throw new Error("You have already submitted a response for this slide");

      await Response.create({
        sessionId,
        presentationId: session.presentationId,
        slideId,
        participantId,
        type: "ranking",
        // Order carries the ranking: index 0 is the participant's first choice.
        answer: { optionIds: ordered, raw: ordered },
        commandId,
      });
      break;
    }

    case "SCALES":
    case "rating": {
      const exists = await Response.exists({ sessionId, slideId, participantId });
      if (exists) throw new Error("You have already submitted a response for this slide");

      let ratingAnswer: Record<string, any>;
      if (typeof answer === "number") {
        ratingAnswer = { rating: answer, raw: answer };
      } else if (typeof answer === "object" && answer !== null) {
        ratingAnswer = { raw: answer };
      } else if (typeof answer === "string" && !isNaN(Number(answer))) {
        const num = Number(answer);
        ratingAnswer = { rating: num, raw: num };
      } else {
        throw new Error("Answer must be a valid rating number or object");
      }

      await Response.create({
        sessionId,
        presentationId: session.presentationId,
        slideId,
        participantId,
        type: "rating",
        answer: ratingAnswer,
        commandId,
      });
      break;
    }

    case "CONTENT":
      break;

    default:
      throw new Error(`Unsupported slide type: ${slide.type}`);
  }

  await syncer.broadcastSlideAnalytics(sessionId, slideId, slide.type);

  return { success: true };
};
