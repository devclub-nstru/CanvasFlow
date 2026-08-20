"use client";

import React, { use, useEffect, useState } from "react";
import { AudienceLayout } from "~/components/menti/audience/AudienceLayout";
import { useSearchParams } from "next/navigation";
import { env } from "~/env";
import { useMentiRealtime } from "~/hooks/useMentiRealtime";
import type { MentiPresentation } from "~/lib/menti";
import Noise from "~/components/Noise";

interface Props {
  params: Promise<{ presentationId: string }>;
}

export default function MentiLiveAudiencePage({ params }: Props) {
  const resolvedParams = use(params);
  const presentationId = resolvedParams.presentationId;

  const searchParams = useSearchParams();
  const querySessionId = searchParams.get("sessionId") || "";
  const queryToken = searchParams.get("token") || "";
  const queryName = searchParams.get("name") || "";
  const queryParticipantId = searchParams.get("participantId") || "";

  const [sessionId, setSessionId] = useState<string>(
    querySessionId || (typeof window !== "undefined" ? sessionStorage.getItem("cf_session_id") || "" : "")
  );
  const [token, setToken] = useState<string>(
    queryToken || (typeof window !== "undefined" ? sessionStorage.getItem("cf_participant_token") || "" : "")
  );
  const [participantName, setParticipantName] = useState<string>(
    queryName || (typeof window !== "undefined" ? sessionStorage.getItem("menti_participant_name") || sessionStorage.getItem("cf_voter_nickname") || "Participant" : "Participant")
  );
  const [participantId, setParticipantId] = useState<string>(
    queryParticipantId || (typeof window !== "undefined" ? sessionStorage.getItem("cf_participant_id") || "" : "")
  );

  const [presentation, setPresentation] = useState<MentiPresentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch public presentation details and ensure active participant token/session
  useEffect(() => {
    if (!presentationId) return;

    const fetchPresentationAndSession = async () => {
      try {
        const mentiApiUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";
        const res = await fetch(`${mentiApiUrl}/api/presentations/public/${presentationId}`);
        if (!res.ok) throw new Error("Failed to load presentation details");
        const data = await res.json();

        const mappedData: MentiPresentation = {
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
          const name = participantName || "Participant";
          const joinRes = await fetch(`${mentiApiUrl}/api/sessions/join-by-presentation/${presentationId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nickname: name }),
          });

          if (joinRes.ok) {
            const joinData = await joinRes.json();
            const newToken = joinData.participantToken;
            const newSessionId = joinData.session?.id || joinData.session?._id;
            const newParticipantId = joinData.participantId ? String(joinData.participantId) : "";
            const initialStatus = joinData.session?.status;

            if (newToken && newSessionId) {
              setToken(newToken);
              setSessionId(newSessionId);
              if (newParticipantId) setParticipantId(newParticipantId);
              if (typeof window !== "undefined") {
                sessionStorage.setItem("cf_participant_token", newToken);
                sessionStorage.setItem("cf_session_id", newSessionId);
                sessionStorage.setItem("menti_participant_name", name);
                if (newParticipantId) sessionStorage.setItem("cf_participant_id", newParticipantId);
                if (initialStatus) sessionStorage.setItem("cf_initial_session_status", initialStatus);
              }
            }
          }
        }
      } catch (err: any) {
        console.error("Failed to load presentation for audience:", err);
        setError(err?.message || "Failed to connect to presentation");
      } finally {
        setLoading(false);
      }
    };

    fetchPresentationAndSession();
  }, [presentationId, token, sessionId, participantName]);

  // Realtime Participant Store
  const { sessionState, connectionStatus, submitResponse, submittedSlideIds, leaderboard, lastResponseResult } = useMentiRealtime({
    sessionId,
    token,
    isHost: false,
    disabled: !sessionId || !token,
  });

  // Sync participantId from socket if not already set
  useEffect(() => {
    if (sessionState?.currentParticipantId && !participantId) {
      setParticipantId(sessionState.currentParticipantId);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cf_participant_id", sessionState.currentParticipantId);
      }
    }
  }, [sessionState?.currentParticipantId, participantId]);

  // Prevent flash: wait until initial session state arrives or socket errors out
  const isInitialLoading = loading || (!sessionState && !error && connectionStatus !== "error");

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-(--cf-cream) text-(--cf-ink)">
        <Noise />
        <div className="size-8 border-4 border-(--cf-orange) border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-(--cf-cream) p-6 text-center text-(--cf-ink)">
        <Noise />
        <div className="cf-panel cf-raised max-w-sm w-full p-6 bg-white border-2 border-(--cf-line-strong) rounded-2xl space-y-3">
          <h2 className="text-lg font-black text-rose-600 uppercase tracking-tight">
            Connection Error
          </h2>
          <p className="text-xs text-(--cf-ink-soft) leading-relaxed">
            {error || "Unable to load presentation. Please verify your join code or link."}
          </p>
          <a
            href="/menti/join"
            className="cf-btn cf-raised cf-press block w-full py-2 text-xs font-bold rounded-lg border-2 border-(--cf-line-strong) bg-white text-(--cf-ink)"
          >
            Enter Join Code
          </a>
        </div>
      </div>
    );
  }

  const rawStatus =
    sessionState?.session?.status ||
    (typeof window !== "undefined" ? (sessionStorage.getItem("cf_initial_session_status") as any) : null) ||
    "waiting";
  const sessionStatus = rawStatus;

  // Active slide from realtime socket: if in lobby/waiting, activeSlide is null
  const activeSlide =
    sessionStatus === "waiting"
      ? null
      : sessionState?.currentSlide || presentation.slides[0];
  const activeSlideIndex =
    activeSlide && presentation.slides.length > 0
      ? Math.max(0, presentation.slides.findIndex((s) => s.id === activeSlide?.id))
      : 0;

  const formattedJoinCode = sessionState?.session?.code
    ? sessionState.session.code.replace(/(.{3})/g, "$1 ").trim()
    : presentation.joinCode;

  return (
    <AudienceLayout
      presentation={{
        ...presentation,
        joinCode: formattedJoinCode,
      }}
      currentSlide={activeSlide}
      activeSlideIndex={activeSlideIndex}
      sessionStatus={sessionStatus}
      participantCount={sessionState?.participantCount ?? presentation.participantCount ?? 1}
      submittedSlideIds={submittedSlideIds}
      quizState={sessionState?.session?.quizState}
      lastResponseResult={lastResponseResult}
      leaderboard={leaderboard || sessionState?.leaderboard}
      participantName={participantName}
      participantId={participantId}
      onSubmitAnswer={submitResponse}
    />
  );
}
