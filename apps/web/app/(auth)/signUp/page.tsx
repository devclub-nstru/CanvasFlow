"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Field, PasswordField, SocialButtons } from "~/components/auth/AuthFields";
import { useResendSignupCode, useSignUp, useVerifySignup } from "~/hooks/api/auth";
import { safeRedirect } from "~/lib/utils";

const createUserWithEmailAndPasswordInputModel = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(200, "Password must be at most 200 characters"),
});

type SignUpValues = z.infer<typeof createUserWithEmailAndPasswordInputModel>;

function SignUpForm() {
  const searchParams = useSearchParams();
  const { createUserWithEmailAndPassword, isPending } = useSignUp();
  const { verifySignup, isPending: isVerifying } = useVerifySignup();
  const { resendSignupCode, isPending: isResending } = useResendSignupCode();

  /* Step one collects the details and asks for a code; step two exchanges the
   * code for the account. `pendingEmail` is what separates the two — it is set
   * only once the server has confirmed a code is on its way. */
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState<string | null>(null);
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(createUserWithEmailAndPasswordInputModel),
    defaultValues: { fullName: "", email: "", password: "" },
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

  const onSubmit = (data: SignUpValues) =>
    createUserWithEmailAndPassword(data, {
      onSuccess: (result) => {
        setPendingEmail(result.email);
        setCode("");
        setCodeError(null);
        toast.success("We've emailed you a confirmation code.");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start sign-up. Please try again.");
      },
    });

  const onVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEmail) return;
    setCodeError(null);
    verifySignup(
      { email: pendingEmail, code },
      {
        onSuccess: () => {
          toast.success("Account created.");
          window.location.assign(redirectTo);
        },
        onError: (error) => {
          setCodeError(error.message || "That code is not right.");
        },
      },
    );
  };

  const onResend = () => {
    if (!pendingEmail) return;
    resendSignupCode(pendingEmail, {
      onSuccess: () => toast.success("If that sign-up is still open, a new code is on its way."),
      onError: (error) => toast.error(error.message || "Could not send a new code."),
    });
  };

  const busy = isPending || isSocialPending;

  /* ── Step two ──────────────────────────────────────────────────────────
   * Rendered instead of the form once a code has been sent. It is a separate
   * return rather than a branch inside the markup so the two screens share no
   * accidental state. */
  if (pendingEmail) {
    return (
      <>
        <div className="mb-9">
          <p
            className="hex-mono mb-4 text-[11px] font-bold tracking-[0.2em] uppercase"
            style={{ color: "var(--hex-ink-muted)" }}
          >
            Confirm your email
          </p>
          <h2 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.03em] sm:text-[44px] sm:leading-[1.02] sm:tracking-[-0.035em]">
            Check your inbox
            <span style={{ color: "var(--c-blue)" }}>.</span>
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
            We sent a 6-digit code to <strong>{pendingEmail}</strong>. Your account is created once
            you enter it.
          </p>
        </div>

        <form onSubmit={onVerify} className="flex flex-col gap-5" noValidate>
          <div>
            <label htmlFor="signup-code" className="mb-2 block text-[13px] font-medium">
              Confirmation code
            </label>
            <input
              id="signup-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setCodeError(null);
              }}
              placeholder="000000"
              autoFocus
              aria-invalid={!!codeError}
              aria-describedby={codeError ? "signup-code-error" : undefined}
              className="hex-mono w-full border px-4 py-3 text-center text-[28px] tracking-[0.4em] outline-none"
              style={{
                borderColor: codeError ? "var(--c-red, #c0392b)" : "var(--hex-line-strong)",
                background: "var(--hex-surface)",
              }}
            />
            {codeError && (
              <p
                id="signup-code-error"
                role="alert"
                className="mt-2 text-[12.5px]"
                style={{ color: "var(--c-red, #c0392b)" }}
              >
                {codeError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isVerifying || code.length !== 6}
            className="hex-btn-primary h-13.5 w-full text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isVerifying ? (
              <span
                className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden
              />
            ) : (
              <>
                Create account
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onResend}
            disabled={isResending}
            className="text-[13px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70 disabled:opacity-50"
          >
            {isResending ? "Sending..." : "Send a new code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingEmail(null);
              setCode("");
              setCodeError(null);
            }}
            className="text-[13px] transition-opacity hover:opacity-70"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            Use a different email
          </button>
        </div>

        <p
          className="mt-8 text-center text-[11px] leading-relaxed"
          style={{ color: "var(--hex-ink-muted)" }}
        >
          The code expires in 15 minutes. Nothing is created until you enter it, so you can close
          this page and start again later.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="mb-9">
        <p
          className="hex-mono mb-4 text-[11px] font-bold tracking-[0.2em] uppercase"
          style={{ color: "var(--hex-ink-muted)" }}
        >
          Registration
        </p>
        <h2 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.03em] sm:text-[44px] sm:leading-[1.02] sm:tracking-[-0.035em]">
          Get started
          <span style={{ color: "var(--c-blue)" }}>.</span>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
          We&apos;ll email you a 6-digit code to confirm your address.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <Field
          id="fullName"
          label="Display name"
          type="text"
          placeholder="Your name"
          register={register("fullName")}
          error={errors.fullName?.message}
          autoComplete="name"
        />

        <Field
          id="email"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          register={register("email")}
          error={errors.email?.message}
          autoComplete="email"
        />

        <PasswordField
          id="password"
          label="Password"
          placeholder="••••••••"
          register={register("password")}
          error={errors.password?.message}
          autoComplete="new-password"
          hint="Minimum 12 characters"
        />

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
              Continue
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
          Already have an account?
        </span>
        <Link
          href={
            redirectTo === "/dashboard"
              ? `/signIn${switchAccount ? "?switch=1" : ""}`
              : `/signIn?redirect=${encodeURIComponent(redirectTo)}${switchAccount ? "&switch=1" : ""}`
          }
          className="text-[13px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
        >
          Sign in
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

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
