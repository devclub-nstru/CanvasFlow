import { trpc } from "~/trpc/client";

export type FeedbackType = "bug" | "feedback" | "complaint" | "feature_request";

/**
 * Files a report from the feedback widget.
 *
 * Note the absence of any identity argument: the server reads the session
 * cookie itself, so there is nothing here that could attribute a report to the
 * wrong account. Nothing to invalidate either — reports aren't read back
 * anywhere in the app yet.
 */
export const useSubmitFeedback = () => {
  const {
    mutateAsync: submitFeedbackAsync,
    isPending,
    error,
  } = trpc.feedback.submitFeedback.useMutation();

  return { submitFeedbackAsync, isPending, error };
};
