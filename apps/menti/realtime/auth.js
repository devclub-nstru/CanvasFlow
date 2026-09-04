import crypto from "node:crypto";
import { Participant, Session, User } from "../src/core/database/models/index.js";
import { extractToken, verifyHS256JWT } from "../src/core/auth/jwt.js";
import { resolveLocalUser } from "../src/core/middleware/auth.js";
import { logger } from "../src/core/logger/logger.js";

/* Participant token → participant doc.
 *
 * This is the single hottest lookup in the system: it runs once per handshake,
 * so a 1000-person room joining at once is 1000 of them within a few seconds.
 * The cache turns a reconnect storm (which is what a flaky venue wifi produces)
 * into memory hits instead of 1000 more indexed Mongo reads.
 */
const participantTokenCache = new Map();
const PARTICIPANT_CACHE_TTL_MS = 60_000;
const PARTICIPANT_CACHE_MAX = 20_000;

function sweep(cache, ttlMs, max) {
  if (cache.size <= max) return;
  const now = Date.now();
  for (const [key, value] of cache) {
    if (now - value.at > ttlMs) cache.delete(key);
  }
  /* Still over budget: the room is genuinely larger than the cache. Drop from
   * the front (oldest inserted) rather than growing without bound. */
  if (cache.size > max) {
    const excess = cache.size - max;
    let dropped = 0;
    for (const key of cache.keys()) {
      cache.delete(key);
      if (++dropped >= excess) break;
    }
  }
}

export function invalidateParticipantToken(tokenHash) {
  participantTokenCache.delete(tokenHash);
}

async function authenticateParticipant(socket, token) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  let participant = null;
  const cached = participantTokenCache.get(tokenHash);

  if (cached && Date.now() - cached.at < PARTICIPANT_CACHE_TTL_MS) {
    participant = cached.participant;
  } else {
    /* tokenHash is `select: false` on the schema, so it is never carried on the
     * cached object — only the fields the realtime layer actually reads. */
    participant = await Participant.findOne({ tokenHash })
      .select("_id sessionId nickname status score")
      .lean();

    if (participant) {
      participantTokenCache.set(tokenHash, { participant, at: Date.now() });
      sweep(participantTokenCache, PARTICIPANT_CACHE_TTL_MS, PARTICIPANT_CACHE_MAX);
    }
  }

  if (!participant || participant.status === "banned") return null;

  socket.participant = participant;
  socket.data = {
    ...(socket.data || {}),
    participant,
    participantId: participant._id.toString(),
    sessionId: participant.sessionId.toString(),
    tokenHash,
    role: "participant",
  };

  return participant;
}

async function authenticateHost(socket, sessionId) {
  const token = extractToken({
    cookie: socket.handshake.headers.cookie,
    authorization: socket.handshake.headers.authorization,
  });

  if (!token) return null;

  const decoded = verifyHS256JWT(token);
  if (!decoded?.id) return null;

  const localUser = await resolveLocalUser(decoded);
  if (!localUser) return null;

  socket.user = localUser;
  socket.data = {
    ...(socket.data || {}),
    user: localUser,
    userId: localUser._id.toString(),
    sessionId: sessionId || null,
    role: "host",
  };

  return localUser;
}

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const { token } = socket.handshake.query;
    const sessionId = socket.handshake.query.sessionId || socket.handshake.auth?.sessionId;

    /* 1. Participant: a per-session bearer token issued by POST /:code/join. */
    if (token) {
      const participant = await authenticateParticipant(socket, token);
      if (!participant) {
        return next(new Error("Authentication error: Invalid or banned participant token"));
      }
      return next();
    }

    /* 2. Host: the same `cf_jwt` session cookie apps/api issues. */
    const user = await authenticateHost(socket, sessionId);
    if (user) return next();

    /* 3. Presenter display fallback: a screen that holds a valid session id but
     * carries no cookie (a projector, a second device opened from the QR card).
     *
     * This grants host privileges on knowledge of the session id alone, so it
     * is restricted to sessions that are actually running — a finished or
     * cancelled session can no longer be driven this way. */
    if (sessionId) {
      const sessionDoc = await Session.findOne({
        _id: sessionId,
        status: { $in: ["waiting", "live", "paused"] },
      })
        .select("_id presenterId")
        .lean();

      if (sessionDoc) {
        const hostUser = sessionDoc.presenterId
          ? await User.findById(sessionDoc.presenterId).select("_id name").lean()
          : null;

        const resolved = hostUser ?? { _id: sessionDoc.presenterId, name: "Presenter" };

        socket.user = resolved;
        socket.data = {
          ...(socket.data || {}),
          user: resolved,
          userId: resolved._id?.toString(),
          sessionId: sessionDoc._id.toString(),
          role: "host",
        };
        return next();
      }
    }

    return next(new Error("Authentication error: No credentials provided"));
  } catch (error) {
    logger.error("socket auth error:", error.message);
    return next(new Error("Authentication error: Internal server error"));
  }
};
