"use client";

import React, { useEffect, useState, use } from "react";
import { MentiEditorLayout } from "~/components/menti/builder/MentiEditorLayout";
import { MentiPresentation } from "~/lib/menti";
import { env } from "~/env";

export default function MentiEditPage({ params }: { params: Promise<{ presentationId: string }> }) {
  const unwrappedParams = use(params);
  const presentationId = unwrappedParams.presentationId;

  const [presentation, setPresentation] = useState<MentiPresentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPresentation = async () => {
      try {
        setLoading(true);
        setError(null);
        const baseUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";
        const res = await fetch(`${baseUrl}/api/presentations/${presentationId}`, {
          credentials: "include",
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to load presentation (${res.status})`);
        }
        const data = await res.json();

        // Map _id to id if necessary
        const mappedData: MentiPresentation = {
          ...data,
          id: data.id || data._id,
          slides: (data.slides || []).map((s: any) => ({
            ...s,
            id: s.id || s._id,
          })),
        };

        setPresentation(mappedData);
      } catch (err: any) {
        console.error("Error loading presentation for editor:", err);
        setError(err?.message || "Failed to load presentation");
      } finally {
        setLoading(false);
      }
    };
    fetchPresentation();
  }, [presentationId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-(--cf-cream)">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 animate-spin rounded-full border-2 border-(--cf-line) border-t-(--cf-orange)" />
          <p className="cf-meta">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="flex h-screen items-center justify-center bg-(--cf-cream) p-6 text-center text-(--cf-ink)">
        <div className="cf-panel cf-raised max-w-sm w-full p-6 bg-white border-2 border-(--cf-line-strong) rounded-2xl space-y-3">
          <h2 className="text-lg font-black text-rose-600 uppercase tracking-tight">
            Editor Error
          </h2>
          <p className="text-xs text-(--cf-ink-soft) leading-relaxed">
            {error || "Presentation could not be found."}
          </p>
          <a
            href="/dashboard/menti"
            className="cf-btn cf-raised cf-press block w-full py-2 text-xs font-bold rounded-lg border-2 border-(--cf-line-strong) bg-white text-(--cf-ink)"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return <MentiEditorLayout initialPresentation={presentation} />;
}
