"use client";

import React from "react";
import { AudienceJoinCard } from "~/components/menti/audience/AudienceJoinCard";
import { useRouter } from "next/navigation";

export default function MentiJoinPage() {
  const router = useRouter();

  const handleJoin = (code: string) => {
    // Navigate to live session
    router.push(`/menti/demo-pres-1/live`);
  };

  return <AudienceJoinCard onJoin={handleJoin} />;
}
