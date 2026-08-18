import type { Request, Response } from "express";
import { presentationService } from "./presentation.service.js";
import {
  createPresentationSchema,
  updatePresentationSchema,
  createSlideSchema,
  updateSlideSchema,
  reorderSlidesSchema,
} from "./presentation.schemas.js";

class PresentationController {
  async createPresentation(req: Request, res: Response): Promise<void> {
    try {
      const validated = createPresentationSchema.parse({ body: req.body });
      const presentation = await presentationService.createPresentation((req as any).user._id, validated.body as any);
      res.status(201).json(presentation);
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation Error", details: error.errors });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getPresentations(req: Request, res: Response): Promise<void> {
    try {
      const presentations = await presentationService.getPresentations((req as any).user._id);
      res.status(200).json(presentations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getPresentationDetails(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
      const presentation = await presentationService.getPresentationDetails(id, (req as any).user._id);
      res.status(200).json(presentation);
    } catch (error: any) {
      if (error.message === "Presentation not found") {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getPublicPresentationDetails(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
      const presentation = await presentationService.getPublicPresentationDetails(id);
      res.status(200).json(presentation);
    } catch (error: any) {
      if (error.message === "Presentation not found") {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async updatePresentation(req: Request, res: Response): Promise<void> {
    try {
      const validated = updatePresentationSchema.parse({ params: req.params, body: req.body });
      const updated = await presentationService.updatePresentation(validated.params.id, (req as any).user._id, validated.body as any);
      res.status(200).json(updated);
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation Error", details: error.errors });
        return;
      }
      if (error.message === "Presentation not found or unauthorized") {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async deletePresentation(req: Request, res: Response): Promise<void> {
    try {
      const deleteId = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
      await presentationService.deletePresentation(deleteId, (req as any).user._id);
      res.status(204).send();
    } catch (error: any) {
      if (error.message === "Presentation not found or unauthorized") {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async createSlide(req: Request, res: Response): Promise<void> {
    try {
      const validated = createSlideSchema.parse({ params: req.params, body: req.body });
      const slide = await presentationService.createSlide(validated.params.id, (req as any).user._id, validated.body as any);
      res.status(201).json(slide);
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation Error", details: error.errors });
        return;
      }
      if (error.message === "Presentation not found or unauthorized") {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async updateSlide(req: Request, res: Response): Promise<void> {
    try {
      const validated = updateSlideSchema.parse({ params: req.params, body: req.body });
      const slide = await presentationService.updateSlide(
        validated.params.id,
        validated.params.slideId,
        (req as any).user._id,
        validated.body as any,
      );
      res.status(200).json(slide);
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation Error", details: error.errors });
        return;
      }
      if (error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async deleteSlide(req: Request, res: Response): Promise<void> {
    try {
      const presId = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
      const slideId = Array.isArray(req.params["slideId"]) ? req.params["slideId"][0]! : req.params["slideId"]!;
      await presentationService.deleteSlide(presId, slideId, (req as any).user._id);
      res.status(204).send();
    } catch (error: any) {
      if (error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }

  async reorderSlides(req: Request, res: Response): Promise<void> {
    try {
      const validated = reorderSlidesSchema.parse({ params: req.params, body: req.body });
      const slides = await presentationService.reorderSlides(
        validated.params.id,
        (req as any).user._id,
        validated.body.slideIds,
      );
      res.status(200).json(slides);
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Validation Error", details: error.errors });
        return;
      }
      if (error.message === "Presentation not found or unauthorized") {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }
}

export const presentationController = new PresentationController();
