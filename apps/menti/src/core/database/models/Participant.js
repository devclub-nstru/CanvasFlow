import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const ParticipantSchema = new Schema(
  {
    sessionId: {
      type: Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },

    nickname: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },

    tokenHash: {
      type: String,
      required: true,
      select: false,
    },

    status: {
      type: String,
      enum: [
        "active",
        "disconnected",
        "removed",
        "banned",
      ],
      default: "active",
      index: true,
    },

    socketId: {
      type: String,
      default: null,
      select: false,
    },

    score: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    disconnectedAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

ParticipantSchema.index({
  sessionId: 1,
  joinedAt: 1,
});

ParticipantSchema.index({
  sessionId: 1,
  score: -1,
  joinedAt: 1,
});

ParticipantSchema.index({
  sessionId: 1,
  status: 1,
});

ParticipantSchema.index(
  { tokenHash: 1 },
  { unique: true }
);

export const Participant = model(
  "Participant",
  ParticipantSchema
);
