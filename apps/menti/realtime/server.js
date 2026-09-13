import { Server } from "socket.io";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { createAdapter } from "@socket.io/redis-adapter";

import env, { isProduction } from "../src/core/env/env.js";
import { createSubscriber, redis } from "../src/core/database/redis.js";
import { logger } from "../src/core/logger/logger.js";
import { Session } from "../src/core/database/models/index.js";
import { socketAuthMiddleware } from "./auth.js";
import { createAckWrapper } from "./utils.js";
import { subscribeToCacheInvalidation } from "./cache.js";
import { IMPORT_PROGRESS_CHANNEL } from "../src/core/keys.js";
import { handleConnection, handleDisconnection } from "./handlers/connectionHandlers.js";
import {
  handleSessionStatusChange,
  handleSlideChange,
  handleToggleVotingLock,
} from "./handlers/hostHandlers.js";
import { handleSubmitResponse } from "./handlers/participantHandlers.js";

/* Event-loop monitoring is genuinely useful under load but it is not free, and
 * it used to log unconditionally every 5 seconds forever. It now runs only when
 * asked for, which is what you want when profiling a 1000-participant room. */
function startEventLoopMonitor() {
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();

  const timer = setInterval(() => {
    const p99 = (Number(histogram.percentile(99)) / 1e6).toFixed(2);
    const max = (Number(histogram.max) / 1e6).toFixed(2);
    const mean = (Number(histogram.mean) / 1e6).toFixed(2);
    const mem = process.memoryUsage();

    logger.info(
      `event loop p99: ${p99}ms | max: ${max}ms | mean: ${mean}ms | ` +
        `heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB | rss: ${(mem.rss / 1024 / 1024).toFixed(1)}MB`,
    );
    histogram.reset();
  }, 5000);

  timer.unref();
  return timer;
}

function buildCorsOrigin() {
  const configured = [
    env.WEB_URL,
    ...(env.MENTI_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ].filter(Boolean);

  /* Development convenience only. In production the allow-list is exactly what
   * the environment declares — the previous hardcoded production hostnames
   * meant this service trusted origins the rest of the monorepo did not. */
  const origins = isProduction
    ? configured
    : [...configured, "http://localhost:3000", "http://localhost:3001"];

  const allowed = new Set(origins);

  return (origin, callback) => {
    // Same-origin, curl, and native clients send no Origin header.
    if (!origin) return callback(null, true);
    if (allowed.has(origin)) return callback(null, true);

    logger.warn(`rejected socket origin: ${origin}`);
    return callback(new Error(`CORS: Origin ${origin} not allowed`));
  };
}

let io;

export const initRealtimeServer = async (httpServer) => {
  io = new Server(httpServer, {
    transports: ["websocket", "polling"],
    pingTimeout: 20000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6,
    connectTimeout: 20000,
    cors: {
      origin: buildCorsOrigin(),
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  /* Lets the service run as more than one process: rooms, broadcasts, and
   * disconnects are relayed between replicas over Redis. Scaling out also
   * requires sticky sessions at the proxy, because a handshake that starts on
   * one replica must finish there. */
  const pubClient = redis.duplicate();
  const subClient = createSubscriber("socket-adapter");
  io.adapter(createAdapter(pubClient, subClient));

  subscribeToCacheInvalidation();

  io.use(socketAuthMiddleware);

  const importProgress = createSubscriber("import-progress");
  importProgress.subscribe(IMPORT_PROGRESS_CHANNEL).catch((err) => {
    logger.error("failed to subscribe to import:progress:", err.message);
  });

  importProgress.on("message", async (channel, message) => {
    if (channel !== IMPORT_PROGRESS_CHANNEL) return;

    try {
      const data = JSON.parse(message);
      const payload = {
        importId: data.importId,
        status: data.status,
        processedSlides: data.processedSlides,
        totalSlides: data.totalSlides,
        errorInfo: data.errorInfo || null,
      };

      io.to(`user_${data.userId}`).emit("import:progress", payload);

      const sessions = await Session.find({
        presentationId: data.presentationId,
        status: { $in: ["waiting", "live", "paused"] },
      })
        .select("_id")
        .lean();

      for (const session of sessions) {
        io.to(`session_${session._id}_host`).emit("import:progress", payload);
      }
    } catch (err) {
      logger.error("import progress event failed:", err.message);
    }
  });

  io.on("connection", async (socket) => {
    const withAck = createAckWrapper(socket);

    await handleConnection(socket);

    socket.on("change_session_status", withAck((data) => handleSessionStatusChange(socket, data)));
    socket.on("change_slide", withAck((data) => handleSlideChange(socket, data)));
    socket.on("toggle_voting_lock", withAck((data) => handleToggleVotingLock(socket, data)));

    socket.on("submit_response", withAck((data) => handleSubmitResponse(socket, data)));

    socket.on(
      "ping",
      withAck(async (data) => {
        if (data?.fail) throw new Error("You asked me to fail!");
        return { pong: true, received: data };
      }),
    );

    socket.on("disconnect", async () => {
      await handleDisconnection(socket);
    });
  });

  if (env.MENTI_LOG_LEVEL === "debug" || process.env.MENTI_EVENT_LOOP_MONITOR === "1") {
    startEventLoopMonitor();
  }

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }
  return io;
};

export const closeRealtimeServer = async () => {
  if (!io) return;
  await io.close();
};
