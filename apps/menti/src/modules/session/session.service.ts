import crypto from "crypto";
import { Types } from "mongoose";
import { sessionRepository } from "./session.repository.js";
import { presentationRepository } from "../presentation/presentation.repository.js";
import { Session, Slide, Response } from "../../core/database/models/index.js";
import { wordCloudStore } from "../../realtime/wordCloudStore.js";

export async function wipePresentationSessionData(presentationId: string | Types.ObjectId): Promise<void> {
  if (!presentationId) return;

  await Response.deleteMany({ presentationId });

  const slides = await Slide.find({ presentationId });

  // Drop cached word counts so the cloud restarts empty rather than
  // re-serving the deleted responses from memory.
  wordCloudStore.resetMany(slides.map((slide) => slide._id));

  for (const slide of slides) {
    if (slide.type === "WORD_CLOUD") {
      slide.options = [];
    } else if (slide.options && slide.options.length > 0) {
      slide.options = slide.options.map((opt) => ({
        ...opt,
        voteCount: 0,
      })) as any;
    }
    await slide.save();
  }
}

const generateSessionCode = async (): Promise<string> => {
  const chars = "0123456789";
  let code = "";
  let exists = true;

  while (exists) {
    code = "";
    for (let i = 0; i < 6; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      code += chars[randomIndex];
    }
    exists = await sessionRepository.checkCodeExists(code);
  }

  return code;
};

class SessionService {
  async createSession(ownerId: Types.ObjectId, presentationId: string) {
    const presentation = await sessionRepository.findPresentationByIdAndOwner(presentationId, ownerId);
    if (!presentation) throw new Error("Presentation not found or unauthorized");

    let session = await sessionRepository.findActiveSessionByPresentationId(presentationId, ownerId);

    const slides = await presentationRepository.findSlidesByPresentation(presentationId);
    const firstSlide = slides && slides[0];
    const firstSlideId = firstSlide ? firstSlide._id : null;

    if (!session) {
      const code = await generateSessionCode();
      const newSession = await sessionRepository.createSession({
        presentationId,
        presenterId: ownerId,
        code,
        status: "waiting",
        currentSlideId: firstSlideId,
      });
      await wipePresentationSessionData(presentationId);
      return { session: newSession };
    } else {
      if (!session.currentSlideId && firstSlideId) {
        await Session.findByIdAndUpdate(session._id, { $set: { currentSlideId: firstSlideId } });
        session = { ...session, currentSlideId: firstSlideId as any };
      }
      if (session.status === "waiting") {
        await wipePresentationSessionData(presentationId);
      }
    }

    return { session };
  }

  async joinSession(code: string, nickname: string) {
    const session = await sessionRepository.findSessionByCode(code.toUpperCase());
    if (!session) throw new Error("Session not found");

    if (session.status === "cancelled" || session.status === "finished") {
      throw new Error("Session is not active");
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const participant = await sessionRepository.createParticipant({
      sessionId: session._id,
      nickname,
      tokenHash,
      status: "active",
    });

    return {
      participantToken: rawToken,
      participantId: participant._id,
      session: {
        id: session._id,
        presentationId: session.presentationId,
        status: session.status,
      },
    };
  }

  async joinActiveSessionByPresentationId(presentationId: string, nickname = "Participant") {
    const session = await Session.findOne({
      presentationId,
      status: { $in: ["waiting", "live", "paused"] },
    }).lean();

    if (!session) throw new Error("No active session found for this presentation");

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const participant = await sessionRepository.createParticipant({
      sessionId: session._id,
      nickname,
      tokenHash,
      status: "active",
    });

    return {
      participantToken: rawToken,
      participantId: participant._id,
      session: {
        id: session._id,
        presentationId: session.presentationId,
        status: session.status,
      },
    };
  }
}

export const sessionService = new SessionService();
