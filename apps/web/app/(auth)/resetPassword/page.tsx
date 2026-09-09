"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { PasswordField } from "~/components/auth/AuthFields";
import { useResetPassword } from "~/hooks/api/auth";

const ResetPasswordInputModel = z
  .object({
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(200, "Password must be at most 200 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof ResetPasswordInputModel>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const { resetPassword, isPending } = useResetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(ResetPasswordInputModel),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetPasswordValues) => {
    if (!token) return;
    try {
      const message = await resetPassword(token, data.password);
      toast.success(message);
      router.push("/signIn");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset the password.");
    }
  };

  if (!token) {
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
            Link incomplete
            <span style={{ color: "var(--c-blue)" }}>.</span>
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
            This page needs the reset token from your email. Open the link from the message
            directly, or request a new one.
          </p>
        </div>

        <Link
          href="/forgotPassword"
          className="hex-btn-primary flex h-13.5 w-full items-center justify-center gap-2 text-[15px]"
        >
          Request a new link
          <ArrowRight size={15} />
        </Link>
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
          Choose a new password
          <span style={{ color: "var(--c-blue)" }}>.</span>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
          At least 12 characters. Saving it signs you out on every other device.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <PasswordField
          id="password"
          label="New password"
          placeholder="••••••••••••"
          register={register("password")}
          error={errors.password?.message}
          autoComplete="new-password"
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          placeholder="••••••••••••"
          register={register("confirmPassword")}
          error={errors.confirmPassword?.message}
          autoComplete="new-password"
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
              Save new password
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
