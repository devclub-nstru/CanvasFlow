import { trpc } from "~/trpc/client";

/**
 * Fetches all free-tier analytics metrics for a single form.
 *
 * Returns exactly: totalResponses, totalViews, completionRate, deviceViews,
 * dailyTrends (30d), peakDay, avgSubmissionsPerDay, avgSubmissionsPerWeek.
 *
 * This list previously also claimed `hourlyDistribution` and `peakHour`. The
 * service returns neither — see getFormAnalytics in packages/services/analytics.
 * Do not build an hour-of-day chart on this hook without adding them there
 * first.
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
 * Records a view for a public form page.
 */
export const useRecordView = () => {
  const {
    mutateAsync: recordViewAsync,
    mutate: recordView,
    error,
    isPending,
    isSuccess,
  } = trpc.analytics.recordView.useMutation();

  return { recordViewAsync, recordView, error, isPending, isSuccess };
};

/**
 * Pro-tier: per-question distribution, day-of-week breakdown,
 * 30/60/90d trend totals, response velocity.
 * Only call this when you've already confirmed the user has Pro+/Business plan
 * via useGetMe — the server will still enforce it, but the client gates first.
 */
export const useGetProAnalytics = (formId: string) => {
  const {
    data: proAnalytics,
    error,
    isLoading,
    isError,
    refetch,
  } = trpc.analytics.getProAnalytics.useQuery(
    { formId },
    { enabled: !!formId && formId.length === 36, retry: false },
  );

  return { proAnalytics, error, isLoading, isError, refetch };
};

/**
 * Returns the current user's plan from the session (via the form list endpoint
 * which already fetches forms per-user). We derive plan from the auth session
 * on the server; here we just check if the Pro analytics query returns FORBIDDEN.
 */
export const useUserPlan = () => {
  const { data } = trpc.form.listFormsByUserId.useQuery();
  // plan is not directly exposed — use isForbidden from useGetProAnalytics instead
  // This hook is a placeholder for when plan is exposed on the context.
  return { hasPro: false, hasData: !!data };
};
