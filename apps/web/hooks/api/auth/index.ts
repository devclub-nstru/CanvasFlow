import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const useSignUp = () => {
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const createUserWithEmailAndPassword = async (
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
      const res = await fetch(`${apiURL}/api/auth/signup/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
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
    createUserWithEmailAndPassword,
    error,
    isPending,
  };
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
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
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
          "Accept": "application/json",
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

  /* `allDevices` ends every session for the account, not just this browser. */
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
        /* Required, and previously missing.
         *
         * web and api are separate origins, so without credentials the browser
         * neither sends cf_jwt nor honours the Set-Cookie that clears it. The
         * server therefore could not see which session to end — which is why
         * this used to hand-clear cf_session in JS below while the httpOnly
         * cf_jwt cookie survived in the browser. Now that sign-out actually
         * revokes the session server-side, the cookie has to reach it. */
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
