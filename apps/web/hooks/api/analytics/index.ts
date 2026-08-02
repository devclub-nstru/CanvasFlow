import { trpc } from "~/trpc/client";

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
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );

  return { analytics, error, isLoading, isError, isSuccess, refetch };
};

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

export const useRecordFieldAnswer = () => {
  const {
    mutate: recordFieldAnswer,
    mutateAsync: recordFieldAnswerAsync,
    isPending,
  } = trpc.analytics.recordFieldAnswer.useMutation();

  return { recordFieldAnswer, recordFieldAnswerAsync, isPending };
};

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
