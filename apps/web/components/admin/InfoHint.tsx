"use client";

import React from "react";
import { Info } from "lucide-react";

/* A small "i" beside a panel heading that explains what the numbers mean.
 *
 * A button rather than a bare icon, because the explanation has to reach
 * keyboard and screen-reader users too: it opens on focus as well as hover,
 * and Escape dismisses it. `aria-describedby` is what ties the tooltip to the
 * control for assistive tech — a title attribute alone would not be announced
 * consistently and cannot be styled. */
export function InfoHint({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        /* Tapping works too — on a touch screen there is no hover at all. */
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-4 items-center justify-center opacity-45 transition-opacity hover:opacity-100 focus-visible:opacity-100"
      >
        <Info className="size-3.5" />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          /* Anchored to the left edge and capped, so a long note near the right
             side of the grid does not push the layout or run off screen. */
          className="absolute top-full left-0 z-50 mt-1.5 w-60 border p-2.5 text-[11px] leading-relaxed normal-case"
          style={{
            background: "var(--cf-ink)",
            color: "var(--cf-cream)",
            borderColor: "var(--cf-line-strong)",
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
