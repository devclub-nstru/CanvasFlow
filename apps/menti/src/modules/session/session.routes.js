import { Router } from "express";
import { sessionController } from "./session.controller.js";
import { requireAuth } from "../../core/middleware/auth.js";
import { rateLimitMiddleware } from "../../core/middleware/rateLimiter.js";

const router = Router();

/* The join routes are public, unauthenticated, and each call creates a
 * Participant document and issues a bearer token. The rate limiter had been
 * written but never imported anywhere in the app, so these were completely
 * unmetered: one script could fill a session — and the collection — with
 * arbitrarily many participants.
 *
 * Keyed on the peer address, since a joiner has no identity yet by definition.
 * The budget is deliberately generous: a lecture hall arriving through one
 * NAT is the normal case, and a real person retries a join a handful of times
 * at most. Capacity 20 with a 5/second leak absorbs that burst while still
 * bounding a script to roughly five joins a second from one address.
 */
const joinLimiter = rateLimitMiddleware({
  keyGenerator: (req) => req.ip,
  action: "session_join",
  capacity: 20,
  leakRate: 5,
});

// --- Presenter Routes (Protected) ---
router.post("/", requireAuth, sessionController.createSession);

// --- Participant Routes (Public) ---
router.post("/:code/join", joinLimiter, sessionController.joinSession);
router.post(
  "/join-by-presentation/:presentationId",
  joinLimiter,
  sessionController.joinActiveSession,
);

export default router;
