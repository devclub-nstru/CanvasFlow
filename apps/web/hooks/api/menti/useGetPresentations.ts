import { useState, useEffect, useCallback } from "react";
import { env } from "~/env";
import type { MentiPresentation } from "~/lib/menti";

export function useGetPresentations() {
  const [presentations, setPresentations] = useState<MentiPresentation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPresentations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const baseUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";
      const res = await fetch(`${baseUrl}/api/presentations`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch presentations");
      }

      const data = await res.json();
      const mapped = data.map((p: any) => ({
        ...p,
        id: p.id || p._id,
      }));
      setPresentations(mapped as MentiPresentation[]);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPresentations();
  }, [fetchPresentations]);

  return { presentations, isLoading, error, refetch: fetchPresentations };
}
