export type MentiQuestionType =
  | "BAR_GRAPH"
  | "WORD_CLOUD"
  | "SCALES"
  | "CONTENT"
  | "QUIZ"
  | "LEADERBOARD";

export type MentiVisualizationType = "BAR" | "DONUT" | "PIE" | "BUBBLES";

export interface MentiOption {
  id: string;
  label: string;
  isCorrect?: boolean;
  color?: string;
  voteCount?: number;
}

export interface MentiQuizSettings {
  timeLimitSeconds?: number;
  maxPoints?: number;
  gradingScheme?: "answer_based" | "time_based";
}

export interface MentiSlideDesignSettings {
  contentImageUrl?: string | null;
  backgroundImageUrl?: string | null;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  wordCloudColors?: string[];
  showLogo?: boolean;
  showJoiningInfo?: boolean;

  // Content / Blank slide customization settings
  textAlign?: "left" | "center" | "right";
  eyebrow?: string;
  icon?: "none" | "sparkles" | "star" | "lightbulb" | "heart" | "info" | "quote";
  layoutStyle?: "statement" | "header_body" | "quote";
}

export interface MentiSlideResponseSettings {
  // BarGraph / Choice settings
  multipleSelection?: boolean;
  maxSelections?: number;
  showResultsAsPercentage?: boolean;
  segmentResponses?: boolean;

  // WordCloud / Text settings
  multipleSubmissions?: boolean; // true = unlimited/infinite responses per participant, false = single response
  maxEntriesPerParticipant?: number; // 1 = single text answer, 0 = unlimited

  // Scales / Rating settings
  minRating?: number;
  maxRating?: number;
  ratingLowLabel?: string;
  ratingHighLabel?: string;

  // General controls
  timerSeconds?: number | null;
  isVotingLocked?: boolean;
  hideResultsFromAudience?: boolean;
}

export interface MentiSlide {
  id: string;
  presentationId: string;
  type: MentiQuestionType;
  question: string;
  description?: string | null;
  visualizationType?: MentiVisualizationType;
  options: MentiOption[];
  quizSettings?: MentiQuizSettings;
  responseSettings: MentiSlideResponseSettings;
  designSettings: MentiSlideDesignSettings;
  position: number;
  totalResponses?: number;
}

export interface MentiPresentation {
  id: string;
  title: string;
  slug: string;
  joinCode: string;
  isLive: boolean;
  activeSlideId: string | null;
  ownerId: string;
  participantCount: number;
  slides: MentiSlide[];
  createdAt: string;
  updatedAt: string;
}

export interface MentiParticipantResponse {
  slideId: string;
  participantId: string;
  participantName?: string;
  value: string | string[] | number | Record<string, unknown>;
  submittedAt: string;
}

export interface MentiLeaderboardParticipant {
  participantId: string;
  nickname: string;
  score: number;
  rank: number;
}

export interface MentiLeaderboardSnapshot {
  sessionId: string;
  topParticipants: MentiLeaderboardParticipant[];
}
