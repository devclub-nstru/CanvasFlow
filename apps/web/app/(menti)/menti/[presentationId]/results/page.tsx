"use client";

import React, { use, useEffect, useState } from "react";
import { MentiResultsView } from "~/components/menti/results/MentiResultsView";
import { MentiEditorHeader } from "~/components/menti/builder/MentiEditorHeader";
import { useRouter } from "next/navigation";
import { env } from "~/env";
import type { MentiPresentation } from "~/lib/menti";

export default function MentiResultsPage({ params }: { params: Promise<{ presentationId: string }> }) {
  const unwrappedParams = use(params);
  const presentationId = unwrappedParams.presentationId;
  const router = useRouter();

  const [presentation, setPresentation] = useState<MentiPresentation | null>(null);

  useEffect(() => {
    const fetchPresentation = async () => {
      try {
        const baseUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";
        const res = await fetch(`${baseUrl}/api/presentations/${presentationId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load presentation");
        const data = await res.json();

        const mappedData = {
          ...data,
          id: data.id || data._id,
          slides: (data.slides || []).map((s: any) => ({
            ...s,
            id: s.id || s._id,
          })),
        };
        setPresentation(mappedData);
      } catch (err) {
        console.error("Failed to load presentation results:", err);
      }
    };
    fetchPresentation();
  }, [presentationId]);

  if (!presentation) {
    return (
      <div className="flex h-screen items-center justify-center bg-(--cf-cream)">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 animate-spin rounded-full border-2 border-(--cf-line) border-t-(--cf-orange)" />
          <p className="cf-meta">Loading results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-(--cf-cream)">
      <MentiEditorHeader
        presentation={presentation}
        activeTab="results"
        onTabChange={(tab: "create" | "results") => {
          if (tab === "create") {
            router.push(`/menti/${presentation.id}/edit`);
          }
        }}
        onTitleChange={() => {}}
      />
      <MentiResultsView presentation={presentation} />
    </div>
  );
}
