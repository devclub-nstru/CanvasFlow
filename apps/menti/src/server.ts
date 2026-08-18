import express from "express";
import cors from "cors";
import morgan from "morgan";
import env from "./env.js";

import presentationRoutes from "./modules/presentation/presentation.routes.js";
import sessionRoutes from "./modules/session/session.routes.js";
import healthRoutes from "./modules/health/health.routes.js";

export const app = express();

const allowedOrigins = (env.TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "200kb" }));
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({ message: "CanvasFlow Menti server is running" });
});

app.use("/health", healthRoutes);
app.use("/api/presentations", presentationRoutes);
app.use("/api/sessions", sessionRoutes);

app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[menti] unhandled error:", err instanceof Error ? err.stack : err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default app;
