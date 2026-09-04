import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const SessionEventSchema = new Schema(
  {
    sessionId: {
      type: Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },

    sequence: {
      type: Number,
      required: true,
      min: 1,
    },

    type: {
      type: String,
      enum: [
        "session_created",
        "session_started",
        "session_paused",
        "session_resumed",
        "session_finished",

        "participant_joined",
        "participant_reconnected",
        "participant_disconnected",
        "participant_removed",

        "slide_changed",
        "slide_started",
        "slide_ended",

        "response_submitted",
      ],
      required: true,
      index: true,
    },

    actorType: {
      type: String,
      enum: ["presenter", "participant", "system"],
      required: true,
    },

    actorId: {
      type: Types.ObjectId,
      default: null,
    },

    stateVersion: {
      type: Number,
      required: true,
      min: 0,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  },
);

SessionEventSchema.index(
  {
    sessionId: 1,
    sequence: 1,
  },
  {
    unique: true,
  },
);

SessionEventSchema.index({
  sessionId: 1,
  createdAt: 1,
});

SessionEventSchema.index({
  sessionId: 1,
  commandId: 1,
});

export const SessionEvent = model("SessionEvent", SessionEventSchema);
