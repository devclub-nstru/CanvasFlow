import { presentationRepository } from "./presentation.repository.js";
import { Session, Slide, Response } from "../../core/database/models/index.js"; // Needed for bulkWrite, results enrichment, and active session lookup

class PresentationService {
  // --- Presentations ---

  async createPresentation(ownerId, data) {
    const presentation = await presentationRepository.createPresentation({ ...data, ownerId });
    // Create an initial default slide so the presentation opens directly into the builder
    await Slide.create({
      presentationId: presentation._id,
      type: "BAR_GRAPH",
      question: "Multiple Choice Question",
      position: 0,
      options: [
        { id: "opt-1", label: "Option 1" },
        { id: "opt-2", label: "Option 2" },
        { id: "opt-3", label: "Option 3" },
      ],
    });
    return presentation;
  }

  async getPresentations(ownerId) {
    return presentationRepository.findPresentationsByOwner(ownerId);
  }

  async enrichPresentationWithResults(presentation, slides) {
    if (!presentation || !slides) return { ...presentation, slides: slides || [] };

    try {
      const [participantCountsPerSlide, distinctParticipants, allResponses] = await Promise.all([
        Response.aggregate([
          { $match: { presentationId: presentation._id } },
          { $group: { _id: { slideId: "$slideId", participantId: "$participantId" } } },
          { $group: { _id: "$_id.slideId", count: { $sum: 1 } } },
        ]),
        Response.distinct("participantId", { presentationId: presentation._id }),
        Response.find({ presentationId: presentation._id }).lean(),
      ]);

      const countMap = {};
      for (const item of participantCountsPerSlide) {
        countMap[item._id.toString()] = item.count;
      }

      const responsesBySlide = {};
      for (const r of allResponses) {
        const sId = r.slideId.toString();
        if (!responsesBySlide[sId]) responsesBySlide[sId] = [];
        responsesBySlide[sId].push(r);
      }

      const enrichedSlides = slides.map((slide) => {
        const sId = slide._id.toString();
        const slideResponses = responsesBySlide[sId] || [];
        const totalResponses =
          countMap[sId] !== undefined
            ? countMap[sId]
            : (slide.options || []).reduce((sum, o) => sum + (o.voteCount || 0), 0);

        let options = slide.options || [];

        // For SCALES: compile rating distribution
        if (slide.type === "SCALES") {
          const min = slide.responseSettings?.minRating !== undefined ? slide.responseSettings.minRating : 1;
          const max = slide.responseSettings?.maxRating !== undefined ? slide.responseSettings.maxRating : 5;
          const ratingCounts = {};
          for (let i = min; i <= max; i++) ratingCounts[i] = 0;

          for (const resp of slideResponses) {
            const raw = resp.answer?.raw;
            const val = typeof resp.answer?.rating === "number" ? resp.answer.rating : (typeof raw === "number" ? raw : null);
            if (val !== null && ratingCounts[val] !== undefined) {
              ratingCounts[val] += 1;
            }
          }

          options = Object.entries(ratingCounts).map(([ratingVal, count]) => ({
            id: `rate-${ratingVal}`,
            label: String(ratingVal),
            voteCount: count,
          }));
        }

        // For WORD_CLOUD: compile words if options array is empty
        if (slide.type === "WORD_CLOUD" && (!options || options.length === 0)) {
          const wordCounts = {};
          for (const resp of slideResponses) {
            const processWord = (w) => {
              const clean = w ? String(w).trim() : "";
              if (!clean) return;
              wordCounts[clean] = (wordCounts[clean] || 0) + 1;
            };
            if (Array.isArray(resp.answer?.raw)) {
              for (const item of resp.answer.raw) processWord(item);
            } else if (resp.answer?.text) {
              processWord(resp.answer.text);
            }
          }
          options = Object.entries(wordCounts).map(([text, value], idx) => ({
            id: `word-${idx}-${text}`,
            label: text,
            voteCount: value,
          }));
        }

        return {
          ...slide,
          totalResponses,
          options,
        };
      });

      return {
        ...presentation,
        participantCount: distinctParticipants.length,
        slides: enrichedSlides,
      };
    } catch (err) {
      console.error("[PresentationService] Failed to enrich presentation with results:", err);
      return { ...presentation, slides };
    }
  }

  async getPresentationDetails(id, ownerId) {
    const presentation = await presentationRepository.findPresentationByIdAndOwner(id, ownerId);
    if (!presentation) {
      throw new Error("Presentation not found");
    }

    const slides = await presentationRepository.findSlidesByPresentation(id);
    return this.enrichPresentationWithResults(presentation, slides);
  }

