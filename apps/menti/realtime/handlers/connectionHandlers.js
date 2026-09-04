import { syncer } from "../syncer.js";
import { getCachedSession, getCachedSlide } from "../cache.js";
import { markParticipantOnline, markParticipantOffline } from "../presence.js";
import { forgetRateLimitIdentity } from "../rateLimiter.js";
import { logger } from "../../src/core/logger/logger.js";

export const handleConnection = async (socket) => {
  let sessionId;

  try {
    if (socket.participant) {
      sessionId = socket.participant.sessionId;

      /* Queued into a bulk batch rather than written immediately — see
       * presence.js. A 1000-person room joining at once is one batched write
       * every 250ms instead of 1000 individual ones. */
      await markParticipantOnline(sessionId, socket.participant._id, socket.id);

      if (logger.isDebug()) {
        logger.debug(`participant ${socket.participant._id} joined session ${sessionId}`);
      }
    } else if (socket.user || socket.data?.role === "host") {
      sessionId = socket.data?.sessionId || socket.handshake.query?.sessionId;

      if (socket.user?._id) {
        socket.join(`user_${socket.user._id.toString()}`);
      }
    }

    if (!sessionId) return;

    const roomName = `session_${sessionId}`;
    socket.join(roomName);

    const isHost = Boolean(socket.user || socket.data?.role === "host");
    if (isHost) {
      // Exclusive room for host-only payloads
      socket.join(`${roomName}_host`);
    }

    socket.sessionId = sessionId;

    // Immediately send full state payload ONLY to the connected socket
    await syncer.sendStateToSocket(socket, sessionId);

    if (isHost) {
      const session = await getCachedSession(sessionId);
      if (session?.currentSlideId) {
        const slide = await getCachedSlide(session.currentSlideId);
        if (slide) {
          await syncer.broadcastSlideAnalytics(sessionId, session.currentSlideId, slide.type, true);
        }
      }
    }

    /* Debounced, so a burst of joins collapses into roughly four broadcasts a
     * second no matter how many arrive. */
    await syncer.broadcastState(sessionId);
  } catch (error) {
    logger.error("connection error:", error.message);
    socket.emit("error", { message: error.message });
    socket.disconnect();
  }
};

export const handleDisconnection = async (socket) => {
  try {
    const identityId =
      socket.data?.userId || socket.data?.participantId || socket.id;
    forgetRateLimitIdentity(identityId);

    if (!socket.sessionId) return;

    if (socket.participant) {
      await markParticipantOffline(socket.sessionId, socket.participant._id);
    }

    await syncer.broadcastState(socket.sessionId);
  } catch (error) {
    logger.error("disconnect error:", error.message);
  }
};
