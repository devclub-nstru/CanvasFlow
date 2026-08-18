import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISession extends Document {
  _id: Types.ObjectId;
  presentationId: Types.ObjectId;
  presenterId: Types.ObjectId;
  code: string;
  status: "waiting" | "live" | "paused" | "finished" | "cancelled";
  currentSlideId: Types.ObjectId | null;
  currentSlidePosition: number;
  isVotingLocked: boolean;
  questionStartedAt: Date | null;
  questionTimings: Map<string, Date>;
  version: number;
  eventSequence: number;
  settings: {
    allowLateJoining: boolean;
    allowAnonymousParticipants: boolean;
    showResults: boolean;
    showParticipantCount: boolean;
  };
  startedAt: Date | null;
  pausedAt: Date | null;
  endedAt: Date | null;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    presentationId: { type: Schema.Types.ObjectId, ref: "Presentation", required: true, index: true },
    presenterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true, minlength: 4, maxlength: 12 },
    status: { type: String, enum: ["waiting", "live", "paused", "finished", "cancelled"], default: "waiting", index: true },
    currentSlideId: { type: Schema.Types.ObjectId, ref: "Slide", default: null },
    currentSlidePosition: { type: Number, default: 0, min: 0 },
    isVotingLocked: { type: Boolean, default: false },
    questionStartedAt: { type: Date, default: null },
    questionTimings: { type: Map, of: Date, default: {} },
    version: { type: Number, required: true, default: 0, min: 0 },
    eventSequence: { type: Number, required: true, default: 0, min: 0 },
    settings: {
      allowLateJoining: { type: Boolean, default: true },
      allowAnonymousParticipants: { type: Boolean, default: true },
      showResults: { type: Boolean, default: true },
      showParticipantCount: { type: Boolean, default: true },
    },
    startedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

SessionSchema.index({ code: 1 }, { unique: true });
SessionSchema.index({ presentationId: 1, createdAt: -1 });
SessionSchema.index({ presenterId: 1, status: 1 });

export const Session = mongoose.model<ISession>("Session", SessionSchema);
