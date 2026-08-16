"use client";

import React from "react";
import { MentiResultsView } from "~/components/menti/results/MentiResultsView";
import { MOCK_PRESENTATION } from "~/lib/mock-menti";
import { MentiEditorHeader } from "~/components/menti/builder/MentiEditorHeader";
import { useRouter } from "next/navigation";

export default function MentiResultsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-(--cf-cream)">
      <MentiEditorHeader
        presentation={MOCK_PRESENTATION}
        activeTab="results"
        onTabChange={(tab: "create" | "results") => {
          if (tab === "create") {
            router.push(`/menti/${MOCK_PRESENTATION.id}/edit`);
          }
        }}
        onTitleChange={() => {}}
      />
      <MentiResultsView presentation={MOCK_PRESENTATION} />
    </div>
  );
}
