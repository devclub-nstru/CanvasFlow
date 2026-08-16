"use client";

import React, { useState } from "react";
import { MentiPresentation } from "~/lib/menti";
import { ResultsSlideFeed } from "./ResultsSlideFeed";
import { ResultsOverviewSidebar } from "./ResultsOverviewSidebar";
import { ResultsEmptyState } from "./ResultsEmptyState";

interface Props {
  presentation: MentiPresentation;
}

export function MentiResultsView({ presentation }: Props) {
  const [activeSlideId, setActiveSlideId] = useState<string | null>(
    presentation.slides[0]?.id || null
  );

  const totalResponses = presentation.slides.reduce(
    (acc, s) => acc + (s.totalResponses || 0),
    0
  );

  // If there are zero recorded responses across all slides, render the 1:1 Empty State
  if (totalResponses === 0) {
    return <ResultsEmptyState presentationId={presentation.id} />;
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-(--cf-cream)">
      {/* 1. Left: Scrollable Feed of Results Cards per Slide */}
      <ResultsSlideFeed
        presentation={presentation}
        onVisibleSlideChange={setActiveSlideId}
      />

      {/* 2. Right: Collapsible Overview Sidebar with Navigation */}
      <ResultsOverviewSidebar
        presentation={presentation}
        activeSlideId={activeSlideId}
        onSelectSlide={setActiveSlideId}
      />
    </div>
  );
}
