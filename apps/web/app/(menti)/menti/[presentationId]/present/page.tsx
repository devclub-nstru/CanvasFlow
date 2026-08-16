"use client";

import React from "react";
import { PresenterLayout } from "~/components/menti/presenter/PresenterLayout";
import { MOCK_PRESENTATION } from "~/lib/mock-menti";

export default function MentiPresentPage() {
  return <PresenterLayout presentation={MOCK_PRESENTATION} />;
}
