"use client";

import React, { useState } from "react";
import { MentiPresentation, MentiSlide } from "~/lib/menti";
import { ResultsSlideFeed } from "./ResultsSlideFeed";
import { ResultsOverviewSidebar } from "./ResultsOverviewSidebar";
import { ResultsEmptyState } from "./ResultsEmptyState";

interface Props {
  presentation: MentiPresentation;
}

export function MentiResultsView({ presentation }: Props) {
  const answerableSlides = (presentation.slides || []).filter(
    (s) => s.type !== "CONTENT"
  );

  const getSlideTotal = (s: MentiSlide) =>
    typeof s.totalResponses === "number" && s.totalResponses > 0
      ? s.totalResponses
      : (s.options || []).reduce((sum, opt) => sum + (opt.voteCount || 0), 0);

  const totalResponses = answerableSlides.reduce(
    (acc, s) => acc + getSlideTotal(s),
    0
  );

  const [activeSlideId, setActiveSlideId] = useState<string | null>(
    answerableSlides[0]?.id || null
  );

  // If there are zero recorded responses across all answerable slides, render Empty State
  if (totalResponses === 0 || answerableSlides.length === 0) {
    return <ResultsEmptyState presentationId={presentation.id} />;
  }

  const maxResponses = Math.max(0, ...answerableSlides.map(getSlideTotal));
  const participantCount = Math.max(
    maxResponses,
    presentation.participantCount || 0
  );

  const filteredPresentation: MentiPresentation = {
    ...presentation,
    slides: answerableSlides,
    participantCount,
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-(--cf-cream)">
      {/* 1. Left: Scrollable Feed of Results Cards per Slide */}
      <ResultsSlideFeed
        presentation={filteredPresentation}
        maxResponses={maxResponses}
        onVisibleSlideChange={setActiveSlideId}
      />

      {/* 2. Right: Collapsible Overview Sidebar with Navigation */}
      <ResultsOverviewSidebar
        presentation={filteredPresentation}
        maxResponses={maxResponses}
        activeSlideId={activeSlideId}
        onSelectSlide={setActiveSlideId}
      />
    </div>
  );
}
