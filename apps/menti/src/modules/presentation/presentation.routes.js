import { Router } from "express";
import { presentationController } from "./presentation.controller.js";
import { requireAuth } from "../../core/middleware/auth.js";

const router = Router();

// Public presentation route for audience/participants (no auth required)
router.get("/public/:id", presentationController.getPublicPresentationDetails);

// Secure remaining presentation routes with the Better Auth middleware
router.use(requireAuth);

// --- Presentations ---
router.post("/", presentationController.createPresentation);
router.get("/", presentationController.getPresentations);
router.get("/:id", presentationController.getPresentationDetails);
router.patch("/:id", presentationController.updatePresentation);
router.delete("/:id", presentationController.deletePresentation);

// --- Slides ---
router.post("/:id/slides", presentationController.createSlide);
router.patch("/:id/slides/reorder", presentationController.reorderSlides);
router.patch("/:id/slides/:slideId", presentationController.updateSlide);
router.delete("/:id/slides/:slideId", presentationController.deleteSlide);

// --- PowerPoint Import ---
import multer from "multer";
import os from "node:os";

const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".pptx")) {
      return cb(new Error("Only PowerPoint (.pptx) files are allowed"), false);
    }
    cb(null, true);
  },
});

// Route wrapper to handle multer error responses gracefully
const handleUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

router.post("/:id/import-pptx", handleUpload, presentationController.importPowerPoint);
router.get("/:id/imports/:importId", presentationController.getImportStatus);
router.post("/:id/imports/:importId/cancel", presentationController.cancelImport);

export default router;
