import type { Socket } from "socket.io";
import { Participant, Session, Slide } from "../../core/database/models/index.js";
import { syncer } from "../syncer.js";

export const handleConnection = async (socket: Socket): Promise<void> => {
  let sessionId: string | undefined;

  try {
    const participant = (socket as any).participant;
    const user = (socket as any).user;

    if (participant) {
      sessionId = participant.sessionId.toString();

      await Participant.findByIdAndUpdate(participant._id, {
        $set: {
          status: "active",
          socketId: socket.id,
          lastSeenAt: new Date(),
        },
      });
    } else if (user) {
      sessionId = socket.handshake.query["sessionId"] as string | undefined;
      if (!sessionId) {
        throw new Error("Missing sessionId in query for presenter connection");
      }

      const session = await Session.findOne({
        _id: sessionId,
        presenterId: user._id,
      }).lean();
      if (!session) {
        throw new Error("Unauthorized: You are not the presenter of this session");
      }
    }

    if (!sessionId) throw new Error("Could not determine sessionId");

    const roomName = `session_${sessionId}`;
    socket.join(roomName);

    if (user) {
      socket.join(`${roomName}_host`);
    }

    (socket as any).sessionId = sessionId;

    await syncer.sendStateToSocket(socket, sessionId);

    if (user) {
      const activeSession = await Session.findById(sessionId).select("currentSlideId").lean();
      if (activeSession?.currentSlideId) {
        const slide = await Slide.findById(activeSession.currentSlideId).select("type").lean();
        if (slide) {
          await syncer.broadcastSlideAnalytics(sessionId, activeSession.currentSlideId.toString(), slide.type, true);
        }
      }
    }

    await syncer.broadcastState(sessionId);
  } catch (error: any) {
    console.error("[WS] Connection Error:", error.message);
    socket.emit("error", { message: error.message });
    socket.disconnect();
  }
};

export const handleDisconnection = async (socket: Socket): Promise<void> => {
  try {
    const sessionId = (socket as any).sessionId;
    if (!sessionId) return;

    const participant = (socket as any).participant;
    if (participant) {
      await Participant.findByIdAndUpdate(participant._id, {
        $set: {
          status: "disconnected",
          disconnectedAt: new Date(),
        },
      });
    }

    await syncer.broadcastState(sessionId);
  } catch (error: any) {
    console.error("[WS] Disconnect Error:", error.message);
  }
};
