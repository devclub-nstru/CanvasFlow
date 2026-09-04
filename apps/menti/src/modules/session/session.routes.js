import { Router } from "express";
import { sessionController } from "./session.controller.js";
import { requireAuth } from "../../core/middleware/auth.js";


const router = Router();

// --- Presenter Routes (Protected) ---
router.post("/", requireAuth, sessionController.createSession);

// --- Participant Routes (Public) ---
router.post("/:code/join", sessionController.joinSession);
router.post("/join-by-presentation/:presentationId", sessionController.joinActiveSession);

export default router;
