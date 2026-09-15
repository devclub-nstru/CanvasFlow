import { trpc } from "~/trpc/client";

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

/* ── Role management (superadmin only) ───────────────────────────────────
 *
 * Every one of these fails with FORBIDDEN for anyone who isn't a superadmin,
 * so the UI hiding them is a courtesy, not the control. */

export const useListAdmins = (enabled = true) => {
  const { data, isLoading, error } = trpc.user.listAdmins.useQuery(undefined, {
    enabled,
    staleTime: 15_000,
  });
  return { admins: data ?? [], isLoading, error };
};

export const useAddAdmin = () => {
  const utils = trpc.useUtils();
  const { mutateAsync, isPending } = trpc.user.addAdmin.useMutation({
    onSuccess: () => void utils.user.listAdmins.invalidate(),
  });
  return { addAdminAsync: mutateAsync, isPending };
};

export const useRemoveAdmin = () => {
  const utils = trpc.useUtils();
  const { mutateAsync, isPending } = trpc.user.removeAdmin.useMutation({
    onSuccess: () => void utils.user.listAdmins.invalidate(),
  });
  return { removeAdminAsync: mutateAsync, isPending };
};

/* Candidates for promotion. Accounts that already have access are filtered out
 * server-side, so an empty result for a real name means "they already have it"
 * as often as "no such person" — the page says so. */
export const useSearchAdminCandidates = (query: string, enabled = true) => {
  const trimmed = query.trim();
  const { data, isFetching } = trpc.user.searchAdminCandidates.useQuery(
    { query: trimmed },
    { enabled: enabled && trimmed.length >= 2, staleTime: 10_000 },
  );
  return { candidates: data ?? [], isSearching: isFetching };
};
