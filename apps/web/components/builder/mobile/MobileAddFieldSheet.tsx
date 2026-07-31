"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { AVAILABLE_FIELDS } from "../FormFieldNode";

const CATEGORIES: Array<{ label: string; types: string[] }> = [
  { label: "Text", types: ["TEXT", "TEXTAREA", "EMAIL", "PHONE", "URL"] },
  { label: "Numbers", types: ["NUMBER"] },
  { label: "Choice", types: ["SELECT", "CHECKBOX"] },
  { label: "Interactive", types: ["RATING", "TOGGLE"] },
  { label: "Date & time", types: ["DATE", "TIME"] },
];

interface MobileAddFieldSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
}

export function MobileAddFieldSheet({ open, onClose, onSelect }: MobileAddFieldSheetProps) {
  // Lock body scroll while sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Add field"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-(--cf-ink)/45 backdrop-blur-sm cursor-default"
      />
      <div
        className="relative flex max-h-[85vh] w-full flex-col border-t-2 bg-(--cf-cream-2)"
        style={{ borderTopColor: "var(--cf-line-strong)" }}
      >
        {/* grab handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-(--cf-line-strong)" />
        </div>

        <div
          className="flex items-start justify-between gap-3 border-b px-5 pt-2 pb-4"
          style={{ borderBottomColor: "var(--cf-line-strong)" }}
        >
          <div>
            <p className="cf-meta">Add field</p>
            <h3 className="mt-1 cf-display text-[22px] leading-tight">Pick a type</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 p-2 text-(--cf-ink-soft) transition-colors hover:text-(--cf-ink)"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 overscroll-contain">
          {CATEGORIES.map((cat) => {
            const items = AVAILABLE_FIELDS.filter((f) => cat.types.includes(f.type));
            if (items.length === 0) return null;
            return (
              <div key={cat.label}>
                <p className="cf-meta mb-2 px-1">{cat.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((f) => {
                    const Icon = f.icon;
                    return (
                      <button
                        key={f.type}
                        onClick={() => onSelect(f.type)}
                        className="flex min-h-[88px] flex-col items-start gap-2 border border-(--cf-line-strong) bg-(--cf-cream) p-3 text-left transition-colors active:bg-(--cf-cream-2)"
                      >
                        <div className="flex size-8 items-center justify-center border border-(--cf-line) bg-(--cf-cream-2)">
                          <Icon className="size-4 text-(--cf-orange)" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[13px] font-medium text-(--cf-ink) leading-tight">
                            {f.label}
                          </p>
                          <p className="text-[11px] text-(--cf-ink-soft) leading-snug line-clamp-1">
                            {f.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* bottom safe-area spacer */}
          <div className="h-3" />
        </div>
      </div>
    </div>
  );
}
