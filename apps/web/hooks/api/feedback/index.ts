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

export interface FeedbackFilters {
  status?: FeedbackStatus;
  type?: FeedbackType;
  assignedToMe?: boolean;
  unassigned?: boolean;
}

export const REPORTS_PER_PAGE = 25;

export const useListFeedback = (filters: FeedbackFilters = {}, page = 0) => {
  const { data, isLoading, error, refetch } = trpc.feedback.listFeedback.useQuery(
    { ...filters, limit: REPORTS_PER_PAGE, offset: page * REPORTS_PER_PAGE },
    { refetchOnWindowFocus: true, staleTime: 15_000, placeholderData: (prev) => prev },
  );

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
    pageCount: Math.max(1, Math.ceil((data?.total ?? 0) / REPORTS_PER_PAGE)),
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
      void utils.feedback.listFeedback.invalidate();
      void utils.feedback.feedbackStats.invalidate();
      void utils.admin.listAudit.invalidate();
    },
  });

  return { updateFeedbackAsync: mutateAsync, isPending };
};
