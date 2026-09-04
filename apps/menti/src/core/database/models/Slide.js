import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const OptionSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
      maxlength: 500,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
    },
    voteCount: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  },
);

const SlideSchema = new Schema(
  {
    presentationId: {
      type: Types.ObjectId,
      ref: "Presentation",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["BAR_GRAPH", "WORD_CLOUD", "SCALES", "CONTENT", "QUIZ", "LEADERBOARD"],
      required: true,
      index: true,
    },

    position: {
      type: Number,
      required: true,
      min: 0,
    },

    question: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: null,
    },

    visualizationType: {
      type: String,
      enum: ["BAR", "DONUT", "PIE", "BUBBLES"],
      default: "BAR",
    },

    options: {
      type: [OptionSchema],
      default: [],
    },

    quizSettings: {
      timeLimitSeconds: { type: Number, default: 30, min: 5, max: 300 },
      maxPoints: { type: Number, default: 100, min: 10, max: 10000 },
      gradingScheme: {
        type: String,
        enum: ["answer_based", "time_based"],
        default: "time_based",
      },
    },

    responseSettings: {
      multipleSelection: { type: Boolean, default: false },
      maxSelections: { type: Number, default: 1 },
      showResultsAsPercentage: { type: Boolean, default: false },
      segmentResponses: { type: Boolean, default: false },
      multipleSubmissions: { type: Boolean, default: false },
      maxEntriesPerParticipant: { type: Number, default: 1 },
      minRating: { type: Number, default: 1 },
      maxRating: { type: Number, default: 5 },
      ratingLowLabel: { type: String, default: "" },
      ratingHighLabel: { type: String, default: "" },
      timerSeconds: { type: Number, default: null },
      isVotingLocked: { type: Boolean, default: false },
      hideResultsFromAudience: { type: Boolean, default: false },
    },

    designSettings: {
      contentImageUrl: { type: String, default: null },
      backgroundImageUrl: { type: String, default: null },
      backgroundColor: { type: String, default: "#ffffff" },
      textColor: { type: String, default: "#1a1d29" },
      accentColor: { type: String, default: "#2d5cf6" },
      wordCloudColors: { type: [String], default: [] },
      showLogo: { type: Boolean, default: true },
      showJoiningInfo: { type: Boolean, default: true },
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

SlideSchema.index({
  presentationId: 1,
  position: 1,
});

SlideSchema.index({
  presentationId: 1,
  updatedAt: -1,
});

export const Slide = model("Slide", SlideSchema);
