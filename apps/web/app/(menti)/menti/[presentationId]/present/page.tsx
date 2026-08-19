"use client";

import React, { use, useEffect, useState } from "react";
import { PresenterLayout } from "~/components/menti/presenter/PresenterLayout";
import { env } from "~/env";
import type { MentiPresentation } from "~/lib/menti";
import { MOCK_PRESENTATION } from "~/lib/mock-menti";
import Noise from "~/components/Noise";
import { useSearchParams } from "next/navigation";

interface Props {
  params: Promise<{ presentationId: string }>;
}

export default function MentiPresentPage({ params }: Props) {
  const resolvedParams = use(params);
  const presentationId = resolvedParams.presentationId;

  const searchParams = useSearchParams();
  const querySessionId = searchParams.get("sessionId");

  const [presentation, setPresentation] = useState<MentiPresentation | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(querySessionId || "demo-session");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!presentationId) return;

    const startSessionFlow = async () => {
      try {
        const mentiApiUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";

        // 1. Fetch Presentation Details
        const presRes = await fetch(`${mentiApiUrl}/api/presentations/${presentationId}`, {
          credentials: "include",
        });
        if (!presRes.ok) throw new Error("Failed to load presentation details");
        const presData = await presRes.json();

        const mappedPresentation = {
          ...presData,
          id: presData.id || presData._id,
          slides: (presData.slides || []).map((s: any) => ({
            ...s,
            id: s.id || s._id,
          })),
        };

        // 2. Start or Resume active Session for the presentation
        let activeSessionId = querySessionId || "demo-session";
        try {
          const sessionRes = await fetch(`${mentiApiUrl}/api/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ presentationId }),
            credentials: "include",
          });
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            const activeSession = sessionData.session;
            activeSessionId = activeSession.id || activeSession._id || querySessionId || "demo-session";

            if (activeSession?.code) {
              mappedPresentation.joinCode = activeSession.code.replace(/(.{3})/g, "$1 ").trim();
            }
          }
        } catch (sessErr) {
          console.warn("Session init fallback to demo session:", sessErr);
        }

        setPresentation(mappedPresentation);
        setSessionId(activeSessionId);
      } catch (err: any) {
        console.warn("Using offline / mock presentation for presenter stage:", err);
        setPresentation({
          ...MOCK_PRESENTATION,
          id: presentationId,
        });
        setSessionId(querySessionId || "demo-session");
      } finally {
        setLoading(false);
      }
    };

    startSessionFlow();
  }, [presentationId, querySessionId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-(--cf-cream) text-(--cf-ink)">
        <Noise />
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 border-4 border-(--cf-orange) border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold font-mono tracking-wider uppercase opacity-70">
            Initializing presenter stage...
          </p>
        </div>
      </div>
    );
  }

  if (!presentation || !sessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-(--cf-cream) p-6 text-center text-(--cf-ink)">
        <Noise />
        <div className="cf-panel cf-raised max-w-sm w-full p-6 bg-white border-2 border-(--cf-line-strong) rounded-2xl">
          <h2 className="text-lg font-black text-rose-600 uppercase tracking-tight">
            Presenter Stage Error
          </h2>
          <p className="mt-2 text-xs text-(--cf-ink-soft) leading-relaxed">
            Unable to initialize presentation metadata.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="cf-btn cf-raised cf-press mt-4 w-full py-2 text-xs font-bold rounded-lg border-2 border-(--cf-line-strong) bg-white"
          >
            Retry Stage
          </button>
        </div>
      </div>
    );
  }

  return (
    <PresenterLayout
      presentation={presentation}
      sessionId={sessionId}
    />
  );
}

