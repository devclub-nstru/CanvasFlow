import os from "node:os";
import mongoose from "mongoose";
import { redis } from "../../core/database/redis.js";
import { getIo } from "../../../realtime/server.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

// ─── Individual checks ──────────────────────────────────────────────────────

async function checkMongo() {
  const start = Date.now();
  try {
    const state = mongoose.connection.readyState;
    // 0 = disconnected | 1 = connected | 2 = connecting | 3 = disconnecting
    const stateMap = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
    const stateName = stateMap[state] ?? "unknown";

    if (state !== 1) {
      return { status: "unhealthy", state: stateName, latency_ms: null };
    }

    // Issue a lightweight admin ping to measure actual round-trip latency
    await mongoose.connection.db.admin().ping();
    const latency = Date.now() - start;

    const serverStatus = await mongoose.connection.db.admin().serverStatus();
    const dbStats = await mongoose.connection.db.stats();

    return {
      status: "healthy",
      state: stateName,
      latency_ms: latency,
      connections: {
        current: serverStatus.connections?.current ?? null,
        available: serverStatus.connections?.available ?? null,
        total_created: serverStatus.connections?.totalCreated ?? null,
      },
      database: mongoose.connection.name,
      collections: dbStats.collections ?? null,
      data_size: formatBytes(dbStats.dataSize ?? 0),
      storage_size: formatBytes(dbStats.storageSize ?? 0),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error.message,
      latency_ms: Date.now() - start,
    };
  }
}

async function checkRedis() {
  const start = Date.now();
  try {
    const status = redis.status; // "ready" | "connect" | "close" | "reconnecting" | "end"

    if (status !== "ready") {
      return { status: "unhealthy", state: status, latency_ms: null };
    }

    await redis.ping();
    const latency = Date.now() - start;

    const info = await redis.info("server");
    const memInfo = await redis.info("memory");
    const statsInfo = await redis.info("stats");

    const parseInfo = (raw) =>
      Object.fromEntries(
        raw
          .split("\r\n")
          .filter((l) => l && !l.startsWith("#"))
          .map((l) => l.split(":"))
          .filter((p) => p.length === 2)
          .map(([k, v]) => [k.trim(), v.trim()])
      );

    const serverInfo = parseInfo(info);
    const memObj = parseInfo(memInfo);
    const statsObj = parseInfo(statsInfo);

    return {
      status: "healthy",
      state: status,
      latency_ms: latency,
      version: serverInfo.redis_version ?? null,
      uptime: formatUptime(Number(serverInfo.uptime_in_seconds ?? 0)),
      memory: {
        used: formatBytes(Number(memObj.used_memory ?? 0)),
        peak: formatBytes(Number(memObj.used_memory_peak ?? 0)),
        rss: formatBytes(Number(memObj.used_memory_rss ?? 0)),
        fragmentation_ratio: memObj.mem_fragmentation_ratio ?? null,
      },
      stats: {
        total_commands_processed: statsObj.total_commands_processed ?? null,
        total_connections_received: statsObj.total_connections_received ?? null,
        keyspace_hits: statsObj.keyspace_hits ?? null,
        keyspace_misses: statsObj.keyspace_misses ?? null,
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error.message,
      latency_ms: Date.now() - start,
    };
  }
}

function checkSocketIO() {
  try {
    const io = getIo();
    const engine = io.engine;

    return {
      status: "healthy",
      connected_clients: engine.clientsCount ?? 0,
      transport_options: engine.opts?.transports ?? [],
    };
  } catch (error) {
    // getIo() throws if not yet initialized
    return {
      status: "unhealthy",
      error: error.message,
    };
  }
}

function checkSystem() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePct = ((usedMem / totalMem) * 100).toFixed(1);

  const cpus = os.cpus();
  const avgLoad = os.loadavg(); // [1m, 5m, 15m]

  const procMem = process.memoryUsage();

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    node_version: process.version,
    pid: process.pid,
    uptime: formatUptime(process.uptime()),
    cpu: {
      count: cpus.length,
      model: cpus[0]?.model ?? "unknown",
      load_avg: {
        "1m": avgLoad[0].toFixed(2),
        "5m": avgLoad[1].toFixed(2),
        "15m": avgLoad[2].toFixed(2),
      },
    },
    memory: {
      total: formatBytes(totalMem),
      used: formatBytes(usedMem),
      free: formatBytes(freeMem),
      usage_pct: `${memUsagePct}%`,
    },
    process_memory: {
      heap_used: formatBytes(procMem.heapUsed),
      heap_total: formatBytes(procMem.heapTotal),
      rss: formatBytes(procMem.rss),
      external: formatBytes(procMem.external),
    },
    environment: process.env.NODE_ENV ?? "development",
  };
}

// ─── Aggregate health check ─────────────────────────────────────────────────

export async function getHealthReport() {
  const startedAt = new Date().toISOString();
  const requestStart = Date.now();

  const [mongo, redisCheck] = await Promise.all([checkMongo(), checkRedis()]);

  const socketio = checkSocketIO();
  const system = checkSystem();

  const services = { mongo, redis: redisCheck, socketio };

  const allHealthy = Object.values(services).every((s) => s.status === "healthy");
  const overallStatus = allHealthy ? "healthy" : "degraded";

  return {
    status: overallStatus,
    timestamp: startedAt,
    response_time_ms: Date.now() - requestStart,
    version: process.env.npm_package_version ?? "1.0.0",
    services,
    system,
  };
}
