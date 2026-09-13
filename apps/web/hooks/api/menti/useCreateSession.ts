import { useState } from "react";
import { env } from "~/env";

export interface MentiSessionResponse {
  session: {
    _id: string;
    id?: string;
    presentationId: string;
    presenterId: string;
    code: string;
    status: "waiting" | "live" | "paused" | "finished" | "cancelled";
    currentSlideId?: string;
    isVotingLocked?: boolean;
  };
  participantToken: string;
  participantId: string;
  /* Presenter-display credential for a screen with no auth cookie. Rotated on
   * every createSession call, so an older projector link stops working. */
  displayToken?: string;
}

export function useCreateSession() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createSession = async (presentationId: string): Promise<MentiSessionResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const baseUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presentationId }),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create presentation session");
      }

      const data = await res.json();
      return data as MentiSessionResponse;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error("Unknown session error");
      setError(errorObj);
      throw errorObj;
    } finally {
      setIsLoading(false);
    }
  };

  return { createSession, isLoading, error };
}
