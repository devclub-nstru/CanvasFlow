"use client";

import React, { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Eye, Search } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface SubmissionValue {
  formFieldId: string;
  value: any;
}

interface Submission {
  id: string;
  formId: string;
  values: SubmissionValue[];
  createdAt: string;
}

interface FormField {
  id: string;
  label: string;
  type: string;
}

interface SubmissionsTableProps {
  filteredSubmissions: Submission[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  getRespondentDetails: (sub: Submission) => { name: string; email: string };
  setViewingSubmission: (sub: Submission | null) => void;
  viewingSubmission: Submission | null;
  form: { fields: FormField[] } | null | undefined;
  // Pagination state from useGetSubmissions's underlying useInfiniteQuery
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

// Detail modal is only rendered when a row is clicked. Lazy-load it so it
// stays out of the initial bundle.
const SubmissionDetailModal = dynamic(
  () => import("./SubmissionDetailModal").then((m) => m.SubmissionDetailModal),
  { ssr: false },
);

const ROW_HEIGHT = 64; // px — fixed-height rows make virtualization simple
const GRID_COLS =
  "grid grid-cols-[minmax(0,1fr)_110px_160px_56px] sm:grid-cols-[minmax(0,1fr)_120px_180px_56px] gap-3 items-center";

export function SubmissionsTable({
  filteredSubmissions,
  searchQuery,
  setSearchQuery,
  getRespondentDetails,
  setViewingSubmission,
  viewingSubmission,
  form,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: SubmissionsTableProps) {
  // Scroll container for the virtualizer
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredSubmissions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    // Render a few rows above/below the viewport so fast scrolls don't
    // flash empty space.
    overscan: 6,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Auto-load the next page when the user scrolls within ~3 rows of the
  // bottom. Pairs with the visible "Load older" button so users can pull
  // manually if the auto-trigger missed (e.g. they jumped to the bottom
  // with End key before any rows rendered).
  React.useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (hasNextPage && !isFetchingNextPage && last.index >= filteredSubmissions.length - 3) {
      fetchNextPage?.();
    }
  }, [virtualItems, hasNextPage, isFetchingNextPage, filteredSubmissions.length, fetchNextPage]);

  // Cap the scroll area: tall enough to feel like a real table, capped so
  // it doesn't push the page off the bottom on small viewports.
  const scrollHeight = useMemo(() => {
    if (filteredSubmissions.length === 0) return 0;
    // ~6 rows visible by default; clamp to 640px max.
    return Math.min(filteredSubmissions.length * ROW_HEIGHT, 640);
  }, [filteredSubmissions.length]);

  return (
    <>
      <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Latest</p>
            <h4 className="mt-2 cf-display text-[20px] leading-tight">Responses</h4>
            {filteredSubmissions.length > 0 && (
              <p className="mt-1 text-[11px] font-mono text-[color:var(--cf-ink-soft)]">
                {filteredSubmissions.length} {filteredSubmissions.length === 1 ? "row" : "rows"} ·
                virtualised
                {hasNextPage ? " · more available" : ""}
              </p>
            )}
          </div>
          <div className="w-full sm:w-72 relative">
            <input
              type="text"
              placeholder="Search responses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[color:var(--cf-cream)] rounded-md ring-1 ring-[color:var(--cf-line)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none pl-9 pr-3 h-[38px] text-[13px] text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 transition-shadow"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[color:var(--cf-ink-soft)]" />
          </div>
        </div>

        <div className="mt-5">
          {filteredSubmissions.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[color:var(--cf-ink-soft)] bg-[color:var(--cf-cream)] rounded-lg ring-1 ring-dashed ring-[color:var(--cf-line-strong)]">
              No submissions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* min-width keeps the header + virtualized rows aligned even
                  when the viewport is narrow; horizontal scroll on phones */}
              <div className="min-w-[640px]">
                {/* Header — outside the virtualized scroll area, always visible */}
                <div className={`${GRID_COLS} px-1 pb-3 border-b border-[color:var(--cf-line)]`}>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--cf-ink-soft)] font-medium">
                    Respondent
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--cf-ink-soft)] font-medium">
                    Status
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--cf-ink-soft)] font-medium">
                    Date
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--cf-ink-soft)] font-medium text-right">
                    Action
                  </div>
                </div>

                {/* Virtualised body — only rows currently in/near the
                    viewport are rendered. Scales to thousands of rows. */}
                <div
                  ref={scrollRef}
                  className="overflow-y-auto"
                  style={{ height: scrollHeight }}
                  role="rowgroup"
                >
                  <div
                    style={{
                      height: totalSize,
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    {virtualItems.map((vi) => {
                      const sub = filteredSubmissions[vi.index]!;
                      const details = getRespondentDetails(sub);
                      const initials = details.name.substring(0, 2).toUpperCase();

                      return (
                        <div
                          key={sub.id}
                          data-index={vi.index}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: vi.size,
                            transform: `translateY(${vi.start}px)`,
                          }}
                          className={`${GRID_COLS} px-1 border-b border-[color:var(--cf-line)] hover:bg-[color:var(--cf-cream)]/60 transition-colors text-[13px]`}
                          role="row"
                        >
                          {/* Respondent */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[color:var(--cf-ink)] text-white flex items-center justify-center text-[11px] font-medium shrink-0">
                              {initials || "?"}
                            </div>
                            <div className="overflow-hidden">
                              <div className="font-medium text-[color:var(--cf-ink)] truncate">
                                {details.name}
                              </div>
                              <div className="text-[11px] text-[color:var(--cf-ink-soft)] truncate font-mono">
                                {details.email}
                              </div>
                            </div>
                          </div>

                          {/* Status */}
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[color:var(--cf-ink-soft)]">
                            <span className="size-1.5 rounded-full bg-[color:var(--cf-orange)]" />
                            Completed
                          </span>

                          {/* Date */}
                          <div className="text-[12px] font-mono text-[color:var(--cf-ink-soft)] truncate">
                            {new Date(sub.createdAt).toLocaleString()}
                          </div>

                          {/* Action */}
                          <div className="text-right">
                            <button
                              onClick={() => setViewingSubmission(sub)}
                              className="p-2 rounded-md ring-1 ring-[color:var(--cf-line-strong)] hover:bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] transition-colors cursor-pointer"
                              title="View details"
                              aria-label="View submission details"
                            >
                              <Eye className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pagination footer — manual fallback for the auto-trigger
                    above. Surfaces loading state when more rows are coming. */}
                {(hasNextPage || isFetchingNextPage) && (
                  <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-[color:var(--cf-line)]">
                    {isFetchingNextPage ? (
                      <span className="inline-flex items-center gap-2 text-[12px] font-mono text-[color:var(--cf-ink-soft)]">
                        <span className="size-3 border-2 border-[color:var(--cf-line-strong)] border-t-[color:var(--cf-orange)] rounded-full animate-spin" />
                        Loading older submissions...
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fetchNextPage?.()}
                        className="text-[12px] font-medium text-[color:var(--cf-ink)] hover:text-[color:var(--cf-orange)] ring-1 ring-[color:var(--cf-line-strong)] hover:ring-[color:var(--cf-orange)] bg-[color:var(--cf-cream)] hover:bg-[color:var(--cf-cream-2)] px-4 h-[32px] rounded-full transition-colors cursor-pointer"
                      >
                        Load older submissions
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submission detail modal — code-split, only loaded when opened */}
      {viewingSubmission && form && (
        <SubmissionDetailModal
          submission={viewingSubmission}
          form={form}
          getRespondentDetails={getRespondentDetails}
          onClose={() => setViewingSubmission(null)}
        />
      )}
    </>
  );
}
