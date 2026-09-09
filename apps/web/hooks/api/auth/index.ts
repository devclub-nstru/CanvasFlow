import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface SignUpStarted {
  status: "verification_required";
  email: string;
  expiresInMinutes: number;
  delivery: "sent" | "not-configured";
}

export const useSignUp = () => {
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const createUserWithEmailAndPassword = async (
    data: any,
    options?: { onSuccess?: (result: SignUpStarted) => void; onError?: (err: Error) => void },
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

      options?.onSuccess?.(resData as SignUpStarted);
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

export class SignupRestartRequired extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignupRestartRequired";
  }
}

export const useVerifySignup = () => {
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const verifySignup = async (email: string, code: string): Promise<void> => {
    setIsPending(true);
    try {
      const res = await fetch(`${apiOrigin()}/api/auth/verify-signup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data.error || "Could not confirm your email address.";
        throw data.restart ? new SignupRestartRequired(message) : new Error(message);
      }

      document.cookie = `cf_session=1; path=/; max-age=${60 * 60 * 24 * 7}; secure; samesite=lax`;
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    } finally {
      setIsPending(false);
    }
  };

  return { verifySignup, isPending };
};

export const useResendSignupCode = () => {
  const [isPending, setIsPending] = useState(false);

  const resendSignupCode = async (
    email: string,
  ): Promise<{ message: string; configured: boolean }> => {
    setIsPending(true);
    try {
      const res = await fetch(`${apiOrigin()}/api/auth/resend-signup-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send a new code.");

      return {
        message: data.message ?? "A new code is on its way.",
        configured: data.delivery !== "not-configured",
      };
    } finally {
      setIsPending(false);
    }
  };

  return { resendSignupCode, isPending };
};

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

export const useSendVerificationEmail = () => {
  const [isPending, setIsPending] = useState(false);

  const sendVerificationEmail = async (): Promise<{ message: string; configured: boolean }> => {
    setIsPending(true);
    try {
      const res = await fetch(`${apiOrigin()}/api/auth/send-verification-email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send the confirmation email.");

      return {
        message: data.message ?? "Confirmation email sent.",
        configured: data.delivery !== "not-configured",
      };
    } finally {
      setIsPending(false);
    }
  };

  return { sendVerificationEmail, isPending };
};
