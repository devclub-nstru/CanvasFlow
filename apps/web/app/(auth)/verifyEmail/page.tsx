"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MailCheck } from "lucide-react";
import { toast } from "sonner";

import {
  SignupRestartRequired,
  useResendSignupCode,
  useVerifySignup,
} from "~/hooks/api/auth";
import {
  clearPendingSignup,
  readPendingSignup,
  RESEND_COOLDOWN_SECONDS,
} from "~/lib/pending-signup";

const CODE_LENGTH = 6;

export default function VerifyEmailPage() {
  const router = useRouter();
  const { verifySignup, isPending: isVerifying } = useVerifySignup();
  const { resendSignupCode, isPending: isResending } = useResendSignupCode();

  const [pending, setPending] = React.useState<ReturnType<typeof readPendingSignup>>(null);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setPending(readPendingSignup());
    setHydrated(true);
  }, []);

  const [digits, setDigits] = React.useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const [cooldown, setCooldown] = React.useState(RESEND_COOLDOWN_SECONDS);
  const inputs = React.useRef<Array<HTMLInputElement | null>>([]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  React.useEffect(() => {
    if (hydrated && pending) inputs.current[0]?.focus();
  }, [hydrated, pending]);

  const code = digits.join("");

  const submit = React.useCallback(
    async (submitted: string) => {
      if (!pending || submitted.length !== CODE_LENGTH) return;

      try {
        await verifySignup(pending.email, submitted);
        clearPendingSignup();
        toast.success("Account created. Welcome to CanvasFlow.");
        router.push(pending.redirect);
      } catch (err) {
        if (err instanceof SignupRestartRequired) {
          clearPendingSignup();
          toast.error(err.message);
          router.push("/signUp");
          return;
        }

        toast.error(err instanceof Error ? err.message : "Could not confirm your email address.");
        setDigits(Array(CODE_LENGTH).fill(""));
        inputs.current[0]?.focus();
      }
    },
    [pending, router, verifySignup],
  );

  const applyDigits = (next: string[], focusIndex: number) => {
    setDigits(next);

    const joined = next.join("");
    if (joined.length === CODE_LENGTH && next.every(Boolean)) {
      void submit(joined);
      return;
    }

    inputs.current[Math.min(focusIndex, CODE_LENGTH - 1)]?.focus();
  };

  const handleChange = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;

    const next = [...digits];

    for (let offset = 0; offset < typed.length && index + offset < CODE_LENGTH; offset += 1) {
      next[index + offset] = typed[offset]!;
    }

    applyDigits(next, index + typed.length);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];

      if (next[index]) {
        next[index] = "";
        setDigits(next);
        return;
      }

      if (index > 0) {
        next[index - 1] = "";
        setDigits(next);
        inputs.current[index - 1]?.focus();
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;

    event.preventDefault();
    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i += 1) next[i] = pasted[i]!;
    applyDigits(next, pasted.length);
  };

  const handleResend = async () => {
    if (!pending || cooldown > 0) return;

    try {
      const { message, configured } = await resendSignupCode(pending.email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();

      if (configured) {
        toast.success(message);
      } else {
        toast.warning("Email delivery is not configured on the server, so nothing was sent.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send a new code.");
    }
  };

  if (hydrated && !pending) {
    return (
      <>
        <div className="mb-9">
          <p
            className="hex-mono mb-4 text-[11px] font-bold tracking-[0.2em] uppercase"
            style={{ color: "var(--hex-ink-muted)" }}
          >
            Confirmation
          </p>
          <h2 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.03em] sm:text-[40px]">
            Nothing to confirm
            <span style={{ color: "var(--c-blue)" }}>.</span>
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
            We don&apos;t have a sign-up in progress in this tab. Start again and we&apos;ll send a
            fresh code.
          </p>
        </div>

        <Link
          href="/signUp"
          className="hex-btn-primary h-13.5 w-full text-[15px]"
        >
          Back to sign-up
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
          Confirmation
        </p>
        <h2 className="text-[32px] leading-[1.04] font-semibold tracking-[-0.03em] sm:text-[44px] sm:leading-[1.02]">
          Check your email
          <span style={{ color: "var(--c-blue)" }}>.</span>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--hex-ink-soft)" }}>
          We sent a six-digit code to{" "}
          <span className="font-semibold" style={{ color: "var(--hex-ink)" }}>
            {pending?.email}
          </span>
          . Enter it below to finish creating your account.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(code);
        }}
        className="flex flex-col gap-6"
        noValidate
      >
        <div>
          <span
            className="hex-mono mb-1.5 block text-[10px] font-bold tracking-[0.18em] uppercase"
            style={{ color: "var(--hex-ink-muted)" }}
            id="code-label"
          >
            Confirmation code
          </span>

          <div
            role="group"
            aria-labelledby="code-label"
            className="flex items-center gap-2 sm:gap-2.5"
          >
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputs.current[index] = element;
                }}
                value={digit}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                onFocus={(event) => event.target.select()}
                /* text, not number: a number input brings spinners, accepts
                 * "e" and "-", and its value is unusable for a fixed-width
                 * code. inputMode gets the numeric keypad on a phone anyway. */
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={CODE_LENGTH}
                aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
                disabled={isVerifying}
                className="hex-line-strong h-14 w-full min-w-0 border bg-white text-center font-mono text-[22px] font-semibold tabular-nums outline-none transition-shadow focus:shadow-[3px_3px_0_0_rgba(26,29,41,0.14)] disabled:opacity-50 sm:h-16 sm:text-[26px]"
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isVerifying || code.length !== CODE_LENGTH}
          className="hex-btn-primary h-13.5 w-full text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isVerifying ? (
            <span
              className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden
            />
          ) : (
            <>
              <MailCheck size={15} />
              Confirm and create account
            </>
          )}
        </button>
      </form>

      <div className="mt-8 flex flex-col items-center gap-2">
        <p className="text-[13px]" style={{ color: "var(--hex-ink-soft)" }}>
          Didn&apos;t get it? Check your spam folder.
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
          className="text-[13px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
        >
          {isResending
            ? "Sending…"
            : cooldown > 0
              ? `Send a new code in ${cooldown}s`
              : "Send a new code"}
        </button>
      </div>

      <p
        className="mt-6 text-center text-[11px] leading-relaxed"
        style={{ color: "var(--hex-ink-muted)" }}
      >
        Wrong address?{" "}
        <Link
          href="/signUp"
          onClick={clearPendingSignup}
          className="underline underline-offset-2 hover:opacity-70"
        >
          Start over
        </Link>
        . Your account isn&apos;t created until the code is confirmed.
      </p>
    </>
  );
}
