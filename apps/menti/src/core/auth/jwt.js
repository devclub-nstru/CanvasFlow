import crypto from "node:crypto";
import { authSecret } from "../env/secret.js";

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
