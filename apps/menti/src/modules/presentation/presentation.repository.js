import { Presentation, Slide } from "../../core/database/models/index.js";

class PresentationRepository {
  // --- Presentations ---

  async createPresentation(data) {
    return Presentation.create(data);
  }

  async findPresentationsByOwner(ownerId) {
    return Presentation.find({ ownerId }).sort({ updatedAt: -1 }).lean();
  }

  async findPresentationByIdAndOwner(id, ownerId) {
    return Presentation.findOne({ _id: id, ownerId }).lean();
  }

  async findPresentationById(id) {
    return Presentation.findById(id).lean();
  }

  async updatePresentation(id, ownerId, data) {
    return Presentation.findOneAndUpdate({ _id: id, ownerId }, { $set: data }, { new: true }).lean();
  }

  async deletePresentation(id, ownerId) {
    return Presentation.findOneAndDelete({ _id: id, ownerId });
  }

  // --- Slides ---

  async findSlidesByPresentation(presentationId) {
    return Slide.find({ presentationId }).sort({ position: 1 }).lean();
  }

  async createSlide(data) {
    return Slide.create(data);
  }

  async findSlideByIdAndPresentation(slideId, presentationId) {
    return Slide.findOne({ _id: slideId, presentationId }).lean();
  }

  async updateSlide(slideId, presentationId, data) {
    return Slide.findOneAndUpdate({ _id: slideId, presentationId }, { $set: data }, { new: true }).lean();
  }

  async deleteSlide(slideId, presentationId) {
    return Slide.findOneAndDelete({ _id: slideId, presentationId });
  }

  async deleteSlidesByPresentation(presentationId) {
    return Slide.deleteMany({ presentationId });
  }
}

export const presentationRepository = new PresentationRepository();
