import { trpc } from "~/trpc/client";

export type FeedbackType = "bug" | "feedback" | "complaint" | "feature_request";

export const useSubmitFeedback = () => {
  const {
    mutateAsync: submitFeedbackAsync,
    isPending,
    error,
  } = trpc.feedback.submitFeedback.useMutation();

  return { submitFeedbackAsync, isPending, error };
};

/* ── Admin triage ───────────────────────────────────────────────────────── */

export type FeedbackStatus = "open" | "triaged" | "in_progress" | "resolved" | "closed";
export type FeedbackPriority = "low" | "medium" | "high";

export interface FeedbackFilters {
  status?: FeedbackStatus;
  type?: FeedbackType;
  priority?: FeedbackPriority;
  assignedToMe?: boolean;
  unassigned?: boolean;
}

export const useListFeedback = (filters: FeedbackFilters = {}) => {
  const { data, isLoading, error, refetch } = trpc.feedback.listFeedback.useQuery(
    { ...filters, limit: 50, offset: 0 },
    /* The inbox is a work queue — someone else may be triaging the same list,
     * so don't serve a stale page from cache on every tab switch. */
    { refetchOnWindowFocus: true, staleTime: 15_000 },
  );

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
  };
};

export const useFeedbackStats = () => {
  const { data, isLoading } = trpc.feedback.feedbackStats.useQuery(undefined, {
    staleTime: 15_000,
  });
  return { stats: data, isLoading };
};

export const useUpdateFeedback = () => {
  const utils = trpc.useUtils();

  const { mutateAsync, isPending } = trpc.feedback.updateFeedback.useMutation({
    onSuccess: () => {
      /* A status or assignee change moves the row between every filtered view
       * and shifts the counts, so both are invalidated rather than patched. */
      void utils.feedback.listFeedback.invalidate();
      void utils.feedback.feedbackStats.invalidate();
    },
  });

  return { updateFeedbackAsync: mutateAsync, isPending };
};