  async getPublicPresentationDetails(id) {
    const presentation = await presentationRepository.findPresentationById(id);
    if (!presentation) {
      throw new Error("Presentation not found");
    }

    const activeSession = await Session.findOne({
      presentationId: id,
      status: { $in: ["waiting", "live", "paused"] },
    }).lean();

    if (!activeSession) {
      throw new Error("Presentation not found or no active session exists");
    }

    const slides = await presentationRepository.findSlidesByPresentation(id);
    const enriched = await this.enrichPresentationWithResults(presentation, slides);

    return {
      id: enriched._id || enriched.id,
      title: enriched.title,
      joinCode: activeSession.code,
      status: activeSession.status,
      slides: (enriched.slides || []).map((slide) => ({
        id: slide._id || slide.id,
        type: slide.type,
        question: slide.question,
        description: slide.description,
        visualizationType: slide.visualizationType,
        options: (slide.options || []).map((o) => ({
          id: o.id,
          label: o.label,
          color: o.color,
        })),
        quizSettings: slide.quizSettings
          ? {
              timeLimitSeconds: slide.quizSettings.timeLimitSeconds,
              maxPoints: slide.quizSettings.maxPoints,
              gradingScheme: slide.quizSettings.gradingScheme,
            }
          : undefined,
        designSettings: slide.designSettings,
        responseSettings: slide.responseSettings,
        position: slide.position,
      })),
    };
  }

  async updatePresentation(id, ownerId, data) {
    const updated = await presentationRepository.updatePresentation(id, ownerId, data);
    if (!updated) {
      throw new Error("Presentation not found or unauthorized");
    }
    return updated;
  }

  async deletePresentation(id, ownerId) {
    const deleted = await presentationRepository.deletePresentation(id, ownerId);
    if (!deleted) {
      throw new Error("Presentation not found or unauthorized");
    }

    // Cascade delete slides
    await presentationRepository.deleteSlidesByPresentation(id);
    return deleted;
  }

  // --- Slides ---

  async createSlide(presentationId, ownerId, data) {
    // Ensure user owns presentation before adding slide
    const presentation = await presentationRepository.findPresentationByIdAndOwner(presentationId, ownerId);
    if (!presentation) {
      throw new Error("Presentation not found or unauthorized");
    }

    return presentationRepository.createSlide({ ...data, presentationId });
  }

  async updateSlide(presentationId, slideId, ownerId, data) {
    // Verify ownership
    const presentation = await presentationRepository.findPresentationByIdAndOwner(presentationId, ownerId);
    if (!presentation) {
      throw new Error("Presentation not found or unauthorized");
    }

    const updated = await presentationRepository.updateSlide(slideId, presentationId, data);
    if (!updated) {
      throw new Error("Slide not found");
    }
    return updated;
  }

  async deleteSlide(presentationId, slideId, ownerId) {
    // Verify ownership
    const presentation = await presentationRepository.findPresentationByIdAndOwner(presentationId, ownerId);
    if (!presentation) {
      throw new Error("Presentation not found or unauthorized");
    }

    const deleted = await presentationRepository.deleteSlide(slideId, presentationId);
    if (!deleted) {
      throw new Error("Slide not found");
    }

    // Re-index remaining slides to ensure contiguous positions starting from 0
    const remainingSlides = await Slide.find({ presentationId }).sort({ position: 1 });
    const bulkOps = remainingSlides.map((slide, index) => ({
      updateOne: {
        filter: { _id: slide._id },
        update: { $set: { position: index } },
      },
    }));

    if (bulkOps.length > 0) {
      await Slide.bulkWrite(bulkOps);
    }

    return deleted;
  }

  async reorderSlides(presentationId, ownerId, slideIds) {
    // Verify ownership
    const presentation = await presentationRepository.findPresentationByIdAndOwner(presentationId, ownerId);
    if (!presentation) {
      throw new Error("Presentation not found or unauthorized");
    }

    // Bulk update positions based on array index
    const bulkOps = slideIds.map((slideId, index) => ({
      updateOne: {
        filter: { _id: slideId, presentationId },
        update: { $set: { position: index } },
      },
    }));

    if (bulkOps.length > 0) {
      await Slide.bulkWrite(bulkOps);
    }

    return presentationRepository.findSlidesByPresentation(presentationId);
  }
}

export const presentationService = new PresentationService();
