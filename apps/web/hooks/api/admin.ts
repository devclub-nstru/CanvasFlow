import { trpc } from "~/trpc/client";

export type StatsRange = 7 | 30 | 90;

export const usePlatformStats = (days: StatsRange = 30, enabled = true) => {
  const { data, isLoading, error } = trpc.admin.platformStats.useQuery(
    { days },
    { enabled, staleTime: 30_000 },
  );

  return { stats: data, isLoading, error };
};

/* ── User management ─────────────────────────────────────────────────────── */

export interface UserFilters {
  query?: string;
  role?: "user" | "admin" | "superadmin";
  suspended?: boolean;
}

export const USERS_PER_PAGE = 25;

export const useListUsers = (filters: UserFilters = {}, page = 0, enabled = true) => {
  const { data, isLoading } = trpc.admin.listUsers.useQuery(
    { ...filters, limit: USERS_PER_PAGE, offset: page * USERS_PER_PAGE },
    { enabled, staleTime: 15_000, placeholderData: (prev) => prev },
  );
  return {
    users: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    pageCount: Math.max(1, Math.ceil((data?.total ?? 0) / USERS_PER_PAGE)),
  };
};

export const useUserDetail = (userId: string | null) => {
  const { data, isLoading } = trpc.admin.getUserDetail.useQuery(
    { userId: userId ?? "" },
    { enabled: !!userId, staleTime: 10_000 },
  );
  return { user: data, isLoading };
};

export const usePendingSignups = (enabled = true) => {
  const { data, isLoading } = trpc.admin.listPendingSignups.useQuery(undefined, {
    enabled,
    staleTime: 15_000,
  });
  return { pending: data ?? [], isLoading };
};

function useAdminUserMutations() {
  const utils = trpc.useUtils();
  const invalidate = () => {
    void utils.admin.listUsers.invalidate();
    void utils.admin.getUserDetail.invalidate();
    void utils.admin.platformStats.invalidate();
    void utils.admin.listAudit.invalidate();
  };
  return { invalidate, utils };
}

export const useSetSuspended = () => {
  const { invalidate } = useAdminUserMutations();
  const { mutateAsync, isPending } = trpc.admin.setSuspended.useMutation({ onSuccess: invalidate });
  return { setSuspendedAsync: mutateAsync, isPending };
};

export const useForceSignOut = () => {
  const { invalidate } = useAdminUserMutations();
  const { mutateAsync, isPending } = trpc.admin.forceSignOut.useMutation({ onSuccess: invalidate });
  return { forceSignOutAsync: mutateAsync, isPending };
};

export const useSendPasswordReset = () => {
  const { mutateAsync, isPending } = trpc.admin.sendPasswordReset.useMutation();
  return { sendPasswordResetAsync: mutateAsync, isPending };
};

/* ── Audit log ───────────────────────────────────────────────────────────── */

export const AUDIT_PER_PAGE = 50;

export const useAuditLog = (
  opts: {
    targetUserId?: string;
    category?: "user" | "admin" | "feedback" | "signup";
    page?: number;
    limit?: number;
  } = {},
  enabled = true,
) => {
  const limit = opts.limit ?? AUDIT_PER_PAGE;
  const page = opts.page ?? 0;

  const { data, isLoading } = trpc.admin.listAudit.useQuery(
    { targetUserId: opts.targetUserId, category: opts.category, limit, offset: page * limit },
    { enabled, staleTime: 10_000, placeholderData: (prev) => prev },
  );

  return {
    entries: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    pageCount: Math.max(1, Math.ceil((data?.total ?? 0) / limit)),
  };
};

/* ── Pending signup actions ──────────────────────────────────────────────── */

export const usePendingSignupActions = () => {
  const utils = trpc.useUtils();
  const refresh = () => {
    void utils.admin.listPendingSignups.invalidate();
    void utils.admin.listAudit.invalidate();
  };

  const resend = trpc.admin.resendSignupCode.useMutation({ onSuccess: refresh });
  const remove = trpc.admin.deletePendingSignup.useMutation({ onSuccess: refresh });

  return {
    resendAsync: resend.mutateAsync,
    deleteAsync: remove.mutateAsync,
    isPending: resend.isPending || remove.isPending,
  };
};
