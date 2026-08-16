"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";

import { BarGraphViewer } from "./bar-graph/BarGraphViewer";
import { BarGraphEditor } from "./bar-graph/BarGraphEditor";
import { BarGraphAudience } from "./bar-graph/BarGraphAudience";

import { WordCloudViewer } from "./word-cloud/WordCloudViewer";
import { WordCloudEditor } from "./word-cloud/WordCloudEditor";
import { WordCloudAudience } from "./word-cloud/WordCloudAudience";

import { ScalesViewer } from "./scales/ScalesViewer";
import { ScalesEditor } from "./scales/ScalesEditor";
import { ScalesAudience } from "./scales/ScalesAudience";

import { ContentViewer } from "./content/ContentViewer";
import { ContentEditor } from "./content/ContentEditor";
import { ContentAudience } from "./content/ContentAudience";

// 1. Viewer Renderer (Used in Slide Canvas & Presenter Fullscreen Mode)
export function SlideQuestionViewer({
  slide,
  isPreview,
  hideResults,
  showAsPercentage,
}: {
  slide: MentiSlide;
  isPreview?: boolean;
  hideResults?: boolean;
  showAsPercentage?: boolean;
}) {
  switch (slide.type) {
    case "BAR_GRAPH":
      return (
        <BarGraphViewer
          slide={slide}
          isPreview={isPreview}
          hideResults={hideResults}
          showAsPercentage={showAsPercentage}
        />
      );
    case "WORD_CLOUD":
      return <WordCloudViewer slide={slide} isPreview={isPreview} hideResults={hideResults} />;
    case "SCALES":
      return <ScalesViewer slide={slide} isPreview={isPreview} hideResults={hideResults} />;
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
      return <BarGraphEditor slide={slide} onChange={onChange} variant="canvas" />;
    case "WORD_CLOUD":
      return <WordCloudEditor slide={slide} onChange={onChange} variant="canvas" />;
    case "SCALES":
      return <ScalesEditor slide={slide} onChange={onChange} variant="canvas" />;
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
}: {
  slide: MentiSlide;
  onSubmit: (val: any) => void;
  hasSubmitted?: boolean;
}) {
  switch (slide.type) {
    case "BAR_GRAPH":
      return <BarGraphAudience slide={slide} onSubmit={onSubmit} hasSubmitted={hasSubmitted} />;
    case "WORD_CLOUD":
      return <WordCloudAudience slide={slide} onSubmit={onSubmit} hasSubmitted={hasSubmitted} />;
    case "SCALES":
      return <ScalesAudience slide={slide} onSubmit={onSubmit} hasSubmitted={hasSubmitted} />;
    case "CONTENT":
      return <ContentAudience slide={slide} onSubmit={onSubmit} hasSubmitted={hasSubmitted} />;
    default:
      return <div className="p-4 text-neutral-500">Waiting for next question...</div>;
  }
}
