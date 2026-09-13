import { Session, Slide } from "../src/core/database/models/index.js";
import { redis, createSubscriber } from "../src/core/database/redis.js";
import { redisKey } from "../src/core/env/env.js";
import { logger } from "../src/core/logger/logger.js";

/* Short-lived read caches for the two documents the realtime layer reads on
 * nearly every event.
 *
 * Invalidation is published to Redis so every process drops the entry, not just
 * the one that made the change. The publish existed before; nothing subscribed
 * to it, so a second replica would have served stale sessions for up to 5s —
 * long enough for participants on one process to keep voting on the previous
 * slide after the host advanced.
 */

const CHANNEL = redisKey("cache", "invalidate");

const sessionCache = new Map();
const slideCache = new Map();
const TTL_SESSION_MS = 5000;
const TTL_SLIDE_MS = 10000;

export async function getCachedSession(sessionId) {
  if (!sessionId) return null;
  const key = sessionId.toString();

  const cached = sessionCache.get(key);
  if (cached && Date.now() - cached.timestamp < TTL_SESSION_MS) return cached.data;

  const session = await Session.findById(sessionId).lean();
  if (session) sessionCache.set(key, { data: session, timestamp: Date.now() });

  return session;
}

export async function getCachedSlide(slideId) {
  if (!slideId) return null;
  const key = slideId.toString();

  const cached = slideCache.get(key);
  if (cached && Date.now() - cached.timestamp < TTL_SLIDE_MS) return cached.data;

  const slide = await Slide.findById(slideId).lean();
  if (slide) slideCache.set(key, { data: slide, timestamp: Date.now() });

  return slide;
}

/* Other layers keep their own derived caches (the syncer's shared base-state
 * snapshot, for one) that must drop at the same moment as the documents they
 * were built from. They register here rather than being imported, which would
 * make this module and the syncer circular. */
const listeners = new Set();

export function onInvalidate(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(type, id) {
  for (const listener of listeners) {
    try {
      listener(type, id);
    } catch (err) {
      logger.error("cache invalidation listener failed:", err.message);
    }
  }
}

function publishInvalidation(type, id) {
  redis
    .publish(CHANNEL, JSON.stringify({ type, id }))
    .catch((err) => logger.error("cache invalidation publish failed:", err.message));
}

export function invalidateCachedSession(sessionId) {
  if (!sessionId) return;
  const key = sessionId.toString();
  sessionCache.delete(key);
  notifyListeners("session", key);
  publishInvalidation("session", key);
}

export function invalidateCachedSlide(slideId) {
  if (!slideId) return;
  const key = slideId.toString();
  slideCache.delete(key);
  notifyListeners("slide", key);
  publishInvalidation("slide", key);
}

/* Wired up from the realtime server at boot. */
export function subscribeToCacheInvalidation() {
  const subscriber = createSubscriber("cache-invalidate");

  subscriber.subscribe(CHANNEL).catch((err) => {
    logger.error("could not subscribe to cache invalidation:", err.message);
  });

  subscriber.on("message", (channel, message) => {
    if (channel !== CHANNEL) return;

    try {
      const { type, id } = JSON.parse(message);
      if (type === "session") sessionCache.delete(id);
      else if (type === "slide") slideCache.delete(id);
      notifyListeners(type, id);
    } catch (err) {
      logger.error("bad cache invalidation message:", err.message);
    }
  });

  return subscriber;
}
