"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Field, PasswordField, SocialButtons } from "~/components/auth/AuthFields";
import { useSignIn } from "~/hooks/api/auth";
import { safeRedirect } from "~/lib/utils";

const SignInUserWithEmailAndPasswordInputModel = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type SignInValues = z.infer<typeof SignInUserWithEmailAndPasswordInputModel>;

function readAuthNotice(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)cf_auth_notice=([^;]*)/);
  if (!match?.[1]) return null;

  document.cookie = "cf_auth_notice=; path=/; max-age=0";

  try {
    const value = decodeURIComponent(match[1]).trim();
    return value ? value.slice(0, 300) : null;
  } catch {
    return null;
  }
}

const OAUTH_ERROR_MESSAGE: Record<string, string> = {
  account_suspended: "That account is suspended. Contact support if you think that's wrong.",
  oauth_email_unverified:
    "That provider hasn't verified the email address, and an account already exists for it. Verify it with them, or sign in with your password.",
  oauth_email_missing: "That provider didn't share an email address, so there's nothing to sign in with.",
  oauth_state_mismatch: "That sign-in attempt expired or didn't match. Please try again.",
  oauth_code_missing: "The provider didn't complete the sign-in. Please try again.",
};

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInUserWithEmailAndPassword, isPending } = useSignIn();
  const [isSocialPending, setIsSocialPending] = React.useState(false);

  const switchAccount = searchParams.get("switch") === "1";

  React.useEffect(() => {
    if (switchAccount) {
      let apiURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      if (apiURL.endsWith("/trpc")) {
        apiURL = apiURL.replace(/\/trpc$/, "");
      }
      fetch(`${apiURL}/api/auth/signout`, {
        method: "POST",
        credentials: "include",
      }).finally(() => {
        document.cookie =
          "cf_session=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=lax";
      });
    }
  }, [switchAccount]);

    const redirectTo = safeRedirect(searchParams.get("redirect"));

  const oauthError = searchParams.get("error");
  React.useEffect(() => {
    if (!oauthError) return;

    const notice = readAuthNotice();
    toast.error(
      notice ?? OAUTH_ERROR_MESSAGE[oauthError] ?? "That sign-in didn't work. Please try again.",
    );

    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    window.history.replaceState({}, "", url.toString());
  }, [oauthError]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(SignInUserWithEmailAndPasswordInputModel),
    defaultValues: { email: "", password: "" },
  });

  const handleSocialSignIn = async (provider: "google" | "github") => {
    setIsSocialPending(true);
    try {
      const callback = new URL("/auth/callback", window.location.origin);
      if (redirectTo !== "/dashboard") callback.searchParams.set("redirect", redirectTo);

      let apiURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      if (apiURL.endsWith("/trpc")) {
        apiURL = apiURL.replace(/\/trpc$/, "");
      }
      window.location.href = `${apiURL}/api/auth/login/${provider}?redirect=${encodeURIComponent(callback.toString())}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start social sign-in.");
      setIsSocialPending(false);
    }
  };

  const onSubmit = (data: SignInValues) =>
    signInUserWithEmailAndPassword(data, {
      onSuccess: () => {
        toast.success("Signed in. Welcome back.");
        router.push(redirectTo);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to sign in. Please try again.");
      },
    });

  const busy = isPending || isSocialPending;

  return (
    <>
      <div className="mb-9">
        <p
          className="hex-mono mb-4 text-[11px] font-bold tracking-[0.2em] uppercase"
          style={{ color: "var(--hex-ink-muted)" }}
        >
          Authentication
        </p>
        <h2 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.03em] sm:text-[44px] sm:leading-[1.02] sm:tracking-[-0.035em]">
          Welcome back
          <span style={{ color: "var(--c-blue)" }}>.</span>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
          Sign in to continue to your dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <Field
          id="email"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          register={register("email")}
          error={errors.email?.message}
          autoComplete="email"
        />

        <div>
          <PasswordField
            id="password"
            label="Password"
            placeholder="••••••••"
            register={register("password")}
            error={errors.password?.message}
            autoComplete="current-password"
          />

          <div className="mt-2 flex justify-end">
            <Link
              href="/forgotPassword"
              className="text-[12px] underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: "var(--hex-ink-soft)" }}
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="hex-btn-primary mt-2 h-13.5 w-full text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <span
              className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden
            />
          ) : (
            <>
              Sign in
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

      <div className="my-8 flex items-center gap-4">
        <span className="h-px flex-1" style={{ background: "var(--hex-line)" }} />
        <span
          className="hex-mono text-[10px] tracking-[0.18em] uppercase"
          style={{ color: "var(--hex-ink-muted)" }}
        >
          or
        </span>
        <span className="h-px flex-1" style={{ background: "var(--hex-line)" }} />
      </div>

      <SocialButtons onSelect={handleSocialSignIn} disabled={busy} />

      <div className="mt-8 flex items-center justify-center gap-2">
        <span className="text-[13px]" style={{ color: "var(--hex-ink-soft)" }}>
          Don&rsquo;t have an account?
        </span>
        <Link
          href={
            redirectTo === "/dashboard"
              ? `/signUp${switchAccount ? "?switch=1" : ""}`
              : `/signUp?redirect=${encodeURIComponent(redirectTo)}${switchAccount ? "&switch=1" : ""}`
          }
          className="text-[13px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
        >
          Sign up
        </Link>
      </div>

      <p
        className="mt-5 text-center text-[11px] leading-relaxed"
        style={{ color: "var(--hex-ink-muted)" }}
      >
        By continuing you agree to our{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:opacity-70">
          Privacy Policy
        </Link>
        .
      </p>
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
