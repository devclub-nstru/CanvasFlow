import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISlideOption {
  id: string;
  label: string;
  isCorrect?: boolean;
  color?: string;
  voteCount: number;
}

export interface ISlide extends Document {
  _id: Types.ObjectId;
  presentationId: Types.ObjectId;
  type: "BAR_GRAPH" | "WORD_CLOUD" | "SCALES" | "RANKING" | "QUIZ" | "LEADERBOARD" | "CONTENT";
  position: number;
  question: string;
  description?: string | null;
  visualizationType?: "BAR" | "DONUT" | "PIE" | "BUBBLES";
  options: ISlideOption[];
  responseSettings: {
    multipleSelection?: boolean;
    maxSelections?: number;
    showResultsAsPercentage?: boolean;
    segmentResponses?: boolean;
    multipleSubmissions?: boolean;
    maxEntriesPerParticipant?: number;
    minRating?: number;
    maxRating?: number;
    ratingLowLabel?: string;
    ratingHighLabel?: string;
    countdownSeconds?: number;
    timeLimitSeconds?: number;
    basePoints?: number;
    timerSeconds?: number | null;
    isVotingLocked?: boolean;
    hideResultsFromAudience?: boolean;
  };
  designSettings: {
    contentImageUrl?: string | null;
    backgroundImageUrl?: string | null;
    backgroundColor?: string;
    textColor?: string;
    accentColor?: string;
    wordCloudColors?: string[];
    showLogo?: boolean;
    showJoiningInfo?: boolean;
  };
  metadata: Map<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const OptionSchema = new Schema<ISlideOption>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, maxlength: 500 },
    isCorrect: { type: Boolean, default: false },
    color: { type: String },
    voteCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const SlideSchema = new Schema<ISlide>(
  {
    presentationId: { type: Schema.Types.ObjectId, ref: "Presentation", required: true, index: true },
    type: {
      type: String,
      enum: ["BAR_GRAPH", "WORD_CLOUD", "SCALES", "RANKING", "QUIZ", "LEADERBOARD", "CONTENT"],
      required: true,
      index: true,
    },
    position: { type: Number, required: true, min: 0 },
    question: { type: String, trim: true, maxlength: 5000, default: "" },
    description: { type: String, trim: true, maxlength: 5000, default: null },
    visualizationType: { type: String, enum: ["BAR", "DONUT", "PIE", "BUBBLES"], default: "BAR" },
    options: { type: [OptionSchema], default: [] },
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
      countdownSeconds: { type: Number, default: 5 },
      timeLimitSeconds: { type: Number, default: 20 },
      basePoints: { type: Number, default: 1000 },
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
    metadata: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

SlideSchema.index({ presentationId: 1, position: 1 });
SlideSchema.index({ presentationId: 1, updatedAt: -1 });

export const Slide = mongoose.model<ISlide>("Slide", SlideSchema);
