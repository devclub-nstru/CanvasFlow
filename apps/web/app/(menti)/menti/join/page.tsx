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
        // In local demo / offline mode, fallback to demo live presentation
        if (typeof window !== "undefined") {
          sessionStorage.setItem("menti_participant_name", participantName);
          sessionStorage.setItem("cf_voter_joined_code", code);
        }
        router.push(`/menti/demo-pres-1/live?name=${encodeURIComponent(participantName)}`);
        return;
      }

      const joinData = await res.json();
      const { participantToken, session } = joinData;

      if (typeof window !== "undefined") {
        sessionStorage.setItem("menti_participant_name", participantName);
        sessionStorage.setItem("cf_voter_nickname", participantName);
        sessionStorage.setItem("cf_voter_joined_code", code);
        if (participantToken) sessionStorage.setItem("cf_participant_token", participantToken);
      }

      if (session?.presentationId) {
        router.push(
          `/menti/${session.presentationId}/live?sessionId=${session.id || session._id}&token=${participantToken || ""}&name=${encodeURIComponent(participantName)}`
        );
      } else {
        router.push(`/menti/demo-pres-1/live?name=${encodeURIComponent(participantName)}`);
      }
    } catch {
      // Graceful fallback to demo live session
      if (typeof window !== "undefined") {
        sessionStorage.setItem("menti_participant_name", participantName);
        sessionStorage.setItem("cf_voter_joined_code", code);
      }
      router.push(`/menti/demo-pres-1/live?name=${encodeURIComponent(participantName)}`);
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
