import env, { isProduction } from "./env.js";
import { logger } from "../logger/logger.js";

/* The single place this service decides how a session token is signed.
 *
 * Menti never mints tokens — apps/api does — so the only thing that matters is
 * that both processes resolve the SAME value. That is why the fallback chain
 * here mirrors the API's exactly. It used to end in a hardcoded literal, which
 * meant a deployment that forgot the variable would "work": both services would
 * silently agree on a secret published in the source, and anyone could forge a
 * presenter token. There is no safe default, so production refuses to start.
 */

const DEV_ONLY_SECRET = "canvasflow-development-only-insecure-secret";
const MIN_RECOMMENDED_LENGTH = 32;

let cachedSecret = null;
let warned = false;

export function authSecret() {
  if (cachedSecret) return cachedSecret;

  const configured = (env.JWT_SECRET || env.BETTER_AUTH_SECRET || "").trim();

  if (!configured) {
    if (isProduction) {
      throw new Error(
        "JWT_SECRET (or BETTER_AUTH_SECRET) is not set. Menti verifies the session " +
          "tokens minted by apps/api, so both services must be given the same secret — " +
          "there is no safe default. Generate one with `openssl rand -base64 32`.",
      );
    }

    if (!warned) {
      warned = true;
      logger.warn(
        "JWT_SECRET is not set — using the shared development secret. This matches " +
          "apps/api's development fallback so local sign-in works, but tokens signed " +
          "with it are forgeable. Never run this outside local dev.",
      );
    }

    cachedSecret = DEV_ONLY_SECRET;
    return cachedSecret;
  }

  if (configured.length < MIN_RECOMMENDED_LENGTH && !warned) {
    warned = true;
    logger.warn(
      `the configured signing secret is ${configured.length} characters; ` +
        `${MIN_RECOMMENDED_LENGTH} or more is recommended.`,
    );
  }

  cachedSecret = configured;
  return cachedSecret;
}

/* Called from the boot path so a misconfigured production process dies on
 * startup rather than on the first presenter connection. */
export function assertAuthSecret() {
  authSecret();
}
