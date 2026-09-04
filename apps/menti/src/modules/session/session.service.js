import crypto from "crypto";
import { sessionRepository } from "./session.repository.js";
import { presentationRepository } from "../presentation/presentation.repository.js";
import { Session, Slide, Response, Participant } from "../../core/database/models/index.js";

export async function wipePresentationSessionData(presentationId) {
  if (!presentationId) return;

  // 1. Wipe all previous responses for this presentation
  await Response.deleteMany({ presentationId });

  // 2. Reset participant scores and quiz session states for all sessions of this presentation
  const sessions = await Session.find({ presentationId }).select("_id").lean();
  const sessionIds = sessions.map((s) => s._id);
  if (sessionIds.length > 0) {
    await Participant.updateMany({ sessionId: { $in: sessionIds } }, { $set: { score: 0 } });
    await Session.updateMany(
      { _id: { $in: sessionIds } },
      { $set: { quizState: null, isVotingLocked: false } }
    );
  }

  // 3. Reset slide options and vote counts for this presentation
  const slides = await Slide.find({ presentationId });
  for (const slide of slides) {
    if (slide.type === "WORD_CLOUD") {
      slide.options = [];
    } else if (slide.options && slide.options.length > 0) {
      slide.options = slide.options.map((opt) => {
        const obj = opt.toObject ? opt.toObject() : { ...opt };
        return {
          ...obj,
          voteCount: 0,
        };
      });
    }
    await slide.save();
  }
}

const generateSessionCode = async () => {
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
  async createSession(ownerId, presentationId) {
    const presentation = await sessionRepository.findPresentationByIdAndOwner(
      presentationId,
      ownerId,
    );
    if (!presentation) {
      throw new Error("Presentation not found or unauthorized");
    }

    let session = await sessionRepository.findActiveSessionByPresentationId(
      presentationId,
      ownerId,
    );

    const slides = await presentationRepository.findSlidesByPresentation(presentationId);
    const firstSlide = slides && slides[0];
    const firstSlideId = firstSlide ? firstSlide._id : null;

    if (!session) {
      const code = await generateSessionCode();

      session = await sessionRepository.createSession({
        presentationId,
        presenterId: ownerId,
        code,
        status: "waiting",
        currentSlideId: firstSlideId,
      });
      await wipePresentationSessionData(presentationId);
    } else {
      if (!session.currentSlideId && firstSlideId) {
        await Session.findByIdAndUpdate(session._id, { $set: { currentSlideId: firstSlideId } });
        session.currentSlideId = firstSlideId;
      }
      if (session.status === "waiting") {
        await wipePresentationSessionData(presentationId);
      }
    }

    return {
      session,
    };
  }

  async joinSession(code, nickname) {
    const session = await sessionRepository.findSessionByCode(
      code.toUpperCase(),
    );
    if (!session) {
      throw new Error("Session not found");
    }

    if (session.status === "cancelled" || session.status === "finished") {
      throw new Error("Session is not active");
    }

    const rawToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

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

  async joinActiveSessionByPresentationId(presentationId, nickname = "Participant") {
    const session = await Session.findOne({
      presentationId,
      status: { $in: ["waiting", "live", "paused"] },
    }).lean();

    if (!session) {
      throw new Error("No active session found for this presentation");
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
}

export const sessionService = new SessionService();
