import { User } from "../database/models/index.js";
import { extractToken, verifyHS256JWT, isSessionRevoked } from "../auth/jwt.js";
import { logger } from "../logger/logger.js";

/* Maps an apps/api session (an `externalId`) onto the local Mongo User doc.
 *
 * The lookup is cached because it used to run on every authenticated request:
 * a presenter driving a live session issues a steady stream of them, and each
 * one was a findOne plus, on a cold user, an insert. The cache is keyed by
 * externalId and holds only the local _id and name. */
const userCache = new Map();
const USER_CACHE_TTL_MS = 60_000;
const USER_CACHE_MAX = 5_000;

async function resolveLocalUser(decoded) {
  const cached = userCache.get(decoded.id);
  if (cached && Date.now() - cached.at < USER_CACHE_TTL_MS) return cached.user;

  /* Upsert rather than find-then-create: two concurrent requests from the same
   * new presenter would otherwise race and one would fail the unique index on
   * externalId. */
  const user = await User.findOneAndUpdate(
    { externalId: decoded.id },
    { $setOnInsert: { externalId: decoded.id, name: decoded.name || decoded.email || "Unknown User" } },
    { new: true, upsert: true },
  ).lean();

  if (userCache.size > USER_CACHE_MAX) {
    const now = Date.now();
    for (const [key, value] of userCache) {
      if (now - value.at > USER_CACHE_TTL_MS) userCache.delete(key);
    }
  }

  userCache.set(decoded.id, { user, at: Date.now() });
  return user;
}

export const requireAuth = async (req, res, next) => {
  try {
    const token = extractToken({
      cookie: req.headers.cookie,
      authorization: req.headers.authorization,
    });

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No credentials provided" });
    }

    const decoded = verifyHS256JWT(token);
    if (!decoded?.id) {
      return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }

    /* A signature that still verifies does not mean the session still exists —
     * apps/api may have revoked it. See isSessionRevoked. */
    if (await isSessionRevoked(decoded.sid)) {
      return res.status(401).json({ error: "Unauthorized: Session has ended" });
    }

    const localUser = await resolveLocalUser(decoded);
    if (!localUser) {
      return res.status(500).json({ error: "Could not resolve the authenticated user" });
    }

    req.user = localUser;
    req.auth = {
      user: { id: decoded.id, email: decoded.email, name: decoded.name },
      session: { id: decoded.id, userId: decoded.id },
    };

    return next();
  } catch (error) {
    logger.error("auth middleware failed:", error.message);
    return res.status(500).json({ error: "Internal server error in authentication middleware" });
  }
};

/* Exposed so the socket handshake resolves users through exactly the same path
 * and cache as HTTP requests. */
export { resolveLocalUser };
