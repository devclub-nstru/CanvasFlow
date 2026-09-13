import { Router } from "express";
import { healthController } from "./health.controller.js";

const router = Router();

// Full health report (all services + system info)
router.get("/", healthController.getHealth);

// Kubernetes-style probes
router.get("/live", healthController.getLiveness);
router.get("/ready", healthController.getReadiness);

export default router;
