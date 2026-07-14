"use client";

import React, { useEffect } from "react";
import { Trash2, X } from "lucide-react";
import { getFieldIcon } from "../FormFieldNode";
import { FieldInspectorBody, type FieldInspectorProps } from "../FieldInspector";

interface MobileFieldEditorSheetProps extends FieldInspectorProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Bottom-sheet editor used in place of the right-hand FieldInspector on
 * mobile. Re-uses the same body (`FieldInspectorBody`) so the per-type
 * editors stay in lockstep with the desktop inspector.
 */
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
      className="fixed inset-0 z-[200] flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Edit field"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[color:var(--cf-ink)]/45 backdrop-blur-sm cursor-default"
      />

      <div className="relative w-full bg-[color:var(--cf-cream-2)] rounded-t-2xl ring-1 ring-[color:var(--cf-line-strong)] max-h-[90vh] flex flex-col shadow-[0_-20px_60px_-20px_rgba(22,19,17,0.3)]">
        {/* grab handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-[color:var(--cf-line-strong)]" />
        </div>

        {/* header */}
        <div className="px-5 pt-2 pb-3 border-b border-[color:var(--cf-line)] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Edit field</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] px-2 py-0.5 rounded-full">
                <FieldIcon className="size-3 text-[color:var(--cf-orange)]" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--cf-ink-soft)]">
                  {selectedField.type.replace("_", " ").toLowerCase()}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-1 rounded-md text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 overscroll-contain">
          <FieldInspectorBody {...inspectorProps} />
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t border-[color:var(--cf-line)] flex items-center gap-2 bg-[color:var(--cf-cream-2)]">
          <button
            onClick={() => {
              handleDeleteField();
              onClose();
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-[42px] rounded-full ring-1 ring-[#c1281d]/30 text-[#c1281d] active:bg-[#c1281d]/8 text-[13px] font-medium transition-all"
          >
            <Trash2 className="size-3.5" />
            Remove
          </button>
          <button
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center h-[42px] rounded-full bg-[color:var(--cf-ink)] active:bg-black text-white text-[13px] font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
