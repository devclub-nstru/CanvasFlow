import { Types } from "mongoose";
import { Session, Participant, Presentation } from "../../core/database/models/index.js";

class SessionRepository {
  async findPresentationByIdAndOwner(presentationId: string, ownerId: Types.ObjectId) {
    return Presentation.findOne({ _id: presentationId, ownerId }).lean();
  }

  async checkCodeExists(code: string): Promise<boolean> {
    const session = await Session.findOne({ code }).select("_id").lean();
    return !!session;
  }

  async createSession(data: Record<string, unknown>) {
    return Session.create(data);
  }

  async findSessionByCode(code: string) {
    return Session.findOne({ code }).lean();
  }

  async findActiveSessionByPresentationId(presentationId: string, ownerId: Types.ObjectId) {
    return Session.findOne({
      presentationId,
      presenterId: ownerId,
      status: { $in: ["waiting", "live", "paused"] },
    }).lean();
  }

  async createParticipant(data: Record<string, unknown>) {
    return Participant.create(data);
  }
}

export const sessionRepository = new SessionRepository();
