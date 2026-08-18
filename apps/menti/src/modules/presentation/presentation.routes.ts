import { Router } from "express";
import { presentationController } from "./presentation.controller.js";
import { requireAuth } from "../../core/middleware/auth.js";

const router = Router();

router.get("/public/:id", (req, res) => presentationController.getPublicPresentationDetails(req, res));

router.use(requireAuth);

router.post("/", (req, res) => presentationController.createPresentation(req, res));
router.get("/", (req, res) => presentationController.getPresentations(req, res));
router.get("/:id", (req, res) => presentationController.getPresentationDetails(req, res));
router.patch("/:id", (req, res) => presentationController.updatePresentation(req, res));
router.delete("/:id", (req, res) => presentationController.deletePresentation(req, res));

router.post("/:id/slides", (req, res) => presentationController.createSlide(req, res));
router.patch("/:id/slides/reorder", (req, res) => presentationController.reorderSlides(req, res));
router.patch("/:id/slides/:slideId", (req, res) => presentationController.updateSlide(req, res));
router.delete("/:id/slides/:slideId", (req, res) => presentationController.deleteSlide(req, res));

export default router;
