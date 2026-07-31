"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, RotateCcw } from "lucide-react";

interface FormErrorStateProps {
  type:
    | "not-found"
    | "draft-mode"
    | "already-submitted"
    | "closed"
    | "expired"
    | "sign-in-required"
    | "domain-not-allowed";
  /** Domains the form accepts, listed so the respondent knows which account to
   *  use rather than guessing. */
  allowedDomains?: string[];
  /** Where to send someone who needs to sign in — carries a return path so they
   *  land back on the form rather than the dashboard. */
  signInHref?: string;
  /** Offered when the form takes more than one response. */
  onRespondAgain?: () => void;
}

/**
 * The five states a respondent can land on instead of the form.
 *
 * Held as a lookup rather than the nested ternary chain this used to be —
 * six branches deep, it had become hard to read and easy to mis-nest.
 *
 * Copy is intentionally plain. The reference this page was restyled from
 * answers a blocked visitor with jokes ("NICE TRY, FBI.", "403: YOUR BRAIN
 * NOT FOUND."). These screens are shown to the form owner's customers and
 * candidates, who have usually done nothing wrong beyond arriving late.
 */
const STATES: Record<
  FormErrorStateProps["type"],
  { eyebrow: string; title: string; body: string }
> = {
  "draft-mode": {
    eyebrow: "Not live",
    title: "This form is still a draft",
    body: "The author hasn't published it yet, so it isn't accepting responses.",
  },
  "already-submitted": {
    eyebrow: "Already submitted",
    title: "You've responded to this form",
    // Deliberately not "this form accepts one response per person". That's the
    // usual reason for landing here, but the same screen also catches a
    // duplicate submit racing on one idempotency key, which can happen on a
    // form that does accept several responses — and stating a policy that isn't
    // in force is worse than not mentioning it.
    body: "Thanks — we already have your response on file, so there's no need to send it again.",
  },
  "sign-in-required": {
    eyebrow: "Sign in",
    title: "This form needs you signed in",
    body: "The author asked for responses from signed-in accounts, so we can tell respondents apart. Your answers aren't submitted until you do.",
  },
  "domain-not-allowed": {
    eyebrow: "Wrong account",
    title: "This form is limited to a specific organisation",
    body: "Your signed-in email isn't in a domain the author accepts. Sign in with your organisation account and try again.",
  },
  closed: {
    eyebrow: "Closed",
    title: "This form is not accepting responses",
    body: "The author has closed it to new submissions. If you were asked to fill it in, check with whoever sent you the link.",
  },
  expired: {
    eyebrow: "Expired",
    title: "This form is no longer accepting responses",
    body: "It passed its closing date, so submissions are closed. If you were asked to fill it in, check with whoever sent you the link.",
  },

  "not-found": {
    eyebrow: "Not found",
    title: "We can't find this form",
    body: "The form may have been deleted, or the link is incorrect. Double-check the URL.",
  },
};

export function FormErrorState({
  type,
  allowedDomains,
  signInHref,
  onRespondAgain,
}: FormErrorStateProps) {
  const config = STATES[type];
  const hasPrimaryAction = !!signInHref || !!onRespondAgain;

  return (
    <div
      className="cf-landing cf-dotgrid flex min-h-screen w-full items-center justify-center p-6"
      style={{ background: "var(--cf-cream)" }}
    >
      <div
        className="w-full max-w-md border p-8 text-center"
        style={{
          borderColor: "var(--cf-line-strong)",
          background: "var(--cf-cream-2)",
          boxShadow: "5px 5px 0 0 rgba(26, 29, 41, 0.08)",
        }}
      >
        <p
          className="border px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.18em] uppercase"
          style={{
            display: "inline-block",
            borderColor: "var(--cf-orange)",
            color: "var(--cf-orange)",
          }}
        >
          {config.eyebrow}
        </p>
        <h1 className="cf-display mt-5 text-[26px] leading-tight text-(--cf-ink)">
          {config.title}
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-(--cf-ink-soft)">{config.body}</p>

        {/* Naming the accepted domains turns "wrong account" from a dead end
            into an instruction. Subdomains are covered by each entry, which is
            why one line can admit both @uni.edu and @dept.uni.edu. */}
        {allowedDomains && allowedDomains.length > 0 && (
          <div className="mt-5 border px-3 py-2.5 text-left" style={{ borderColor: "var(--cf-line-strong)" }}>
            <p className="cf-meta mb-1.5">Accepted domains</p>
            <ul className="space-y-0.5">
              {allowedDomains.map((domain) => (
                <li key={domain} className="font-mono text-[12px] text-(--cf-ink)">
                  @{domain}
                </li>
              ))}
            </ul>
          </div>
        )}

        {signInHref && (
          <Link
            href={signInHref}
            className="group mt-7 inline-flex h-11 items-center gap-2 border px-5 text-[13.5px] font-semibold text-white transition-all hover:translate-x-px hover:translate-y-px hover:shadow-none"
            style={{
              background: "var(--cf-orange)",
              borderColor: "var(--cf-line-strong)",
              boxShadow: "4px 4px 0 0 var(--cf-line-strong)",
            }}
          >
            Sign in to continue
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        )}

        {onRespondAgain && (
          <button
            type="button"
            onClick={onRespondAgain}
            className="cf-btn cf-raised cf-press mt-7 h-11 px-5 text-[13.5px]"
          >
            <RotateCcw className="size-3.5" />
            Submit another response
          </button>
        )}

        {/* Demoted to a text link whenever the screen already offers the action
            the respondent actually came for. Two filled buttons of equal weight
            would make "Visit CanvasFlow" compete with "Sign in". */}
        {hasPrimaryAction ? (
          <div className="mt-5">
            <Link href="/" className="text-[12.5px] text-(--cf-ink-soft) underline hover:text-(--cf-ink)">
              Visit CanvasFlow
            </Link>
          </div>
        ) : (
          <Link
            href="/"
            className="group mt-7 inline-flex h-11 items-center gap-2 border px-5 text-[13.5px] font-semibold text-white transition-all hover:translate-x-px hover:translate-y-px hover:shadow-none"
            style={{
              background: "var(--cf-orange)",
              borderColor: "var(--cf-line-strong)",
              boxShadow: "4px 4px 0 0 var(--cf-line-strong)",
            }}
          >
            Visit CanvasFlow
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
