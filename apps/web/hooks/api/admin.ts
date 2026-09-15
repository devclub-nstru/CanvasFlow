import { trpc } from "~/trpc/client";

export type StatsRange = 7 | 30 | 90;

/* Platform-wide counts for the admin overview. Refused with FORBIDDEN for
 * anyone who isn't an admin, so `enabled` only avoids a pointless request —
 * it is not what keeps the numbers private. */
export const usePlatformStats = (days: StatsRange = 30, enabled = true) => {
  const { data, isLoading, error } = trpc.admin.platformStats.useQuery(
    { days },
    { enabled, staleTime: 30_000 },
  );

  return { stats: data, isLoading, error };
};
