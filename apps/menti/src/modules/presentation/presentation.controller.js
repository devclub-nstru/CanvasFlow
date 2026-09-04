import { presentationService } from "./presentation.service.js";
import {
  createPresentationSchema,
  updatePresentationSchema,
  createSlideSchema,
  updateSlideSchema,
  reorderSlidesSchema,
} from "./presentation.schemas.js";
import { PowerPointImport, Slide } from "../../core/database/models/index.js";
import { storageService } from "../../core/storage/storage.service.js";
import { redis } from "../../core/database/redis.js";
import { PPTX_JOB_QUEUE } from "../../core/keys.js";
import path from "node:path";

class PresentationController {
  // --- Presentations ---

  async createPresentation(req, res) {
    try {
      const validated = createPresentationSchema.parse({ body: req.body });
      const presentation = await presentationService.createPresentation(req.user._id, validated.body);
      res.status(201).json(presentation);
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Validation Error", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getPresentations(req, res) {
    try {
      const presentations = await presentationService.getPresentations(req.user._id);
      res.status(200).json(presentations);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getPresentationDetails(req, res) {
    try {
      const presentation = await presentationService.getPresentationDetails(req.params.id, req.user._id);
      res.status(200).json(presentation);
    } catch (error) {
      if (error.message === "Presentation not found") return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async getPublicPresentationDetails(req, res) {
    try {
      const presentation = await presentationService.getPublicPresentationDetails(req.params.id);
      res.status(200).json(presentation);
    } catch (error) {
      if (error.message === "Presentation not found") return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async updatePresentation(req, res) {
    try {
      const validated = updatePresentationSchema.parse({ params: req.params, body: req.body });
      const updated = await presentationService.updatePresentation(validated.params.id, req.user._id, validated.body);
      res.status(200).json(updated);
    } catch (error) {
      if (error.name === "ZodError") return res.status(400).json({ error: "Validation Error", details: error.errors });
      if (error.message === "Presentation not found or unauthorized") return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async deletePresentation(req, res) {
    try {
      await presentationService.deletePresentation(req.params.id, req.user._id);
      res.status(204).send();
    } catch (error) {
      if (error.message === "Presentation not found or unauthorized") return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  // --- Slides ---

  async createSlide(req, res) {
    try {
      const validated = createSlideSchema.parse({ params: req.params, body: req.body });
      const slide = await presentationService.createSlide(validated.params.id, req.user._id, validated.body);
      res.status(201).json(slide);
    } catch (error) {
      if (error.name === "ZodError") return res.status(400).json({ error: "Validation Error", details: error.errors });
      if (error.message === "Presentation not found or unauthorized") return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async updateSlide(req, res) {
    try {
      const validated = updateSlideSchema.parse({ params: req.params, body: req.body });
      const slide = await presentationService.updateSlide(validated.params.id, validated.params.slideId, req.user._id, validated.body);
      res.status(200).json(slide);
    } catch (error) {
      if (error.name === "ZodError") return res.status(400).json({ error: "Validation Error", details: error.errors });
      if (error.message.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async deleteSlide(req, res) {
    try {
      await presentationService.deleteSlide(req.params.id, req.params.slideId, req.user._id);
      res.status(204).send();
    } catch (error) {
      if (error.message.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async reorderSlides(req, res) {
    try {
      const validated = reorderSlidesSchema.parse({ params: req.params, body: req.body });
      const slides = await presentationService.reorderSlides(validated.params.id, req.user._id, validated.body.slideIds);
      res.status(200).json(slides);
    } catch (error) {
      if (error.name === "ZodError") return res.status(400).json({ error: "Validation Error", details: error.errors });
      if (error.message === "Presentation not found or unauthorized") return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async importPowerPoint(req, res) {
    try {
      const presentationId = req.params.id;
      if (!req.file) {
        console.error("[API Import Error] No file attached to import request.");
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log(`[API Import Request] Received file: "${req.file.originalname}" (${(req.file.size / 1024 / 1024).toFixed(2)} MB) for presentation: ${presentationId}`);

      // Verify ownership of the presentation
      const presentation = await presentationService.getPresentationDetails(presentationId, req.user._id);
      if (!presentation) {
        console.error(`[API Import Error] Presentation ${presentationId} not found or unauthorized for user ${req.user._id}`);
        return res.status(404).json({ error: "Presentation not found or unauthorized" });
      }

      // Generate a safe unique storage key for original file
      const safeOriginalName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9_.-]/g, "_");
      const timestamp = Date.now();
      const storageKey = `imports/${presentationId}/${timestamp}-${safeOriginalName}`;

      console.log(`[API Import] Uploading file to storage key: ${storageKey}...`);
      await storageService.uploadFile(req.file.path, storageKey);
      console.log(`[API Import] Uploaded to storage successfully.`);

      // Determine target insertion position
      const slideCount = await Slide.countDocuments({ presentationId });
      let position = parseInt(req.body.position ?? req.query.position, 10);
      if (isNaN(position) || position < 0) {
        position = slideCount;
      } else if (position > slideCount) {
        position = slideCount;
      }

      // Create import record
      const pptxImport = await PowerPointImport.create({
        presentationId,
        userId: req.user._id,
        originalName: safeOriginalName,
        storageKey,
        status: "UPLOADED",
        targetPosition: position,
      });

      console.log(`[API Import] Created PowerPointImport record: ${pptxImport._id}. Enqueuing to Redis queue 'pptx_import_jobs'...`);
      await redis.lpush(PPTX_JOB_QUEUE, pptxImport._id.toString());
      console.log(`[API Import] Enqueued import job ${pptxImport._id} to Redis successfully.`);

      res.status(202).json({
        importId: pptxImport._id,
        status: pptxImport.status,
        processedSlides: pptxImport.processedSlides,
        totalSlides: pptxImport.totalSlides,
      });
    } catch (error) {
      console.error("[API Import Error]", error);
      if (error.message === "Presentation not found") {
        return res.status(404).json({ error: "Presentation not found or unauthorized" });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getImportStatus(req, res) {
    try {
      const { id: presentationId, importId } = req.params;
      const pptxImport = await PowerPointImport.findOne({
        _id: importId,
        presentationId,
        userId: req.user._id,
      });

      if (!pptxImport) {
        return res.status(404).json({ error: "Import record not found" });
      }

      res.json({
        importId: pptxImport._id,
        status: pptxImport.status,
        processedSlides: pptxImport.processedSlides,
        totalSlides: pptxImport.totalSlides,
        errorInfo: pptxImport.errorInfo,
        createdAt: pptxImport.createdAt,
        startedAt: pptxImport.startedAt,
        completedAt: pptxImport.completedAt,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async cancelImport(req, res) {
    try {
      const { id: presentationId, importId } = req.params;
      const pptxImport = await PowerPointImport.findOne({
        _id: importId,
        presentationId,
        userId: req.user._id,
      });

      if (!pptxImport) {
        return res.status(404).json({ error: "Import record not found" });
      }

      if (pptxImport.status === "COMPLETED" || pptxImport.status === "FAILED") {
        return res.status(400).json({ error: `Cannot cancel an import that is already ${pptxImport.status.toLowerCase()}` });
      }

      pptxImport.status = "CANCELLED";
      await pptxImport.save();

      res.json({
        importId: pptxImport._id,
        status: pptxImport.status,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const presentationController = new PresentationController();
