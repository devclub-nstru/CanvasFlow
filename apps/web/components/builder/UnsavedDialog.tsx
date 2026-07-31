"use client";

import React from "react";

interface UnsavedDialogProps {
  show: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSaveAndLeave: () => Promise<void>;
}

export function UnsavedDialog({ show, onCancel, onDiscard, onSaveAndLeave }: UnsavedDialogProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-(--cf-ink)/45 backdrop-blur-sm p-4">
      <div className="bg-(--cf-cream-2) rounded-2xl ring-1 ring-(--cf-line-strong) p-7 max-w-sm w-full shadow-[0_30px_80px_-30px_rgba(22,19,17,0.35)]">
        <p className="cf-eyebrow text-(--cf-orange)">Unsaved changes</p>
        <h3 className="mt-3 cf-display text-[22px] leading-snug text-(--cf-ink)">
          Save before leaving?
        </h3>
        <p className="mt-2 text-[13.5px] text-(--cf-ink-soft) leading-relaxed">
          You have unsaved changes. Save them now, or discard and leave.
        </p>

        <div className="flex flex-wrap justify-end gap-2 pt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[13px] font-medium rounded-full text-(--cf-ink) hover:bg-(--cf-cream) transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            className="px-4 py-2 text-[13px] font-medium rounded-full text-[#c1281d] ring-1 ring-[#c1281d]/25 hover:bg-[#c1281d]/8 transition-colors cursor-pointer"
          >
            Discard
          </button>
          <button
            onClick={onSaveAndLeave}
            className="px-5 py-2 text-[13px] font-medium rounded-full bg-(--cf-orange) hover:bg-(--cf-orange-hover) text-white transition-colors cursor-pointer"
          >
            Save &amp; leave
          </button>
        </div>
      </div>
    </div>
  );
}
