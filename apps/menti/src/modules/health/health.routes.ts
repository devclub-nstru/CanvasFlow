import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Menti server is healthy", healthy: true });
});

export default router;
