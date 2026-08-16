import { useState } from "react";
import { env } from "~/env";
import type { MentiPresentation } from "~/lib/menti";

export function useCreatePresentation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createPresentation = async (title: string = "Untitled Presentation"): Promise<MentiPresentation> => {
    setIsLoading(true);
    setError(null);
    try {
      const baseUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";
      const res = await fetch(`${baseUrl}/api/presentations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to create presentation");
      }

      const data = await res.json();
      
      let finalId = data.id || data._id;
      if (!finalId && data.presentation) {
        finalId = data.presentation.id || data.presentation._id;
      }
      
      return {
        ...data,
        id: finalId,
      } as MentiPresentation;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { createPresentation, isLoading, error };
}
