import http from "http";
import { app } from "./server.js";
import { initRealtimeServer } from "./realtime/server.js";
import { connectMongo } from "./core/database/connect.js";
import env from "./env.js";

const PORT = parseInt(env.PORT, 10) || 4080;

const server = http.createServer(app);

initRealtimeServer(server);

const [_connection, error] = await connectMongo(env.MONGO_URI);

if (error) {
  console.error("MongoDB connection failed:", error);
  process.exit(1);
}

console.log("MongoDB connected");

server.listen(PORT, () => {
  console.log(`[menti] server running at http://localhost:${PORT}`);
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received — shutting down menti server...`);
  server.close(() => {
    console.log("[menti] server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
