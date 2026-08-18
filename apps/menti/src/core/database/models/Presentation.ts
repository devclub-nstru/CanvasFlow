import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPresentation extends Document {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  status: "draft" | "started" | "deleted";
  settings: {
    allowAnonymousParticipants: boolean;
    showResultsToParticipants: boolean;
  };
  metadata: Map<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PresentationSchema = new Schema<IPresentation>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200, default: "Untitled Presentation" },
    status: { type: String, enum: ["draft", "started", "deleted"], default: "draft", index: true },
    settings: {
      allowAnonymousParticipants: { type: Boolean, default: true },
      showResultsToParticipants: { type: Boolean, default: true },
    },
    metadata: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

PresentationSchema.index({ ownerId: 1, updatedAt: -1 });

export const Presentation = mongoose.model<IPresentation>("Presentation", PresentationSchema);
