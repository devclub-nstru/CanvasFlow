"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSignIn } from "~/hooks/api/auth";
import { authClient } from "~/lib/auth-client";
import { toast } from "sonner";

const SignInUserWithEmailAndPasswordInputModel = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignInValues = z.infer<typeof SignInUserWithEmailAndPasswordInputModel>;

export default function SignInPage() {
  const router = useRouter();
  const { signInUserWithEmailAndPassword, isPending } = useSignIn();
  const [isSocialPending, setIsSocialPending] = React.useState(false);

  const handleSocialSignIn = async (provider: "google" | "github") => {
    setIsSocialPending(true);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: window.location.origin + "/auth/callback",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate social login.");
      setIsSocialPending(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(SignInUserWithEmailAndPasswordInputModel),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: SignInValues) => {
    try {
      await signInUserWithEmailAndPassword(data);
      toast.success("Signed in. Welcome back.");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in. Please try again.");
    }
  };

  return (
    <div className="flex flex-col justify-between h-full w-full">
      {/* top eyebrow */}
      <div className="flex justify-between items-center">
        <span className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Studio · Sign in</span>
      </div>

      {/* form */}
      <div className="my-auto py-8 w-full">
        <div className="mx-auto w-full max-w-md">
          <h1 className="cf-display text-[40px] sm:text-[48px] leading-[0.95]">Welcome back</h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-[color:var(--cf-ink-soft)]">
            Pick up where you left off. Sign in to open your studio.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-9 space-y-5">
            <Field
              label="Email"
              type="email"
              placeholder="you@studio.com"
              register={register("email")}
              error={errors.email?.message}
              autoComplete="email"
            />

            <Field
              label="Password"
              type="password"
              placeholder="••••••••"
              register={register("password")}
              error={errors.password?.message}
              autoComplete="current-password"
            />

            <button
              type="submit"
              disabled={isPending}
              className="group mt-2 inline-flex w-full items-center justify-center gap-1.5 h-[48px] px-7 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-full text-[14px] font-medium tracking-tight transition-colors"
            >
              {isPending ? "Opening studio..." : "Open studio"}
              <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </form>

          {/* divider */}
          <div className="relative my-8">
            <hr className="border-[color:var(--cf-line)]" />
            <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[color:var(--cf-cream)] px-4 cf-eyebrow text-[color:var(--cf-ink-soft)]">
              or continue with
            </span>
          </div>

          {/* social */}
          <div className="flex gap-3">
            <SocialButton
              provider="google"
              onClick={() => handleSocialSignIn("google")}
              disabled={isSocialPending}
            />
            <SocialButton
              provider="github"
              onClick={() => handleSocialSignIn("github")}
              disabled={isSocialPending}
            />
          </div>

          {/* footer link */}
          <p className="mt-8 text-center text-[14px] text-[color:var(--cf-ink-soft)]">
            New here?{" "}
            <Link
              href="/signUp"
              className="text-[color:var(--cf-ink)] underline underline-offset-4 decoration-[color:var(--cf-line-strong)] hover:decoration-[color:var(--cf-orange)]"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>

      {/* footer */}
      <div className="flex justify-between items-center text-[11px] font-mono text-[color:var(--cf-ink-soft)]/80 select-none">
        <span>© 2026 CanvasFlow Studio</span>
        <span className="hidden sm:inline">v1.0.0</span>
      </div>
    </div>
  );
}

/* ─── small field primitive ──────────────────────────────────────────── */
function Field({
  label,
  type,
  placeholder,
  register,
  error,
  autoComplete,
}: {
  label: string;
  type: string;
  placeholder?: string;
  register: ReturnType<ReturnType<typeof useForm>["register"]>;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="cf-eyebrow text-[color:var(--cf-ink-soft)] mb-2 block">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        {...register}
        className="w-full bg-white rounded-md ring-1 ring-[color:var(--cf-line-strong)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none px-4 h-[46px] text-[14.5px] text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 transition-shadow"
      />
      {error && <p className="text-[12px] text-[color:var(--cf-orange)] mt-1.5 ml-0.5">{error}</p>}
    </div>
  );
}

/* ─── social button ──────────────────────────────────────────────────── */
function SocialButton({
  provider,
  onClick,
  disabled,
}: {
  provider: "google" | "github";
  onClick: () => void;
  disabled?: boolean;
}) {
  const label = provider === "google" ? "Google" : "GitHub";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 inline-flex items-center justify-center gap-2 h-[44px] px-4 bg-white rounded-full ring-1 ring-[color:var(--cf-line-strong)] hover:bg-[color:var(--cf-cream-2)] text-[13.5px] font-medium text-[color:var(--cf-ink)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      {provider === "google" ? (
        <svg className="size-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      ) : (
        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
      )}
      {label}
    </button>
  );
}
