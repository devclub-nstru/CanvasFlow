"use client";

import React, { useEffect } from "react";
import { Trash2, X } from "lucide-react";
import { getFieldIcon } from "../FormFieldNode";
import { FieldInspectorBody, type FieldInspectorProps } from "../FieldInspector";

interface MobileFieldEditorSheetProps extends FieldInspectorProps {
  open: boolean;
  onClose: () => void;
}

export function MobileFieldEditorSheet({
  open,
  onClose,
  ...inspectorProps
}: MobileFieldEditorSheetProps) {
  const { selectedField, handleDeleteField } = inspectorProps;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !selectedField) return null;

  const FieldIcon = getFieldIcon(selectedField.type);

  return (
    <div
      className="fixed inset-0 z-200 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Edit field"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-(--cf-ink)/45 backdrop-blur-sm cursor-default"
      />

      <div
        className="relative flex max-h-[90vh] w-full flex-col border-t-2 bg-(--cf-cream-2)"
        style={{ borderTopColor: "var(--cf-line-strong)" }}
      >
        {/* grab handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-(--cf-line-strong)" />
        </div>

        {/* header */}
        <div
          className="flex items-start justify-between gap-3 border-b px-5 pt-2 pb-3"
          style={{ borderBottomColor: "var(--cf-line-strong)" }}
        >
          <div className="min-w-0">
            <p className="cf-meta">Edit field</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 border border-(--cf-line-strong) bg-(--cf-cream) px-2 py-0.5">
                <FieldIcon className="size-3 text-(--cf-orange)" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-(--cf-ink-soft)">
                  {selectedField.type.replace("_", " ").toLowerCase()}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 p-2 text-(--cf-ink-soft) transition-colors hover:text-(--cf-ink)"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 overscroll-contain">
          <FieldInspectorBody {...inspectorProps} />
        </div>

        {/* footer */}
        <div
          className="flex items-center gap-2 border-t bg-(--cf-cream-2) px-5 py-3"
          style={{ borderTopColor: "var(--cf-line-strong)" }}
        >
          <button
            onClick={() => {
              handleDeleteField();
              onClose();
            }}
            className="cf-btn-danger h-10.5 flex-1 text-[13px]"
          >
            <Trash2 className="size-3.5" />
            Remove
          </button>
          <button
            onClick={onClose}
            className="cf-btn cf-press inline-flex h-10.5 flex-1 items-center justify-center text-[13px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
