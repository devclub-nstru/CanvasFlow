"use client";

import React from "react";
import { trpc } from "~/trpc/client";

interface FormItem {
  id: string;
  title: string;
  isPublished: boolean;
}

interface AnalyticsFormPickerProps {
  isLoadingForms: boolean;
  forms: FormItem[] | undefined;
  selectedFormId: string | null;
  setSelectedFormId: (id: string) => void;
}

export function AnalyticsFormPicker({
  isLoadingForms,
  forms,
  selectedFormId,
  setSelectedFormId,
}: AnalyticsFormPickerProps) {
  const utils = trpc.useUtils();
  const prefetchForm = (id: string) => {
    void utils.form.getFormById.prefetch({ id });
    void utils.analytics.getFormAnalytics.prefetch({ formId: id });
    void utils.analytics.getSubmissions.prefetchInfinite({ formId: id, limit: 100 });
  };

  return (
    <div className="cf-panel cf-raised flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
      <p className="cf-meta shrink-0">Form</p>

      {isLoadingForms ? (
        <p className="cf-meta py-1">Loading</p>
      ) : !forms || forms.length === 0 ? (
        <p className="cf-meta py-1">No forms yet</p>
      ) : (
        <div
          className="custom-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:pb-0"
          role="tablist"
          aria-label="Select a form"
        >
          {forms.map((f) => {
            const isActive = selectedFormId === f.id;
            return (
              <button
                key={f.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedFormId(f.id)}
                onMouseEnter={() => prefetchForm(f.id)}
                onFocus={() => prefetchForm(f.id)}
                className="inline-flex max-w-[16rem] shrink-0 cursor-pointer items-center gap-2 border px-3 py-2 text-[12.5px] transition-colors"
                style={
                  isActive
                    ? {
                        borderColor: "var(--cf-line-strong)",
                        background: "var(--cf-ink)",
                        color: "var(--cf-cream)",
                      }
                    : {
                        borderColor: "var(--cf-line-strong)",
                        color: "var(--cf-ink-soft)",
                      }
                }
              >
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{
                    background: f.isPublished ? "var(--cf-orange)" : "var(--cf-ink-soft)",
                  }}
                />
                <span className="truncate">{f.title}</span>
                {/* The dot is decorative; the state still needs a name. */}
                <span className="sr-only">{f.isPublished ? "Published" : "Draft"}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
