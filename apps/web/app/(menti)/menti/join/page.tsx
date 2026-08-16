"use client";

import React, { Suspense } from "react";
import { AudienceJoinCard } from "~/components/menti/audience/AudienceJoinCard";
import { useRouter, useSearchParams } from "next/navigation";

function MentiJoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultCode = searchParams.get("code") || searchParams.get("pin") || "";

  const handleJoin = (code: string, nickname?: string) => {
    // Store voter nickname in session storage for live voting
    if (typeof window !== "undefined") {
      if (nickname?.trim()) sessionStorage.setItem("cf_voter_nickname", nickname.trim());
      sessionStorage.setItem("cf_voter_joined_code", code);
    }

    // Navigate to live session (in demo/mock mode or matched session)
    router.push(`/menti/demo-pres-1/live`);
  };

  return <AudienceJoinCard onJoin={handleJoin} defaultCode={defaultCode} />;
}

export default function MentiJoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-(--cf-cream)" />}>
      <MentiJoinContent />
    </Suspense>
  );
}
