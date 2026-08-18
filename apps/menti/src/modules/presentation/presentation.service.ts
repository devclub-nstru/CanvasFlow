import { Types } from "mongoose";
import { presentationRepository } from "./presentation.repository.js";
import { Slide, Response } from "../../core/database/models/index.js";

class PresentationService {
  async createPresentation(ownerId: Types.ObjectId, data: Record<string, unknown>) {
    const presentation = await presentationRepository.createPresentation({ ...data, ownerId });
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

  async getPresentations(ownerId: Types.ObjectId) {
    return presentationRepository.findPresentationsByOwner(ownerId);
  }

  async enrichPresentationWithResults(presentation: any, slides: any[]) {
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

      const countMap: Record<string, number> = {};
      for (const item of participantCountsPerSlide) {
        countMap[item._id.toString()] = item.count;
      }

      const responsesBySlide: Record<string, any[]> = {};
      for (const r of allResponses) {
        const sId = r.slideId.toString();
        if (!responsesBySlide[sId]) responsesBySlide[sId] = [];
        responsesBySlide[sId]!.push(r);
      }

      const enrichedSlides = slides.map((slide) => {
        const sId = slide._id.toString();
        const slideResponses = responsesBySlide[sId] || [];
        const totalResponses =
          countMap[sId] !== undefined
            ? countMap[sId]
            : (slide.options || []).reduce((sum: number, o: any) => sum + (o.voteCount || 0), 0);

        let options = slide.options || [];

        if (slide.type === "RANKING") {
          const itemCount = options.length;
          const pointsById: Record<string, number> = {};

          for (const resp of slideResponses) {
            const ordered: unknown = resp.answer?.optionIds ?? resp.answer?.raw;
            if (!Array.isArray(ordered)) continue;
            ordered.forEach((optionId, position) => {
              const id = String(optionId);
              pointsById[id] = (pointsById[id] ?? 0) + Math.max(0, itemCount - position);
            });
          }

          options = [...options]
            .map((opt: any) => ({ ...opt, voteCount: pointsById[opt.id] ?? 0 }))
            .sort((a: any, b: any) => b.voteCount - a.voteCount);
        }

        if (slide.type === "SCALES") {
          const min = slide.responseSettings?.minRating ?? 1;
          const max = slide.responseSettings?.maxRating ?? 5;
          const ratingCounts: Record<number, number> = {};
          for (let i = min; i <= max; i++) ratingCounts[i] = 0;

          for (const resp of slideResponses) {
            const val =
              typeof resp.answer?.rating === "number"
                ? resp.answer.rating
                : typeof resp.answer?.raw === "number"
                  ? resp.answer.raw
                  : null;
            if (val !== null && ratingCounts[val] !== undefined) {
              ratingCounts[val] = (ratingCounts[val] ?? 0) + 1;
            }
          }

          options = Object.entries(ratingCounts).map(([ratingVal, count]) => ({
            id: `rate-${ratingVal}`,
            label: String(ratingVal),
            voteCount: count,
          }));
        }

        if (slide.type === "WORD_CLOUD" && (!options || options.length === 0)) {
          const wordCounts: Record<string, number> = {};
          for (const resp of slideResponses) {
            const processWord = (w: unknown) => {
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

        return { ...slide, totalResponses, options };
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

  async getPresentationDetails(id: string, ownerId: Types.ObjectId) {
    const presentation = await presentationRepository.findPresentationByIdAndOwner(id, ownerId);
    if (!presentation) throw new Error("Presentation not found");
    const slides = await presentationRepository.findSlidesByPresentation(id);
    return this.enrichPresentationWithResults(presentation, slides);
  }

  async getPublicPresentationDetails(id: string) {
    const presentation = await presentationRepository.findPresentationById(id);
    if (!presentation) throw new Error("Presentation not found");
    const slides = await presentationRepository.findSlidesByPresentation(id);
    return this.enrichPresentationWithResults(presentation, slides);
  }

  async updatePresentation(id: string, ownerId: Types.ObjectId, data: Record<string, unknown>) {
    const updated = await presentationRepository.updatePresentation(id, ownerId, data);
    if (!updated) throw new Error("Presentation not found or unauthorized");
    return updated;
  }

  async deletePresentation(id: string, ownerId: Types.ObjectId) {
    const deleted = await presentationRepository.deletePresentation(id, ownerId);
    if (!deleted) throw new Error("Presentation not found or unauthorized");
    await presentationRepository.deleteSlidesByPresentation(id);
    return deleted;
  }

  async createSlide(presentationId: string, ownerId: Types.ObjectId, data: Record<string, unknown>) {
    const presentation = await presentationRepository.findPresentationByIdAndOwner(presentationId, ownerId);
    if (!presentation) throw new Error("Presentation not found or unauthorized");
    return presentationRepository.createSlide({ ...data, presentationId });
  }

  async updateSlide(presentationId: string, slideId: string, ownerId: Types.ObjectId, data: Record<string, unknown>) {
    const presentation = await presentationRepository.findPresentationByIdAndOwner(presentationId, ownerId);
    if (!presentation) throw new Error("Presentation not found or unauthorized");
    const updated = await presentationRepository.updateSlide(slideId, presentationId, data);
    if (!updated) throw new Error("Slide not found");
    return updated;
  }

  async deleteSlide(presentationId: string, slideId: string, ownerId: Types.ObjectId) {
    const presentation = await presentationRepository.findPresentationByIdAndOwner(presentationId, ownerId);
    if (!presentation) throw new Error("Presentation not found or unauthorized");
    const deleted = await presentationRepository.deleteSlide(slideId, presentationId);
    if (!deleted) throw new Error("Slide not found");
    return deleted;
  }

  async reorderSlides(presentationId: string, ownerId: Types.ObjectId, slideIds: string[]) {
    const presentation = await presentationRepository.findPresentationByIdAndOwner(presentationId, ownerId);
    if (!presentation) throw new Error("Presentation not found or unauthorized");

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
