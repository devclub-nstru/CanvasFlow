import { trpc } from "~/trpc/client";

/** Fetches the current user's profile. */
export const useGetMe = () => {
  const { data, isLoading, error } = trpc.user.getMe.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    me: data,
    isLoading,
    error,
  };
};

/**
 * Updates the signed-in user's display name and/or avatar preset.
 *
 * Both `getMe` caches are refreshed from the mutation's own return value
 * rather than by invalidating and refetching: the procedure returns the full
 * updated user, so a round trip would only re-fetch what we already hold.
 */
export const useUpdateMe = () => {
  const utils = trpc.useUtils();

  const {
    mutateAsync: updateMeAsync,
    isPending,
    error,
  } = trpc.user.updateMe.useMutation({
    onSuccess: (updated) => {
      utils.user.getMe.setData(undefined, updated);
    },
  });

  return { updateMeAsync, isPending, error };
};

export const useSearchUsers = (query: string) => {
  const trimmedQuery = query.trim();
  const {
    data: users,
    isLoading,
    error,
  } = trpc.user.searchUsers.useQuery(
    { query: trimmedQuery },
    {
      enabled: trimmedQuery.length >= 2,
      staleTime: 30 * 1000,
    },
  );

  return {
    users: trimmedQuery.length >= 2 ? (users ?? []) : [],
    isLoading: trimmedQuery.length >= 2 && isLoading,
    error,
  };
};
