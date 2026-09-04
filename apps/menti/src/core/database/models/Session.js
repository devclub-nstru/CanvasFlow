import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const SessionSchema = new Schema(
  {
    presentationId: {
      type: Types.ObjectId,
      ref: "Presentation",
      required: true,
      index: true,
    },

    presenterId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 4,
      maxlength: 12,
    },

    status: {
      type: String,
      enum: ["waiting", "live", "paused", "finished", "cancelled"],
      default: "waiting",
      index: true,
    },

    currentSlideId: {
      type: Types.ObjectId,
      ref: "Slide",
      default: null,
    },

    currentSlidePosition: {
      type: Number,
      default: 0,
      min: 0,
    },

    isVotingLocked: {
      type: Boolean,
      default: false,
    },

    quizState: {
      slideId: { type: Types.ObjectId, ref: "Slide", default: null },
      startedAt: { type: Date, default: null },
      endsAt: { type: Date, default: null },
      durationMs: { type: Number, default: null },
      isLocked: { type: Boolean, default: false },
    },

    version: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    eventSequence: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    settings: {
      allowLateJoining: {
        type: Boolean,
        default: true,
      },

      allowAnonymousParticipants: {
        type: Boolean,
        default: true,
      },

      showResults: {
        type: Boolean,
        default: true,
      },

      showParticipantCount: {
        type: Boolean,
        default: true,
      },
    },

    startedAt: {
      type: Date,
      default: null,
    },

    pausedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

SessionSchema.index(
  {
    code: 1,
  },
  {
    unique: true,
  },
);

SessionSchema.index({
  presentationId: 1,
  createdAt: -1,
});

SessionSchema.index({
  presenterId: 1,
  status: 1,
});

export const Session = model("Session", SessionSchema);
