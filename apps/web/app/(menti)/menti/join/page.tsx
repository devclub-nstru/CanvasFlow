"use client";

import React, { Suspense, useState } from "react";
import { AudienceJoinCard } from "~/components/menti/audience/AudienceJoinCard";
import { useRouter, useSearchParams } from "next/navigation";
import { env } from "~/env";

function MentiJoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultCode = searchParams.get("code") || searchParams.get("pin") || "";
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoin = async (code: string, nickname?: string) => {
    setJoinError(null);
    const participantName = nickname?.trim() || "Participant";

    try {
      const mentiApiUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";
      const res = await fetch(`${mentiApiUrl}/api/sessions/${code.trim().toUpperCase()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: participantName }),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setJoinError(errorData.error || "Invalid join code. Please check and try again.");
        return;
      }

      const joinData = await res.json();
      const { participantToken, session } = joinData;

      const targetSessionId = session?.id || session?._id;

      if (typeof window !== "undefined") {
        sessionStorage.setItem("menti_participant_name", participantName);
        sessionStorage.setItem("cf_voter_nickname", participantName);
        sessionStorage.setItem("cf_voter_joined_code", code);
        if (participantToken) sessionStorage.setItem("cf_participant_token", participantToken);
        if (targetSessionId) sessionStorage.setItem("cf_session_id", targetSessionId);
        if (session?.presentationId) sessionStorage.setItem("cf_presentation_id", session.presentationId);
      }

      if (session?.presentationId && targetSessionId) {
        router.push(
          `/menti/${session.presentationId}/live?sessionId=${targetSessionId}&token=${participantToken || ""}&name=${encodeURIComponent(participantName)}`
        );
      } else {
        setJoinError("Session details missing. Please try joining again.");
      }
    } catch (err: any) {
      setJoinError(err?.message || "Failed to join session. Please try again.");
    }
  };

  return (
    <div className="w-full min-h-screen bg-(--cf-cream)">
      {joinError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-lg shadow-lg">
          {joinError}
        </div>
      )}
      <AudienceJoinCard onJoin={handleJoin} defaultCode={defaultCode} />
    </div>
  );
}

export default function MentiJoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-(--cf-cream)" />}>
      <MentiJoinContent />
    </Suspense>
  );
}
