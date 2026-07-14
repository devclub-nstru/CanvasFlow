"use client";

import React from "react";
import { Trash2 } from "lucide-react";

interface DeleteFormDialogProps {
  show: boolean;
  formTitle: string;
  deletePending: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteFormDialog({
  show,
  formTitle,
  deletePending,
  onCancel,
  onConfirm,
}: DeleteFormDialogProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[color:var(--cf-ink)]/45 backdrop-blur-sm p-4">
      <div className="bg-[color:var(--cf-cream-2)] rounded-2xl ring-1 ring-[color:var(--cf-line-strong)] p-7 max-w-sm w-full shadow-[0_30px_80px_-30px_rgba(22,19,17,0.35)]">
        <p className="cf-eyebrow text-[color:var(--cf-orange)]">Permanent action</p>
        <h3 className="mt-3 cf-display text-[22px] leading-snug text-[color:var(--cf-ink)]">
          Delete this form?
        </h3>
        <p className="mt-2 text-[13.5px] text-[color:var(--cf-ink-soft)] leading-relaxed">
          <span className="text-[color:var(--cf-ink)] font-medium">&ldquo;{formTitle}&rdquo;</span>{" "}
          and all its fields and submissions will be permanently removed. This cannot be undone.
        </p>

        <div className="flex justify-end gap-3 pt-6">
          <button
            onClick={onCancel}
            disabled={deletePending}
            className="px-4 py-2 text-[13px] font-medium rounded-full text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deletePending}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-[13px] font-medium rounded-full bg-[#c1281d] hover:bg-[#a92218] text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            {deletePending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
