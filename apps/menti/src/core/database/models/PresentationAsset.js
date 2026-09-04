import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const PresentationAssetSchema = new Schema(
  {
    presentationId: {
      type: Types.ObjectId,
      ref: "Presentation",
      required: true,
      index: true,
    },

    url: {
      type: String,
      required: true,
    },

    storageKey: {
      type: String,
      required: true,
    },

    source: {
      type: String,
      enum: ["pptx_import", "upload", "other"],
      default: "pptx_import",
      required: true,
    },

    importId: {
      type: Types.ObjectId,
      ref: "PowerPointImport",
      default: null,
      index: true,
    },

    slideNumber: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const PresentationAsset = model("PresentationAsset", PresentationAssetSchema);
