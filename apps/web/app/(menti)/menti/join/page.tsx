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
    try {
      const mentiApiUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";
      const res = await fetch(`${mentiApiUrl}/api/sessions/${code.trim().toUpperCase()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname || "Participant" }),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to join session. Please check the code.");
      }

      const joinData = await res.json();
      const { participantToken, session } = joinData;

      if (typeof window !== "undefined") {
        if (nickname?.trim()) sessionStorage.setItem("cf_voter_nickname", nickname.trim());
        sessionStorage.setItem("cf_voter_joined_code", code);
        sessionStorage.setItem("cf_participant_token", participantToken);
      }

      // Navigate to live session with sessionId and token
      router.push(`/menti/${session.presentationId}/live?sessionId=${session.id || session._id}&token=${participantToken}`);
    } catch (err: any) {
      setJoinError(err.message || "Failed to join presentation session");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-(--cf-cream)">
      {joinError && (
        <div className="fixed top-4 z-50 px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-lg shadow-lg">
          {joinError}
        </div>
      )}
      <AudienceJoinCard onJoin={handleJoin} defaultCode={defaultCode} />
    </div>
  );
}

export default function MentiJoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-(--cf-cream)" />}>
      <MentiJoinContent />
    </Suspense>
  );
}
