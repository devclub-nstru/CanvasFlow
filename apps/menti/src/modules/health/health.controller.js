import { getHealthReport } from "./health.service.js";

export const healthController = {
  /**
   * GET /health
   * Full health report — MongoDB, Redis, Socket.IO, system info.
   * Returns 200 when all services are healthy, 503 when degraded.
   */
  async getHealth(req, res) {
    const report = await getHealthReport();
    const httpStatus = report.status === "healthy" ? 200 : 503;
    return res.status(httpStatus).json(report);
  },

  /**
   * GET /health/live
   * Kubernetes liveness probe — is the process alive?
   * Always 200 as long as the server can respond.
   */
  getLiveness(req, res) {
    return res.status(200).json({ status: "alive", timestamp: new Date().toISOString() });
  },

  /**
   * GET /health/ready
   * Kubernetes readiness probe — can the process serve traffic?
   * Only 200 when MongoDB (primary dependency) is connected.
   */
  async getReadiness(req, res) {
    const report = await getHealthReport();
    const mongoHealthy = report.services.mongo.status === "healthy";
    const httpStatus = mongoHealthy ? 200 : 503;

    return res.status(httpStatus).json({
      status: mongoHealthy ? "ready" : "not_ready",
      timestamp: report.timestamp,
      services: {
        mongo: report.services.mongo.status,
        redis: report.services.redis.status,
        socketio: report.services.socketio.status,
      },
    });
  },
};
