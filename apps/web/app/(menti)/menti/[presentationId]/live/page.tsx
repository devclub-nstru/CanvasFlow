"use client";

import React, { use, useEffect, useState } from "react";
import { AudienceLayout } from "~/components/menti/audience/AudienceLayout";
import { useSearchParams } from "next/navigation";
import { env } from "~/env";
import { useMentiRealtime } from "~/hooks/useMentiRealtime";
import type { MentiPresentation } from "~/lib/menti";
import Noise from "~/components/Noise";

import { MOCK_PRESENTATION } from "~/lib/mock-menti";

interface Props {
  params: Promise<{ presentationId: string }>;
}

export default function MentiLiveAudiencePage({ params }: Props) {
  const resolvedParams = use(params);
  const presentationId = resolvedParams.presentationId;

  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";
  const token = searchParams.get("token") || (typeof window !== "undefined" ? sessionStorage.getItem("cf_participant_token") || "" : "");

  const [presentation, setPresentation] = useState<MentiPresentation | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch public presentation details for participants (no auth required)
  useEffect(() => {
    if (!presentationId) return;

    const fetchPresentation = async () => {
      try {
        const mentiApiUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";
        const res = await fetch(`${mentiApiUrl}/api/presentations/public/${presentationId}`);
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
        console.error("Failed to load public presentation details for audience:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPresentation();
  }, [presentationId]);

  // Realtime Participant Store
  const { sessionState, submitResponse } = useMentiRealtime({
    sessionId,
    token,
    isHost: false,
    disabled: !sessionId || !token,
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-(--cf-cream) text-(--cf-ink)">
        <Noise />
        <div className="size-8 border-4 border-(--cf-orange) border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Active slide from realtime socket or fallback to first slide
  const activeSlide = sessionState?.currentSlide || presentation?.slides[0];
  const activeSlideIndex = presentation?.slides.findIndex((s) => s.id === activeSlide?.id) ?? 0;

  const formattedJoinCode = sessionState?.session?.code
    ? sessionState.session.code.replace(/(.{3})/g, "$1 ").trim()
    : presentation?.joinCode || MOCK_PRESENTATION.joinCode;

  const effectivePresentation: MentiPresentation = presentation || {
    ...MOCK_PRESENTATION,
    id: presentationId,
  };

  return (
    <AudienceLayout
      presentation={{
        ...effectivePresentation,
        joinCode: formattedJoinCode,
      }}
      currentSlide={sessionState?.currentSlide || effectivePresentation.slides[0]}
      activeSlideIndex={activeSlideIndex >= 0 ? activeSlideIndex : 0}
      sessionStatus={sessionState?.session?.status || "live"}
      onSubmitAnswer={submitResponse}
    />
  );
}

