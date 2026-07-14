import { trpc } from "~/trpc/client";

export type UserPlan = "Free" | "Pro" | "Pro+" | "Business";

/**
 * Fetches the current user's profile including their subscription plan.
 * Use this to gate Pro+/Business features on the frontend.
 */
export const useGetMe = () => {
  const { data, isLoading, error } = trpc.user.getMe.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 min — plan rarely changes
    retry: false,
  });

  const plan: UserPlan = data?.plan ?? "Free";
  const hasDetailedAnalytics = plan === "Pro+" || plan === "Business";

  return {
    me: data,
    plan,
    hasDetailedAnalytics,
    isLoading,
    error,
  };
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
