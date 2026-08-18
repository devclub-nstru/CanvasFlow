import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { socketAuthMiddleware } from "./auth.js";
import { createAckWrapper } from "./utils.js";
import { handleConnection, handleDisconnection } from "./handlers/connectionHandlers.js";
import {
  handleSessionStatusChange,
  handleSlideChange,
  handleStartQuestion,
  handleToggleVotingLock,
} from "./handlers/hostHandlers.js";
import { handleSubmitResponse } from "./handlers/participantHandlers.js";
import env from "../env.js";

let io: Server;

export const initRealtimeServer = (httpServer: HttpServer): Server => {
  const allowedOrigins = (env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", async (socket) => {
    const withAck = createAckWrapper(socket);

    await handleConnection(socket);

    socket.on("change_session_status", withAck((data) => handleSessionStatusChange(socket, data)));
    socket.on("change_slide", withAck((data) => handleSlideChange(socket, data)));
    socket.on("toggle_voting_lock", withAck((data) => handleToggleVotingLock(socket, data)));
    socket.on("start_question", withAck(() => handleStartQuestion(socket)));
    socket.on("submit_response", withAck((data) => handleSubmitResponse(socket, data)));

    socket.on(
      "ping",
      withAck(async (data: any) => {
        if (data?.fail) throw new Error("You asked me to fail!");
        return { pong: true, received: data };
      }),
    );

    socket.on("disconnect", async () => {
      await handleDisconnection(socket);
    });
  });

  return io;
};

export const getIo = (): Server => {
  if (!io) throw new Error("Socket.io has not been initialized!");
  return io;
};
