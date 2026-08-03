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
