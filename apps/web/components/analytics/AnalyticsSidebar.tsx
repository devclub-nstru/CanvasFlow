"use client";

import React from "react";
import { trpc } from "~/trpc/client";

interface FormItem {
  id: string;
  title: string;
  isPublished: boolean;
}

interface AnalyticsSidebarProps {
  isLoadingForms: boolean;
  forms: FormItem[] | undefined;
  selectedFormId: string | null;
  setSelectedFormId: (id: string) => void;
}

export function AnalyticsSidebar({
  isLoadingForms,
  forms,
  selectedFormId,
  setSelectedFormId,
}: AnalyticsSidebarProps) {
  // Hover/focus prefetch — when the user is about to switch forms, warm
  // the analytics + form data caches so the right pane updates with no
  // visible loading state.
  const utils = trpc.useUtils();
  const prefetchForm = (id: string) => {
    void utils.form.getFormById.prefetch({ id });
    void utils.analytics.getFormAnalytics.prefetch({ formId: id });
    // Submissions is now an infinite query — prefetch the first page so
    // the cache key matches the consumer's useInfiniteQuery.
    void utils.analytics.getSubmissions.prefetchInfinite({
      formId: id,
      limit: 100,
    });
  };
  return (
    <aside className="w-full lg:w-64 shrink-0 bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-4 lg:p-5 flex flex-col gap-3 lg:gap-4">
      <div className="space-y-1.5">
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Analytics</p>
        <h3 className="cf-display text-[20px] lg:text-[22px] leading-tight">Forms</h3>
      </div>

      <div className="border-t border-[color:var(--cf-line)] pt-3">
        {isLoadingForms ? (
          <div className="py-6 text-center text-[12px] text-[color:var(--cf-ink-soft)]">
            Loading...
          </div>
        ) : !forms || forms.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[color:var(--cf-ink-soft)]">
            No forms yet.
          </div>
        ) : (
          <>
            {/* Mobile / tablet: horizontal scrolling chip strip
                so the form list doesn't push the analytics off screen */}
            <div className="lg:hidden -mx-1 px-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {forms.map((f) => {
                const isActive = selectedFormId === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFormId(f.id)}
                    onMouseEnter={() => prefetchForm(f.id)}
                    onFocus={() => prefetchForm(f.id)}
                    className={`shrink-0 inline-flex items-center gap-2 max-w-[14rem] px-3 py-1.5 rounded-full text-[12.5px] transition-colors cursor-pointer ring-1 ${
                      isActive
                        ? "bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] ring-[color:var(--cf-line-strong)]"
                        : "bg-transparent text-[color:var(--cf-ink-soft)] ring-[color:var(--cf-line)] hover:bg-[color:var(--cf-cream)]/60 hover:text-[color:var(--cf-ink)]"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full shrink-0 ${
                        f.isPublished
                          ? "bg-[color:var(--cf-orange)]"
                          : "bg-[color:var(--cf-ink-soft)]/40"
                      }`}
                      aria-label={f.isPublished ? "Published" : "Draft"}
                    />
                    <span className="truncate">{f.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Desktop: vertical list */}
            <div className="hidden lg:block space-y-1 max-h-[28rem] overflow-y-auto pr-1">
              {forms.map((f) => {
                const isActive = selectedFormId === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFormId(f.id)}
                    onMouseEnter={() => prefetchForm(f.id)}
                    onFocus={() => prefetchForm(f.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-[13px] transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      isActive
                        ? "bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] ring-1 ring-[color:var(--cf-line-strong)]"
                        : "text-[color:var(--cf-ink-soft)] hover:bg-[color:var(--cf-cream)]/60 hover:text-[color:var(--cf-ink)]"
                    }`}
                  >
                    <span className="truncate">{f.title}</span>
                    <span
                      className={`size-1.5 rounded-full shrink-0 ${
                        f.isPublished
                          ? "bg-[color:var(--cf-orange)]"
                          : "bg-[color:var(--cf-ink-soft)]/40"
                      }`}
                      aria-label={f.isPublished ? "Published" : "Draft"}
                    />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
