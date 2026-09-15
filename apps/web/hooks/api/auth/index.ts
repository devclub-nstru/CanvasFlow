import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/* Step one no longer creates the account, so it cannot return a user. It
 * reports that a code is on its way and the caller moves to the code screen. */
export interface SignUpPendingResult {
  status: "pending";
  email: string;
  expiresInMinutes: number;
}

export interface SignUpResult {
  status: "success";
  user: { id: string; email: string; name: string };
}

/** Strips a trailing /trpc so the auth routes resolve from either form. */
function authBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return raw.endsWith("/trpc") ? raw.replace(/\/trpc$/, "") : raw;
}

export const useSignUp = () => {
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const createUserWithEmailAndPassword = async (
    data: any,
    options?: {
      onSuccess?: (result: SignUpPendingResult) => void;
      onError?: (err: Error) => void;
    },
  ) => {
    setIsPending(true);
    setError(null);
    try {
      let apiURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      if (apiURL.endsWith("/trpc")) {
        apiURL = apiURL.replace(/\/trpc$/, "");
      }
      const res = await fetch(`${apiURL}/api/auth/signup/email`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.fullName,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to sign up");
      }

      /* No cookie and no session invalidation here: the account does not exist
       * until the code is confirmed. That happens in useVerifySignup. */
      options?.onSuccess?.(resData as SignUpPendingResult);
    } catch (err: any) {
      setError(err);
      options?.onError?.(err);
    } finally {
      setIsPending(false);
    }
  };

  return {
    createUserWithEmailAndPassword,
    error,
    isPending,
  };
};

export type UserRole = "user" | "admin" | "superadmin";

/** Roles that may reach /admin. */
export const ADMIN_ROLES: readonly UserRole[] = ["admin", "superadmin"];

export function isAdminRole(role: string | null | undefined): boolean {
  return ADMIN_ROLES.includes(role as UserRole);
}

/**
 * Step two — exchange the emailed code for an account and a session.
 *
 * This is where the session cookie appears, so it is also where the cached
 * session query has to be invalidated.
 */
export const useVerifySignup = () => {
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const verifySignup = async (
    data: { email: string; code: string },
    options?: { onSuccess?: (result: SignUpResult) => void; onError?: (err: Error) => void },
  ) => {
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch(`${authBaseUrl()}/api/auth/signup/verify`, {
        method: "POST",
        /* The account is created and signed in by this request, so its
         * Set-Cookie has to be accepted. */
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to confirm the code");

      document.cookie = `cf_session=1; path=/; max-age=${60 * 60 * 24 * 7}; secure; samesite=lax`;
      await queryClient.invalidateQueries({ queryKey: ["session"] });

      options?.onSuccess?.(resData as SignUpResult);
    } catch (err: any) {
      setError(err);
      options?.onError?.(err);
    } finally {
      setIsPending(false);
    }
  };

  return { verifySignup, error, isPending };
};

/** Ask for a fresh code when the first one did not arrive. */
export const useResendSignupCode = () => {
  const [isPending, setIsPending] = useState(false);

  const resendSignupCode = async (
    email: string,
    options?: { onSuccess?: () => void; onError?: (err: Error) => void },
  ) => {
    setIsPending(true);
    try {
      const res = await fetch(`${authBaseUrl()}/api/auth/signup/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to send a new code");

      options?.onSuccess?.();
    } catch (err: any) {
      options?.onError?.(err);
    } finally {
      setIsPending(false);
    }
  };

  return { resendSignupCode, isPending };
};

export const useSignIn = () => {
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const signInUserWithEmailAndPassword = async (
    data: any,
    options?: { onSuccess?: () => void; onError?: (err: Error) => void },
  ) => {
    setIsPending(true);
    setError(null);
    try {
      let apiURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      if (apiURL.endsWith("/trpc")) {
        apiURL = apiURL.replace(/\/trpc$/, "");
      }
      const res = await fetch(`${apiURL}/api/auth/signin/email`, {
        method: "POST",
        /* Without this the browser drops the Set-Cookie on a cross-origin
         * response, so `cf_jwt` — the cookie that actually carries the session
         * — is never stored. The `cf_session=1` marker set just below is only
         * a hint for the middleware, which is why signing in *looked* like it
         * worked: the middleware let you through while the API still saw an
         * anonymous caller. */
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to sign in");
      }

      document.cookie = `cf_session=1; path=/; max-age=${60 * 60 * 24 * 7}; secure; samesite=lax`;
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      options?.onSuccess?.();
    } catch (err: any) {
      setError(err);
      options?.onError?.(err);
    } finally {
      setIsPending(false);
    }
  };

  return {
    signInUserWithEmailAndPassword,
    error,
    isPending,
  };
};

export const useGetLoggedInUserInfo = () => {
  const { data, error, isLoading } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      let apiURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      if (apiURL.endsWith("/trpc")) {
        apiURL = apiURL.replace(/\/trpc$/, "");
      }
      const res = await fetch(`${apiURL}/api/auth/get-session`, {
        headers: {
          Accept: "application/json",
        },
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error("Failed to get session");
      }
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    userInfo: data?.user
      ? {
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.name,
          role: (data.user.role ?? "user") as UserRole,
        }
      : null,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    isPending: isLoading,
  };
};

export const useSignOut = () => {
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const signOutAsync = async (options?: { allDevices?: boolean }) => {
    setIsPending(true);
    setError(null);
    try {
      let apiURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      if (apiURL.endsWith("/trpc")) {
        apiURL = apiURL.replace(/\/trpc$/, "");
      }

      const path = options?.allDevices ? "/api/auth/signout-all" : "/api/auth/signout";

      const res = await fetch(`${apiURL}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error("Failed to sign out");
      }

      document.cookie =
        "cf_session=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=lax";
      await queryClient.setQueryData(["session"], null);
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    } catch (err: any) {
      setError(err);
    } finally {
      setIsPending(false);
    }
  };

  return {
    signOutAsync,
    error,
    isPending,
  };
};

function apiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return raw.endsWith("/trpc") ? raw.replace(/\/trpc$/, "") : raw;
}

export const useForgotPassword = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const requestReset = async (email: string): Promise<string> => {
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch(`${apiOrigin()}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send the reset link.");

      return data.message ?? "If an account exists for that address, a reset link is on its way.";
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  return { requestReset, isPending, error };
};

export const useResetPassword = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const resetPassword = async (token: string, password: string): Promise<string> => {
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch(`${apiOrigin()}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not reset the password.");

      return data.message ?? "Password updated.";
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  return { resetPassword, isPending, error };
};
