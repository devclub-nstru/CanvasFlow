"use client";

import React, { useState, useEffect } from "react";
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
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [confirmTitleText, setConfirmTitleText] = useState("");

  useEffect(() => {
    if (!show) {
      setConfirmDeleteText("");
      setConfirmTitleText("");
    }
  }, [show]);

  if (!show) return null;

  const handleCancel = () => {
    setConfirmDeleteText("");
    setConfirmTitleText("");
    onCancel();
  };

  const isConfirmed =
    confirmDeleteText.trim().toLowerCase() === "delete" &&
    confirmTitleText.trim().toLowerCase() === formTitle.toLowerCase();

  return (
    <div className="cf-scrim z-[300] p-4">
      <div className="bg-(--cf-cream-2) rounded-2xl ring-1 ring-(--cf-line-strong) p-7 max-w-sm w-full shadow-[0_30px_80px_-30px_rgba(22,19,17,0.35)]">
        <p className="cf-eyebrow text-(--cf-orange)">Permanent action</p>
        <h3 className="mt-3 cf-display text-[22px] leading-snug text-(--cf-ink)">
          Delete this form?
        </h3>
        <p className="mt-2 text-[13.5px] text-(--cf-ink-soft) leading-relaxed">
          <span className="text-(--cf-ink) font-medium">&ldquo;{formTitle}&rdquo;</span> and all its
          fields and submissions will be permanently removed. This cannot be undone.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="confirm-delete-word"
              className="block text-[11px] font-mono text-(--cf-ink-soft) mb-1.5 uppercase"
            >
              Type <span className="font-bold text-(--cf-ink)">delete</span> to confirm:
            </label>
            <input
              id="confirm-delete-word"
              type="text"
              value={confirmDeleteText}
              onChange={(e) => setConfirmDeleteText(e.target.value)}
              placeholder=""
              className="w-full h-9 border border-(--cf-line-strong) bg-(--cf-cream) px-3 text-[13px] transition-shadow focus:outline-none focus:ring-1 focus:ring-(--cf-ink)"
            />
          </div>
          <div>
            <label
              htmlFor="confirm-delete-title"
              className="block text-[11px] font-mono text-(--cf-ink-soft) mb-1.5 uppercase"
            >
              Type form name <span className="font-bold text-(--cf-ink)">{formTitle}</span> to
              confirm:
            </label>
            <input
              id="confirm-delete-title"
              type="text"
              value={confirmTitleText}
              onChange={(e) => setConfirmTitleText(e.target.value)}
              placeholder=""
              className="w-full h-9 border border-(--cf-line-strong) bg-(--cf-cream) px-3 text-[13px] transition-shadow focus:outline-none focus:ring-1 focus:ring-(--cf-ink)"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6">
          <button
            onClick={handleCancel}
            disabled={deletePending}
            className="px-4 py-2 text-[13px] font-medium rounded-full text-(--cf-ink) hover:bg-(--cf-cream) transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deletePending || !isConfirmed}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-[13px] font-medium rounded-full bg-[#c1281d] hover:bg-[#a92218] text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="size-3.5" />
            {deletePending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
