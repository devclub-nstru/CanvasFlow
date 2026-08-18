import { Types } from "mongoose";
import { Presentation, Slide } from "../../core/database/models/index.js";

class PresentationRepository {
  async createPresentation(data: Record<string, unknown>) {
    return Presentation.create(data);
  }

  async findPresentationsByOwner(ownerId: Types.ObjectId) {
    return Presentation.find({ ownerId }).sort({ updatedAt: -1 }).lean();
  }

  async findPresentationByIdAndOwner(id: string, ownerId: Types.ObjectId) {
    return Presentation.findOne({ _id: id, ownerId }).lean();
  }

  async findPresentationById(id: string) {
    return Presentation.findById(id).lean();
  }

  async updatePresentation(id: string, ownerId: Types.ObjectId, data: Record<string, unknown>) {
    return Presentation.findOneAndUpdate({ _id: id, ownerId }, { $set: data }, { new: true }).lean();
  }

  async deletePresentation(id: string, ownerId: Types.ObjectId) {
    return Presentation.findOneAndDelete({ _id: id, ownerId });
  }

  async findSlidesByPresentation(presentationId: string) {
    return Slide.find({ presentationId }).sort({ position: 1 }).lean();
  }

  async createSlide(data: Record<string, unknown>) {
    return Slide.create(data);
  }

  async updateSlide(slideId: string, presentationId: string, data: Record<string, unknown>) {
    return Slide.findOneAndUpdate({ _id: slideId, presentationId }, { $set: data }, { new: true }).lean();
  }

  async deleteSlide(slideId: string, presentationId: string) {
    return Slide.findOneAndDelete({ _id: slideId, presentationId });
  }

  async deleteSlidesByPresentation(presentationId: string) {
    return Slide.deleteMany({ presentationId });
  }
}

export const presentationRepository = new PresentationRepository();
