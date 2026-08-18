import crypto from "crypto";
import axios from "axios";
import type { Socket } from "socket.io";
import { User, Participant } from "../core/database/models/index.js";
import env from "../env.js";

const authCache = new Map<string, { user: any; timestamp: number }>();
const AUTH_CACHE_TTL = 30000;

export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void): Promise<void> => {
  try {
    const { token } = socket.handshake.query as Record<string, string>;
    const cookie = socket.handshake.headers.cookie;
    const authHeader = socket.handshake.headers.authorization;

    if (token) {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const participant = await Participant.findOne({ tokenHash }).lean();

      if (!participant || participant.status === "removed") {
        return next(new Error("Authentication error: Invalid or banned participant token"));
      }

      (socket as any).participant = participant;
      socket.data = {
        ...socket.data,
        participant,
        participantId: participant._id.toString(),
        sessionId: participant.sessionId.toString(),
        role: "participant",
      };
      return next();
    }

    if (cookie || authHeader) {
      const cacheKey = (cookie || authHeader) as string;
      const cached = authCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < AUTH_CACHE_TTL) {
        (socket as any).user = cached.user;
        socket.data = {
          ...socket.data,
          user: cached.user,
          userId: cached.user._id.toString(),
          role: "host",
        };
        return next();
      }

      try {
        const response = await axios.get(`${env.BETTER_AUTH_URL}/api/auth/get-session`, {
          headers: {
            ...(cookie ? { cookie } : {}),
            ...(authHeader ? { authorization: authHeader } : {}),
          },
          timeout: 5000,
        });

        const sessionData = response.data;
        if (!sessionData || !sessionData.session || !sessionData.user) {
          return next(new Error("Authentication error: Invalid Better Auth session"));
        }

        const externalUser = sessionData.user;
        let localUser = await User.findOne({ externalId: externalUser.id });

        if (!localUser) {
          localUser = await User.create({
            externalId: externalUser.id,
            name: externalUser.name || externalUser.email || "Unknown User",
          });
        }

        authCache.set(cacheKey, { user: localUser, timestamp: Date.now() });

        if (authCache.size > 500) {
          const now = Date.now();
          for (const [k, v] of authCache.entries()) {
            if (now - v.timestamp > AUTH_CACHE_TTL) authCache.delete(k);
          }
        }

        (socket as any).user = localUser;
        socket.data = {
          ...socket.data,
          user: localUser,
          userId: localUser._id.toString(),
          role: "host",
        };
        return next();
      } catch (authErr: any) {
        console.error("Better Auth validation error:", authErr.message);
        return next(new Error("Authentication error: Better Auth validation failed"));
      }
    }

    return next(new Error("Authentication error: No credentials provided"));
  } catch (error) {
    console.error("Socket Auth Error:", error);
    return next(new Error("Authentication error: Internal server error"));
  }
};
