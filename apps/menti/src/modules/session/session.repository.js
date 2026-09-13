import { Session, Participant, Presentation } from "../../core/database/models/index.js";

class SessionRepository {
  async findPresentationByIdAndOwner(presentationId, ownerId) {
    return Presentation.findOne({ _id: presentationId, ownerId }).lean();
  }

  async checkCodeExists(code) {
    const session = await Session.findOne({ code }).select("_id").lean();
    return !!session;
  }

  async createSession(data) {
    return Session.create(data);
  }

  async findSessionByCode(code) {
    return Session.findOne({ code }).lean();
  }

  async findActiveSessionByPresentationId(presentationId, ownerId) {
    return Session.findOne({
      presentationId,
      presenterId: ownerId,
      status: { $in: ["waiting", "live", "paused"] },
    }).lean();
  }

  async createParticipant(data) {
    return Participant.create(data);
  }
}

export const sessionRepository = new SessionRepository();
