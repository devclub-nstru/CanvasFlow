import { trpc } from "~/trpc/client";

export const useGetSubmissions = (formId: string) => {
  const PAGE_SIZE = 200;
  const enabled = !!formId && formId.length === 36;

  const result = trpc.form.getSubmissions.useInfiniteQuery(
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
