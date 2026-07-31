import { trpc } from "~/trpc/client";

/**
 * Fetches all summary analytics metrics for a single form.
 *
 * Returns exactly: totalResponses, deviceBreakdown, dailyTrends (30d),
 * peakDay, avgSubmissionsPerDay, avgSubmissionsPerWeek.
 *
 * `deviceBreakdown` counts submissions by device, not page views — form view
 * tracking was removed, so there is no viewer-side denominator here. Don't
 * reintroduce a completion rate on this hook without a new source for
 * "people who started but didn't submit".
 */
export const useGetFormAnalytics = (formId: string) => {
  const {
    data: analytics,
    error,
    isLoading,
    isError,
    isSuccess,
    refetch,
  } = trpc.analytics.getFormAnalytics.useQuery(
    { formId },
    {
      enabled: !!formId && formId.length === 36,
      // Analytics for a published form changes only when new
      // submissions arrive. 30s freshness gives back-nav within
      // the dashboard near-instant feel while still picking up
      // fresh responses on the next visit. Submission mutations
      // do not invalidate this key (they come from public form
      // visitors, not the studio user), so this is also the
      // upper bound on UI staleness — adjust if you wire up a
      // live channel later.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );

  return { analytics, error, isLoading, isError, isSuccess, refetch };
};

/**
 * Cursor-paginated submissions for the analytics table.
 *
 * Each page returns up to `limit` rows older than the cursor (which is
 * the createdAt ISO of the last row from the previous page). React Query
 * concatenates pages internally; we flatten them into a single array for
 * the consumer.
 *
 * Polling: refetches every 30s while the tab is visible. With infinite
 * queries this refetches ALL loaded pages — fine for typical sizes,
 * worth watching if a user loads thousands of rows.
 */
export const useGetSubmissions = (formId: string) => {
  const PAGE_SIZE = 100;
  const enabled = !!formId && formId.length === 36;

  const result = trpc.analytics.getSubmissions.useInfiniteQuery(
    { formId, limit: PAGE_SIZE },
    {
      enabled,
      initialCursor: null,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      refetchInterval: (query) =>
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        query.state.data
          ? 30_000
          : false,
    },
  );

  // Flatten the pages so the consumer sees a single submissions list.
  const submissions = result.data?.pages.flatMap((p) => p.submissions) ?? [];

  return {
    submissions,
    error: result.error,
    isLoading: result.isLoading,
    isError: result.isError,
    isSuccess: result.isSuccess,
    refetch: result.refetch,
    fetchNextPage: result.fetchNextPage,
    hasNextPage: !!result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
  };
};

/**
 * Records that a visitor answered a field and clicked Next.
 * Called on each Next click in the public form page.
 */
export const useRecordFieldAnswer = () => {
  const {
    mutate: recordFieldAnswer,
    mutateAsync: recordFieldAnswerAsync,
    isPending,
  } = trpc.analytics.recordFieldAnswer.useMutation();

  return { recordFieldAnswer, recordFieldAnswerAsync, isPending };
};

/**
 * The heavier breakdown: per-question distribution, day-of-week, 30/60/90d
 * trend totals, response velocity.
 *
 * Split from the summary query because it's the expensive one, not because it
 * was ever gated — it's available to anyone who can see the form.
 */
export const useGetDetailedAnalytics = (formId: string) => {
  const {
    data: detailedAnalytics,
    error,
    isLoading,
    isError,
    refetch,
  } = trpc.analytics.getDetailedAnalytics.useQuery(
    { formId },
    { enabled: !!formId && formId.length === 36, retry: false },
  );

  return { detailedAnalytics, error, isLoading, isError, refetch };
};
