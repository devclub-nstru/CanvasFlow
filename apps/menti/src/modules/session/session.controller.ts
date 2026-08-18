import type { Request, Response } from "express";
import { sessionService } from "./session.service.js";
import { createSessionSchema, joinSessionSchema } from "./session.schemas.js";

class SessionController {
  async createSession(req: Request, res: Response): Promise<void> {
    try {
      const validated = createSessionSchema.parse({ body: req.body });
      const session = await sessionService.createSession((req as any).user._id, validated.body.presentationId);
      res.status(201).json(session);
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation Error", details: error.errors });
        return;
      }
      if (error.message.includes("unauthorized")) {
        res.status(403).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async joinSession(req: Request, res: Response): Promise<void> {
    try {
      const validated = joinSessionSchema.parse({ params: req.params, body: req.body });
      const joinData = await sessionService.joinSession(validated.params.code, validated.body.nickname);
      res.status(200).json(joinData);
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation Error", details: error.errors });
        return;
      }
      if (error.message === "Session not found") {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message.includes("not active")) {
        res.status(403).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async joinActiveSession(req: Request, res: Response): Promise<void> {
    try {
      const { presentationId } = req.params as { presentationId: string };
      const { nickname } = (req.body as any) || {};
      const joinData = await sessionService.joinActiveSessionByPresentationId(presentationId, nickname || "Participant");
      res.status(200).json(joinData);
    } catch (error: any) {
      if (error.message.includes("No active session")) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }
}

export const sessionController = new SessionController();
