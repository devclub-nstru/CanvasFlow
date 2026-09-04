import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const PresentationSchema = new Schema(
  {
    ownerId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      default: "Untitled Presentation",
    },

    status: {
      type: String,
      enum: ["draft", "started", "deleted"],
      default: "draft",
      index: true,
    },

    settings: {
      allowAnonymousParticipants: {
        type: Boolean,
        default: true,
      },

      showResultsToParticipants: {
        type: Boolean,
        default: true,
      },
    },

    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

PresentationSchema.index({
  ownerId: 1,
  updatedAt: -1,
});

export const Presentation = model("Presentation", PresentationSchema);
