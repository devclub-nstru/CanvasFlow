"use client";

import React, { useEffect, useState, use } from "react";
import { MentiEditorLayout } from "~/components/menti/builder/MentiEditorLayout";
import { MentiPresentation } from "~/lib/menti";
import { env } from "~/env";

export default function MentiEditPage({ params }: { params: Promise<{ presentationId: string }> }) {
  const unwrappedParams = use(params);
  const presentationId = unwrappedParams.presentationId;

  const [presentation, setPresentation] = useState<MentiPresentation | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPresentation = async () => {
      try {
        const baseUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";
        const res = await fetch(`${baseUrl}/api/presentations/${presentationId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load presentation");
        const data = await res.json();
        
        // Map _id to id if necessary
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
        setError(err instanceof Error ? err : new Error("Unknown error"));
      }
    };
    fetchPresentation();
  }, [presentationId]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-(--cf-cream)">
        <p className="cf-meta text-red-500">Failed to load presentation: {error.message}</p>
      </div>
    );
  }

  if (!presentation) {
    return (
      <div className="flex h-screen items-center justify-center bg-(--cf-cream)">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 animate-spin rounded-full border-2 border-(--cf-line) border-t-(--cf-orange)" />
          <p className="cf-meta">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return <MentiEditorLayout initialPresentation={presentation} />;
}
