"use client";

import React from "react";
import { MentiEditorLayout } from "~/components/menti/builder/MentiEditorLayout";
import { MOCK_PRESENTATION } from "~/lib/mock-menti";

export default function MentiEditPage() {
  return <MentiEditorLayout initialPresentation={MOCK_PRESENTATION} />;
}
