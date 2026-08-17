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
  const querySessionId = searchParams.get("sessionId") || "";
  const queryToken = searchParams.get("token") || "";

  const [sessionId, setSessionId] = useState<string>(
    querySessionId || (typeof window !== "undefined" ? sessionStorage.getItem("cf_session_id") || "" : "")
  );
  const [token, setToken] = useState<string>(
    queryToken || (typeof window !== "undefined" ? sessionStorage.getItem("cf_participant_token") || "" : "")
  );

  const [presentation, setPresentation] = useState<MentiPresentation | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch public presentation details and ensure active participant token/session
  useEffect(() => {
    if (!presentationId) return;

    const fetchPresentationAndSession = async () => {
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

        // Auto-join active session if token or sessionId is missing
        if ((!token || !sessionId) && presentationId) {
          const name = (typeof window !== "undefined" ? sessionStorage.getItem("menti_participant_name") : null) || "Participant";
          const joinRes = await fetch(`${mentiApiUrl}/api/sessions/join-by-presentation/${presentationId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nickname: name }),
          });

          if (joinRes.ok) {
            const joinData = await joinRes.json();
            const newToken = joinData.participantToken;
            const newSessionId = joinData.session?.id || joinData.session?._id;

            if (newToken && newSessionId) {
              setToken(newToken);
              setSessionId(newSessionId);
              if (typeof window !== "undefined") {
                sessionStorage.setItem("cf_participant_token", newToken);
                sessionStorage.setItem("cf_session_id", newSessionId);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to load public presentation details for audience:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPresentationAndSession();
  }, [presentationId, token, sessionId]);

  // Realtime Participant Store
  const { sessionState, submitResponse, submittedSlideIds } = useMentiRealtime({
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
      participantCount={sessionState?.participantCount ?? presentation?.participantCount ?? 1}
      submittedSlideIds={submittedSlideIds}
      onSubmitAnswer={submitResponse}
    />
  );
}

