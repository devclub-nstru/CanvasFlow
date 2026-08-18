import mongoose, { Document, Schema, Types } from "mongoose";

export interface IResponse extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  presentationId: Types.ObjectId;
  slideId: Types.ObjectId;
  participantId: Types.ObjectId;
  type: "select" | "text" | "multi_text" | "multi_select" | "rating" | "ranking";
  answer: {
    optionIds?: string[];
    text?: string | null;
    rating?: number | null;
    raw?: unknown;
  };
  submittedAt: Date;
  updatedAtClient: Date | null;
  commandId: string;
  isCorrect: boolean | null;
  responseTimeMs: number | null;
  pointsAwarded: number;
  createdAt: Date;
  updatedAt: Date;
}

const ResponseSchema = new Schema<IResponse>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
    presentationId: { type: Schema.Types.ObjectId, ref: "Presentation", required: true, index: true },
    slideId: { type: Schema.Types.ObjectId, ref: "Slide", required: true, index: true },
    participantId: { type: Schema.Types.ObjectId, ref: "Participant", required: true, index: true },
    type: {
      type: String,
      enum: ["select", "text", "multi_text", "multi_select", "rating", "ranking"],
      required: true,
    },
    answer: {
      optionIds: { type: [String], default: [] },
      text: { type: String, default: null, maxlength: 10000 },
      rating: { type: Number, default: null },
      raw: { type: Schema.Types.Mixed, default: null },
    },
    submittedAt: { type: Date, default: Date.now, index: true },
    updatedAtClient: { type: Date, default: null },
    commandId: { type: String, required: true },
    isCorrect: { type: Boolean, default: null },
    responseTimeMs: { type: Number, default: null },
    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true },
);

ResponseSchema.index(
  { sessionId: 1, slideId: 1, participantId: 1, commandId: 1 },
  { unique: true },
);
ResponseSchema.index({ sessionId: 1, slideId: 1, participantId: 1 });
ResponseSchema.index({ slideId: 1, submittedAt: -1 });

export const Response = mongoose.model<IResponse>("Response", ResponseSchema);
