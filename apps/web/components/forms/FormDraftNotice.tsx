"use client";

import React from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";

export type DraftStatus = "idle" | "saving" | "saved";

interface FormDraftNoticeProps {
  status: DraftStatus;
  /** ISO timestamp of the draft that was restored, if this session resumed one. */
  resumedFrom?: string | null;
  onStartOver: () => void;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "earlier";

  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Tells a signed-in respondent that their progress is being kept, and that a
 * previous session was picked up.
 *
 * Both halves matter. Silently restoring answers is alarming — the form appears
 * to already know things about you — so the resume is announced with a way to
 * discard it. And an autosave nobody can see is indistinguishable from no
 * autosave, which is what makes people afraid to close the tab.
 */
export function FormDraftNotice({ status, resumedFrom, onStartOver }: FormDraftNoticeProps) {
  if (status === "idle" && !resumedFrom) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border px-3 py-2"
      style={{ borderColor: "var(--cf-line-strong)", background: "var(--cf-cream-2)" }}
    >
      <p className="inline-flex items-center gap-1.5 text-[12px] text-(--cf-ink-soft)">
        {status === "saving" && (
          <>
            <Loader2 className="size-3 animate-spin" />
            Saving your progress…
          </>
        )}
        {status === "saved" && (
          <>
            <Check className="size-3 text-(--cf-orange)" />
            Progress saved — you can close this and come back.
          </>
        )}
        {status === "idle" && resumedFrom && (
          <>
            <RotateCcw className="size-3 text-(--cf-orange)" />
            Picked up where you left off {relativeTime(resumedFrom)}.
          </>
        )}
      </p>

      {resumedFrom && (
        <button
          type="button"
          onClick={onStartOver}
          className="cursor-pointer font-mono text-[10px] tracking-wider text-(--cf-ink-soft) uppercase underline decoration-dotted hover:text-(--cf-ink)"
        >
          Start over
        </button>
      )}
    </div>
  );
}
