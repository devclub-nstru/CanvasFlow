"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import type { LastQuizResult } from "~/hooks/useMentiRealtime";

import { BarGraphViewer } from "./bar-graph/BarGraphViewer";
import { BarGraphEditor } from "./bar-graph/BarGraphEditor";
import { BarGraphAudience } from "./bar-graph/BarGraphAudience";

import { WordCloudViewer } from "./word-cloud/WordCloudViewer";
import { WordCloudEditor } from "./word-cloud/WordCloudEditor";
import { WordCloudAudience } from "./word-cloud/WordCloudAudience";

import { ScalesViewer } from "./scales/ScalesViewer";
import { ScalesEditor } from "./scales/ScalesEditor";
import { ScalesAudience } from "./scales/ScalesAudience";

import { RankingViewer } from "./ranking/RankingViewer";
import { RankingEditor } from "./ranking/RankingEditor";
import { RankingAudience } from "./ranking/RankingAudience";

import { QuizViewer } from "./quiz/QuizViewer";
import { QuizEditor } from "./quiz/QuizEditor";
import { QuizAudience } from "./quiz/QuizAudience";

import { LeaderboardViewer } from "./leaderboard/LeaderboardViewer";
import { LeaderboardEditor } from "./leaderboard/LeaderboardEditor";
import { LeaderboardAudience } from "./leaderboard/LeaderboardAudience";

import { ContentViewer } from "./content/ContentViewer";
import { ContentEditor } from "./content/ContentEditor";
import { ContentAudience } from "./content/ContentAudience";

// 1. Viewer Renderer (Used in Slide Canvas & Presenter Fullscreen Mode)
export function SlideQuestionViewer({
  slide,
  analytics,
  isPreview,
  hideResults,
  showAsPercentage,
  questionStartedAt,
  serverOffsetMs,
}: {
  slide: MentiSlide;
  analytics?: any;
  isPreview?: boolean;
  hideResults?: boolean;
  showAsPercentage?: boolean;
  /** Timed types (QUIZ) derive their countdown from this server instant. */
  questionStartedAt?: string | null;
  /** serverClock - deviceClock, so the countdown survives a skewed device clock. */
  serverOffsetMs?: number;
}) {
  switch (slide.type) {
    case "BAR_GRAPH":
      return (
        <BarGraphViewer
          slide={slide}
          analytics={analytics}
          isPreview={isPreview}
          hideResults={hideResults}
          showAsPercentage={showAsPercentage}
        />
      );
    case "WORD_CLOUD":
      return <WordCloudViewer slide={slide} analytics={analytics} isPreview={isPreview} hideResults={hideResults} />;
    case "SCALES":
      return <ScalesViewer slide={slide} analytics={analytics} isPreview={isPreview} hideResults={hideResults} />;
    case "RANKING":
      return <RankingViewer slide={slide} analytics={analytics} isPreview={isPreview} hideResults={hideResults} />;
    case "QUIZ":
      return (
        <QuizViewer
          slide={slide}
          analytics={analytics}
          isPreview={isPreview}
          hideResults={hideResults}
          questionStartedAt={questionStartedAt}
          serverOffsetMs={serverOffsetMs}
        />
      );
    case "LEADERBOARD":
      return <LeaderboardViewer slide={slide} analytics={analytics} isPreview={isPreview} />;
    case "CONTENT":
      return <ContentViewer slide={slide} isPreview={isPreview} />;
    default:
      return <div className="p-8 text-neutral-400">Unknown Question Type</div>;
  }
}

// 2. Editor Settings Renderer (Used in Builder Right Inspector Sidebar)
export function SlideQuestionEditor({
  slide,
  onChange,
}: {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
}) {
  switch (slide.type) {
    case "BAR_GRAPH":
      return <BarGraphEditor slide={slide} onChange={onChange} />;
    case "WORD_CLOUD":
      return <WordCloudEditor slide={slide} onChange={onChange} />;
    case "SCALES":
      return <ScalesEditor slide={slide} onChange={onChange} />;
    case "RANKING":
      return <RankingEditor slide={slide} onChange={onChange} />;
    case "QUIZ":
      return <QuizEditor slide={slide} onChange={onChange} />;
    case "LEADERBOARD":
      return <LeaderboardEditor slide={slide} onChange={onChange} />;
    case "CONTENT":
      return <ContentEditor slide={slide} onChange={onChange} />;
    default:
      return null;
  }
}

// 3. Canvas Inline Editor (Used directly on the Builder Canvas Stage)
export function SlideQuestionCanvasEditor({
  slide,
  onChange,
}: {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
}) {
  switch (slide.type) {
    case "BAR_GRAPH":
      return <BarGraphEditor key={slide.id} slide={slide} onChange={onChange} variant="canvas" />;
    case "WORD_CLOUD":
      return <WordCloudEditor slide={slide} onChange={onChange} variant="canvas" />;
    case "SCALES":
      return <ScalesEditor slide={slide} onChange={onChange} variant="canvas" />;
    case "RANKING":
      return <RankingEditor key={slide.id} slide={slide} onChange={onChange} variant="canvas" />;
    case "QUIZ":
      return <QuizEditor key={slide.id} slide={slide} onChange={onChange} variant="canvas" />;
    case "LEADERBOARD":
      return <LeaderboardEditor key={slide.id} slide={slide} onChange={onChange} variant="canvas" />;
    case "CONTENT":
      return <ContentEditor slide={slide} onChange={onChange} variant="canvas" />;
    default:
      return <SlideQuestionViewer slide={slide} isPreview />;
  }
}

// 4. Audience Mobile Input Renderer (Used in Voter Mobile /menti/join Mode)
export function SlideAudienceInput({
  slide,
  onSubmit,
  hasSubmitted,
  questionStartedAt,
  serverOffsetMs,
  lastQuizResult,
}: {
  slide: MentiSlide;
  /**
   * Returning the server's ack lets timed types show the participant their own
   * result (correct/incorrect and points) before the host reveals anything.
   */
  onSubmit: (val: any) => Promise<any> | void;
  hasSubmitted?: boolean;
  questionStartedAt?: string | null;
  serverOffsetMs?: number;
  /** Verdict from the last quiz question, shown on the leaderboard slide. */
  lastQuizResult?: LastQuizResult | null;
}) {
  switch (slide.type) {
    case "BAR_GRAPH":
      return <BarGraphAudience key={slide.id} slide={slide} onSubmit={onSubmit} hasSubmitted={hasSubmitted} />;
    case "WORD_CLOUD":
      return <WordCloudAudience key={slide.id} slide={slide} onSubmit={onSubmit} hasSubmitted={hasSubmitted} />;
    case "SCALES":
      return <ScalesAudience key={slide.id} slide={slide} onSubmit={onSubmit} hasSubmitted={hasSubmitted} />;
    case "RANKING":
      return <RankingAudience key={slide.id} slide={slide} onSubmit={onSubmit} hasSubmitted={hasSubmitted} />;
    case "QUIZ":
      return (
        <QuizAudience
          key={slide.id}
          slide={slide}
          onSubmit={onSubmit}
          hasSubmitted={hasSubmitted}
          questionStartedAt={questionStartedAt}
          serverOffsetMs={serverOffsetMs}
        />
      );
    case "LEADERBOARD":
      return (
        <LeaderboardAudience key={slide.id} slide={slide} lastQuizResult={lastQuizResult} />
      );
    case "CONTENT":
      return <ContentAudience key={slide.id} slide={slide} onSubmit={onSubmit} hasSubmitted={hasSubmitted} />;
    default:
      return <div className="p-4 text-neutral-500">Waiting for next question...</div>;
  }
}
