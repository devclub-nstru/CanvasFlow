"use client";

import React from "react";
import { X } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  input?: {
    label: string;
    placeholder?: string;
    optional?: boolean;
    maxLength?: number;
  };
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  busy,
  input,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  /* Each opening starts clean — a reason typed for one account must never be
   * pre-filled for the next. */
  React.useEffect(() => {
    if (open) {
      setValue("");
      /* After paint, or the element is not focusable yet. */
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const submit = () => {
    if (busy) return;
    onConfirm(value.trim());
  };

  return (
    <div
      className="cf-scrim z-300"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="cf-dialog w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dialog-title"
      >
        <div className="cf-dialog-bar">
          <span id="admin-dialog-title" className="truncate">
            {title}
          </span>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="cf-btn-outline size-7 shrink-0 disabled:opacity-40"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="cf-dialog-body space-y-4">
          <div className="text-[13px] leading-relaxed">{message}</div>

          {input && (
            <div>
              <label htmlFor="admin-dialog-input" className="cf-meta mb-2 block">
                {input.label}
                {input.optional && (
                  <span className="ml-2 normal-case" style={{ color: "var(--cf-ink-soft)" }}>
                    optional
                  </span>
                )}
              </label>
              <input
                id="admin-dialog-input"
                ref={inputRef}
                type="text"
                value={value}
                maxLength={input.maxLength}
                placeholder={input.placeholder}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
                className="cf-input h-10 px-3 text-[13px]"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3"
          style={{ borderTopColor: "var(--cf-line)" }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="cf-btn-outline h-9 px-4 text-[11px] font-bold tracking-[0.16em] uppercase disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className={`${danger ? "cf-btn-danger" : "cf-btn cf-press"} h-9 px-4 text-[11px] font-bold tracking-[0.16em] uppercase disabled:opacity-40`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
