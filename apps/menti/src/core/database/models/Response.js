import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const ResponseSchema = new Schema(
  {
    sessionId: {
      type: Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },

    presentationId: {
      type: Types.ObjectId,
      ref: "Presentation",
      required: true,
      index: true,
    },

    slideId: {
      type: Types.ObjectId,
      ref: "Slide",
      required: true,
      index: true,
    },

    participantId: {
      type: Types.ObjectId,
      ref: "Participant",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["select", "text", "multi_text", "multi_select", "rating"],
      required: true,
    },

    answer: {
      optionIds: {
        type: [String],
        default: [],
      },

      text: {
        type: String,
        default: null,
        maxlength: 10000,
      },

      rating: {
        type: Number,
        default: null,
      },

      raw: {
        type: Schema.Types.Mixed,
        default: null,
      },

      pointsAwarded: {
        type: Number,
        default: 0,
      },

      isCorrect: {
        type: Boolean,
        default: false,
      },

      elapsedMs: {
        type: Number,
        default: 0,
      },
    },

    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Quiz-specific top-level fields for scoring analytics
    pointsAwarded: {
      type: Number,
      default: 0,
    },

    isCorrect: {
      type: Boolean,
      default: null,
    },

    elapsedMs: {
      type: Number,
      default: null,
    },

    updatedAtClient: {
      type: Date,
      default: null,
    },

    commandId: {
      type: String,
      required: true,
    },

    /* What "one submission" means for this response, so a single unique index
     * can serve both slide kinds.
     *
     * "single" for every slide that accepts one answer per participant: the
     * index below then makes a second attempt a duplicate-key error, enforced
     * by the database rather than by a read-then-write race in the handler.
     *
     * For a word cloud configured to accept unlimited entries, the handler
     * puts the per-submission commandId here instead. Each insert is therefore
     * distinct and the index admits it, without the index having to know
     * anything about slide settings. */
    submissionSlot: {
      type: String,
      required: true,
      default: "single",
    },
  },
  {
    timestamps: true,
  },
);

/* One submission per participant per slide — unless the slide says otherwise.
 *
 * This replaces two earlier indexes, both of which were wrong.
 *
 * The first was unique on (sessionId, slideId, participantId), which made the
 * handler's own "unlimited word cloud" path impossible: that branch
 * deliberately skips the duplicate check and inserts, so the second entry
 * always violated the index and the participant got a raw duplicate-key error.
 * The feature was unreachable as shipped.
 *
 * The second was unique on those three plus commandId. Since commandId is a
 * fresh randomUUID generated server-side inside the handler, it can never
 * collide, so that index enforced nothing at all while still costing a write.
 *
 * Keying on submissionSlot instead gets both behaviours from one index: it
 * holds the constant "single" for slides that accept one answer, and the
 * per-submission commandId for slides that accept many.
 *
 * NOTE: Mongoose creates new indexes but never drops removed ones. The two
 * old indexes must be dropped explicitly — see tools/migrate-response-indexes.js.
 */
ResponseSchema.index(
  {
    sessionId: 1,
    slideId: 1,
    participantId: 1,
    submissionSlot: 1,
  },
  {
    unique: true,
  },
);

ResponseSchema.index({
  slideId: 1,
  submittedAt: -1,
});

export const Response = model("Response", ResponseSchema);
