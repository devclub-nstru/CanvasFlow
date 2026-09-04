import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const PowerPointImportSchema = new Schema(
  {
    presentationId: {
      type: Types.ObjectId,
      ref: "Presentation",
      required: true,
      index: true,
    },

    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    originalName: {
      type: String,
      required: true,
    },

    storageKey: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["UPLOADED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"],
      default: "UPLOADED",
      index: true,
    },

    totalSlides: {
      type: Number,
      default: 0,
    },

    processedSlides: {
      type: Number,
      default: 0,
    },

    targetPosition: {
      type: Number,
      required: true,
      min: 0,
    },

    hasShiftedSlides: {
      type: Boolean,
      default: false,
    },

    errorInfo: {
      type: String,
      default: null,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const PowerPointImport = model("PowerPointImport", PowerPointImportSchema);
