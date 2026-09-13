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

    /* SHA-256 of the presenter-display token.
     *
     * A projector or a second screen opened from the presenter's own device has
     * no session cookie, so it needs some other way to prove it is allowed to
     * drive the session. It used to be allowed to prove it with the session id
     * alone — but the session id is handed to every participant on join (they
     * need it to open their socket), so that granted host control to the
     * audience. This token is the real credential: minted for the authenticated
     * presenter at session start and never broadcast.
     *
     * `select: false` so it is not carried on the session documents the
     * realtime layer reads and caches on every connection. */
    displayTokenHash: {
      type: String,
      default: null,
      select: false,
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

/* The presenter-display lookup is by (_id, displayTokenHash), so the token
 * needs its own index to keep that a point read. Sparse: most sessions in a
 * long-lived database are finished and hold no token. */
SessionSchema.index(
  {
    displayTokenHash: 1,
  },
  {
    sparse: true,
  },
);

export const Session = model("Session", SessionSchema);
