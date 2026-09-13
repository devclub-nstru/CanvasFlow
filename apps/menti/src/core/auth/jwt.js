import crypto from "node:crypto";
import { authSecret } from "../env/secret.js";
import { sharedRedisKey } from "../env/env.js";
import { redis } from "../database/redis.js";
import { logger } from "../logger/logger.js";

/* HS256 verification, shared by the HTTP middleware and the socket handshake.
 * It was previously duplicated in both, which is how they drifted into
 * resolving the signing secret slightly differently. */

export function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;

  for (const part of cookieString.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    cookies[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }

  return cookies;
}

/* apps/api sets `cf_jwt`; the better-auth name is still read so sessions minted
 * before that migration keep working until they expire. */
export function extractToken({ cookie, authorization }) {
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  if (!cookie) return null;

  const cookies = parseCookies(cookie);
  return cookies["cf_jwt"] || cookies["better-auth.session_token"] || null;
}

export function verifyHS256JWT(token, secret = authSecret()) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    /* Constant-time compare. The lengths are equal for any well-formed HS256
     * signature, but a malformed one must not throw out of timingSafeEqual. */
    const a = Buffer.from(signatureB64);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

    if (payload.exp && Date.now() >= payload.exp * 1000) return null;

    return payload;
  } catch {
    return null;
  }
}

/* ── Revocation ────────────────────────────────────────────────────────────
 *
 * apps/api backs each token with a row in Postgres and deletes that row on
 * sign-out. This service verifies the same tokens but has no Postgres access,
 * so without this it would keep honouring a token for the rest of its
 * seven-day life after the user signed out — a presenter who signed out on a
 * shared laptop would still be drivable from it.
 *
 * apps/api therefore also writes a short-lived denylist entry to the Redis
 * both services share, which this checks.
 *
 * On a Redis failure this reports "not revoked". That is a deliberate choice
 * rather than an oversight: the alternative drops every host and participant
 * mid-presentation on a transient Redis blip, and the exposure is bounded to
 * tokens that were explicitly signed out. It is logged so the degradation is
 * visible rather than silent.
 */
export async function isSessionRevoked(sessionId) {
  if (!sessionId) return false;

  try {
    const exists = await redis.exists(sharedRedisKey("auth", "revoked", sessionId));
    return exists === 1;
  } catch (error) {
    logger.error("revocation check failed, treating session as live:", error.message);
    return false;
  }
}
