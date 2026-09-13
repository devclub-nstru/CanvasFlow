import { performance } from "node:perf_hooks";
import { checkSocketRateLimit } from "./rateLimiter.js";
import { logger } from "../src/core/logger/logger.js";

const SLOW_EVENT_MS = 100;

export const createAckWrapper = (socket) => {
  /* Resolved once per socket rather than per event: it cannot change for the
   * life of the connection, and it was previously recomputed on every emit. */
  const identityId =
    socket.data?.userId ||
    socket.data?.participantId ||
    socket.user?._id?.toString() ||
    socket.participant?._id?.toString() ||
    socket.id;

  return (handler) =>
    async (...args) => {
      const started = performance.now();
      const ack = typeof args[args.length - 1] === "function" ? args.pop() : null;

      /* Synchronous — no await, no Redis round-trip in front of the handler. */
      if (!checkSocketRateLimit(identityId)) {
        ack?.({ success: false, error: "Rate limit exceeded. Please slow down." });
        return;
      }

      try {
        const result = await handler(...args);
        ack?.({ success: true, data: result });

        const totalMs = performance.now() - started;
        if (totalMs > SLOW_EVENT_MS) {
          logger.warn(`slow ws event: ${totalMs.toFixed(1)}ms`);
        }
      } catch (error) {
        logger.error("socket handler error:", error.message || error);
        ack?.({ success: false, error: error.message || "Internal Server Error" });
      }
    };
};
