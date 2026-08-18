import { Router } from "express";
import { sessionController } from "./session.controller.js";
import { requireAuth } from "../../core/middleware/auth.js";

const router = Router();

router.post("/", requireAuth, (req, res) => sessionController.createSession(req, res));
// specific routes before parameterized ones to avoid route conflicts
router.post("/join-by-presentation/:presentationId", (req, res) => sessionController.joinActiveSession(req, res));
router.post("/:code/join", (req, res) => sessionController.joinSession(req, res));

export default router;
