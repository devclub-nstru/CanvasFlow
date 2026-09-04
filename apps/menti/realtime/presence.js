import { Participant } from "../src/core/database/models/index.js";
import { redis } from "../src/core/database/redis.js";
import { redisKey } from "../src/core/env/env.js";
import { logger } from "../src/core/logger/logger.js";

/* Presence and participant bookkeeping for large rooms.
 *
 * Two things used to happen on *every* connect and disconnect:
 *
 *   1. A `Participant.findByIdAndUpdate` — one Mongo write per socket. A
 *      1000-person room opening the join link at the end of a slide produced a
 *      1000-write burst, and the same again on a wifi blip.
 *   2. A participant count derived from `io.sockets.adapter.rooms.get(room).size`,
 *      which only ever sees sockets attached to the local process. Correct for
 *      one process, silently wrong the moment a second replica exists.
 *
 * Writes are now coalesced into bulkWrite batches, and the count is kept in a
 * Redis set of participant ids — O(1) to read, accurate across processes, and
 * naturally idempotent when a participant reconnects.
 */

const FLUSH_INTERVAL_MS = 250;
const FLUSH_MAX_BATCH = 500;

/* Long enough to outlive any real session, short enough that a process killed
 * mid-session cannot leak a stale set forever. Refreshed on every write. */
const PRESENCE_TTL_SECONDS = 12 * 60 * 60;

const presenceKey = (sessionId) => redisKey("presence", sessionId.toString());

/* participantId -> pending $set fields. Keyed by id so a connect immediately
 * followed by a disconnect collapses to the final state instead of two writes. */
const pending = new Map();
let flushTimer = null;

async function flush() {
  flushTimer = null;
  if (pending.size === 0) return;

  const batch = [...pending.entries()].slice(0, FLUSH_MAX_BATCH);
  for (const [id] of batch) pending.delete(id);

  try {
    await Participant.bulkWrite(
      batch.map(([participantId, set]) => ({
        updateOne: { filter: { _id: participantId }, update: { $set: set } },
      })),
      /* Order does not matter — each op targets a distinct document — and
       * unordered lets the driver pipeline them. */
      { ordered: false },
    );
  } catch (error) {
    logger.error("participant bulk write failed:", error.message);
  }

  if (pending.size > 0) schedule();
}

function schedule() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    void flush();
  }, FLUSH_INTERVAL_MS);
  /* Never hold the process open for a pending presence flush. */
  flushTimer.unref?.();
}

function queueParticipantUpdate(participantId, set) {
  const key = participantId.toString();
  pending.set(key, { ...(pending.get(key) || {}), ...set });

  if (pending.size >= FLUSH_MAX_BATCH) {
    void flush();
    return;
  }
  schedule();
}

export async function markParticipantOnline(sessionId, participantId, socketId) {
  queueParticipantUpdate(participantId, {
    status: "active",
    socketId,
    lastSeenAt: new Date(),
  });

  try {
    const key = presenceKey(sessionId);
    await redis
      .multi()
      .sadd(key, participantId.toString())
      .expire(key, PRESENCE_TTL_SECONDS)
      .exec();
  } catch (error) {
    logger.error("presence add failed:", error.message);
  }
}

export async function markParticipantOffline(sessionId, participantId) {
  queueParticipantUpdate(participantId, {
    status: "disconnected",
    disconnectedAt: new Date(),
  });

  try {
    await redis.srem(presenceKey(sessionId), participantId.toString());
  } catch (error) {
    logger.error("presence remove failed:", error.message);
  }
}

export async function getParticipantCount(sessionId) {
  try {
    return await redis.scard(presenceKey(sessionId));
  } catch (error) {
    logger.error("presence count failed:", error.message);
    return 0;
  }
}

/* Called when a session ends so the set does not sit in Redis until its TTL. */
export async function clearPresence(sessionId) {
  try {
    await redis.del(presenceKey(sessionId));
  } catch (error) {
    logger.error("presence clear failed:", error.message);
  }
}

/* Drains anything still buffered. Called on shutdown so a deploy does not lose
 * the final disconnect batch. */
export async function flushPresence() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  while (pending.size > 0) await flush();
}
