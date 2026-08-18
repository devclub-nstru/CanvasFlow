import type { Request, Response, NextFunction } from "express";
import axios from "axios";
import { User } from "../database/models/index.js";
import env from "../../env.js";

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cookie = req.headers.cookie;
    const authHeader = req.headers.authorization;

    if (!cookie && !authHeader) {
      res.status(401).json({ error: "Unauthorized: No credentials provided" });
      return;
    }

    const response = await axios.get(`${env.BETTER_AUTH_URL}/api/auth/get-session`, {
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      timeout: 5000,
    });

    const sessionData = response.data;
    if (!sessionData || !sessionData.session || !sessionData.user) {
      res.status(401).json({ error: "Unauthorized: Invalid session" });
      return;
    }

    const externalUser = sessionData.user;
    let localUser = await User.findOne({ externalId: externalUser.id });

    if (!localUser) {
      localUser = await User.create({
        externalId: externalUser.id,
        name: externalUser.name || externalUser.email || "Unknown User",
      });
    }

    (req as any).user = localUser;
    next();
  } catch (error: any) {
    console.error("Auth Middleware Error:", error?.response?.data || error.message);
    res.status(401).json({ error: "Unauthorized" });
  }
};
