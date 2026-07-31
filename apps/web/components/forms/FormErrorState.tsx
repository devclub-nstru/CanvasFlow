"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface FormErrorStateProps {
  type: "not-found" | "draft-mode" | "already-submitted" | "closed" | "expired" | "limit-reached";
}

/**
 * The six states a respondent can land on instead of the form.
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
    body: "Each visitor can submit this form once. Thanks — we already have your response on file.",
  },
  closed: {
    eyebrow: "Closed",
    title: "Form is closed",
    body: "The author has closed this form to new responses.",
  },
  expired: {
    eyebrow: "Expired",
    title: "Form has expired",
    body: "This form has passed its expiration date and is no longer accepting submissions.",
  },
  "limit-reached": {
    eyebrow: "Limit reached",
    title: "Submission limit reached",
    body: "This form has reached its maximum allowed number of submissions.",
  },
  "not-found": {
    eyebrow: "Not found",
    title: "We can't find this form",
    body: "The form may have been deleted, or the link is incorrect. Double-check the URL.",
  },
};

export function FormErrorState({ type }: FormErrorStateProps) {
  const config = STATES[type];

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
        <p className="mt-3 text-[13.5px] leading-relaxed text-(--cf-ink-soft)">
          {config.body}
        </p>
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
      </div>
    </div>
  );
}
