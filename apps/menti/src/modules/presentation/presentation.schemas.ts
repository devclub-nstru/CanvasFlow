import { z } from "zod";

const optionSchema = z.object({
  id: z.string(),
  label: z.string().max(500),
  isCorrect: z.boolean().optional(),
  color: z.string().optional(),
  voteCount: z.number().optional(),
});

const responseSettingsSchema = z.object({
  multipleSelection: z.boolean().optional(),
  maxSelections: z.number().optional(),
  showResultsAsPercentage: z.boolean().optional(),
  segmentResponses: z.boolean().optional(),
  multipleSubmissions: z.boolean().optional(),
  maxEntriesPerParticipant: z.number().optional(),
  minRating: z.number().optional(),
  maxRating: z.number().optional(),
  ratingLowLabel: z.string().optional(),
  ratingHighLabel: z.string().optional(),
  countdownSeconds: z.number().min(0).max(30).optional(),
  timeLimitSeconds: z.number().min(5).max(300).optional(),
  basePoints: z.number().min(0).max(10000).optional(),
  timerSeconds: z.number().nullable().optional(),
  isVotingLocked: z.boolean().optional(),
  hideResultsFromAudience: z.boolean().optional(),
});

const designSettingsSchema = z.object({
  contentImageUrl: z.string().nullable().optional(),
  backgroundImageUrl: z.string().nullable().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  accentColor: z.string().optional(),
  wordCloudColors: z.array(z.string()).optional(),
  showLogo: z.boolean().optional(),
  showJoiningInfo: z.boolean().optional(),
});

const slideTypes = ["BAR_GRAPH", "WORD_CLOUD", "SCALES", "RANKING", "QUIZ", "LEADERBOARD", "CONTENT"] as const;

export const createPresentationSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    status: z.enum(["draft", "started", "deleted"]).optional(),
    settings: z
      .object({
        allowAnonymousParticipants: z.boolean().optional(),
        showResultsToParticipants: z.boolean().optional(),
      })
      .optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

export const updatePresentationSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    status: z.enum(["draft", "started", "deleted"]).optional(),
    settings: z
      .object({
        allowAnonymousParticipants: z.boolean().optional(),
        showResultsToParticipants: z.boolean().optional(),
      })
      .optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

export const createSlideSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    type: z.enum(slideTypes),
    position: z.number().min(0),
    question: z.string().max(5000).optional(),
    description: z.string().max(5000).nullable().optional(),
    visualizationType: z.enum(["BAR", "DONUT", "PIE", "BUBBLES"]).optional(),
    options: z.array(optionSchema).optional(),
    responseSettings: responseSettingsSchema.optional(),
    designSettings: designSettingsSchema.optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

export const updateSlideSchema = z.object({
  params: z.object({ id: z.string().min(1), slideId: z.string().min(1) }),
  body: z.object({
    type: z.enum(slideTypes).optional(),
    position: z.number().min(0).optional(),
    question: z.string().max(5000).optional(),
    description: z.string().max(5000).nullable().optional(),
    visualizationType: z.enum(["BAR", "DONUT", "PIE", "BUBBLES"]).optional(),
    options: z.array(optionSchema).optional(),
    responseSettings: responseSettingsSchema.optional(),
    designSettings: designSettingsSchema.optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

export const reorderSlidesSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ slideIds: z.array(z.string().min(1)) }),
});
