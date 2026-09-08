import { sessionService } from "./session.service.js";
import { createSessionSchema, joinSessionSchema } from "./session.schemas.js";

class SessionController {
  async createSession(req, res) {
    try {
      const validated = createSessionSchema.parse({ body: req.body });
      const session = await sessionService.createSession(req.user._id, validated.body.presentationId);
      res.status(201).json(session);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Validation Error", details: error.errors });
      }
      if (error.message.includes("unauthorized")) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async joinSession(req, res) {
    try {
      const validated = joinSessionSchema.parse({ params: req.params, body: req.body });
      const joinData = await sessionService.joinSession(validated.params.code, validated.body.nickname);
      res.status(200).json(joinData);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Validation Error", details: error.errors });
      }
      if (error.message === "Session not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes("not active") || error.message.includes("anonymous")) {
        return res.status(403).json({ error: error.message });
      }
      /* 409, not 500: the request was well-formed and the session exists — it
       * simply has no room. A 500 would read as a bug the joiner could retry
       * past. */
      if (error.code === "SESSION_FULL") {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async joinActiveSession(req, res) {
    try {
      const { presentationId } = req.params;
      const { nickname } = req.body || {};
      const joinData = await sessionService.joinActiveSessionByPresentationId(presentationId, nickname || "Participant");
      res.status(200).json(joinData);
    } catch (error) {
      if (error.message.includes("No active session")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.code === "SESSION_FULL") {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }
}

export const sessionController = new SessionController();
