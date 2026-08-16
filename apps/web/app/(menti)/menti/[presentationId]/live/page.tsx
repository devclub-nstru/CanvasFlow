"use client";

import React from "react";
import { AudienceLayout } from "~/components/menti/audience/AudienceLayout";
import { MOCK_PRESENTATION } from "~/lib/mock-menti";

export default function MentiLiveAudiencePage() {
  return <AudienceLayout presentation={MOCK_PRESENTATION} activeSlideIndex={0} />;
}
