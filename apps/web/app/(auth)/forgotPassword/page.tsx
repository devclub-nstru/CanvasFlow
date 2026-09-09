"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Field } from "~/components/auth/AuthFields";
import { useForgotPassword } from "~/hooks/api/auth";

const ForgotPasswordInputModel = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordValues = z.infer<typeof ForgotPasswordInputModel>;

export default function ForgotPasswordPage() {
  const { requestReset, isPending } = useForgotPassword();
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(ForgotPasswordInputModel),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordValues) => {
    try {
      await requestReset(data.email);
      setSentTo(data.email);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the reset link.");
    }
  };

  if (sentTo) {
    return (
      <>
        <div className="mb-9">
          <p
            className="hex-mono mb-4 text-[11px] font-bold tracking-[0.2em] uppercase"
            style={{ color: "var(--hex-ink-muted)" }}
          >
            Check your inbox
          </p>
          <h2 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.03em] sm:text-[44px] sm:leading-[1.02] sm:tracking-[-0.035em]">
            Link sent
            <span style={{ color: "var(--c-blue)" }}>.</span>
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
            If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. It
            expires in an hour and can be used once.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--hex-ink-muted)" }}>
            Nothing arrived? Check your spam folder, then try again — requesting a new link
            replaces the old one.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="hex-btn-primary h-13.5 w-full text-[15px]"
        >
          Send another link
        </button>

        <div className="mt-8 flex items-center justify-center gap-2">
          <Link
            href="/signIn"
            className="text-[13px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
          >
            Back to sign in
          </Link>
        </div>
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
          Password reset
        </p>
        <h2 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.03em] sm:text-[44px] sm:leading-[1.02] sm:tracking-[-0.035em]">
          Forgot your password
          <span style={{ color: "var(--c-blue)" }}>?</span>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
          Enter the address you signed up with and we&rsquo;ll send you a link to choose a new
          password.
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

        <button
          type="submit"
          disabled={isPending}
          className="hex-btn-primary mt-2 h-13.5 w-full text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <span
              className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden
            />
          ) : (
            <>
              Send reset link
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 flex items-center justify-center gap-2">
        <span className="text-[13px]" style={{ color: "var(--hex-ink-soft)" }}>
          Remembered it?
        </span>
        <Link
          href="/signIn"
          className="text-[13px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
        >
          Sign in
        </Link>
      </div>
    </>
  );
}
