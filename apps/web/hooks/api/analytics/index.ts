import { trpc } from "~/trpc/client";
import { drainPages } from "~/lib/pagination";

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

  const fetchAllSubmissions = async () => {
    if (!result.hasNextPage) return submissions;

    const page = await drainPages(await result.fetchNextPage());

    return page.data?.pages.flatMap((p) => p.submissions) ?? submissions;
  };

  return {
    submissions,
    fetchAllSubmissions,
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

export const useDeleteSubmission = () => {
  const utils = trpc.useUtils();
  const {
    mutateAsync: deleteSubmissionAsync,
    isPending,
    error,
  } = trpc.form.deleteSubmission.useMutation({
    onSuccess: (_data, variables) => {
      void utils.form.getSubmissions.invalidate({ formId: variables.formId });
      void utils.form.getForm.invalidate({ id: variables.formId });
    },
  });

  return {
    deleteSubmissionAsync,
    isPending,
    error,
  };
};
