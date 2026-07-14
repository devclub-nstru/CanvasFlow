"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Plus,
  Search,
  Share2,
  Trash2,
} from "lucide-react";

import { useListFormsByUserId, useDeleteForm } from "~/hooks/api/form";
import { useDashboard } from "~/providers/dashboard-provider";
import { useDebounce } from "~/hooks/useDebounce";
import { trpc } from "~/trpc/client";
import { toast } from "sonner";
import { ShareCollaboratorsDialog } from "~/components/builder/ShareCollaboratorsDialog";

/* ─── helpers ────────────────────────────────────────────────────────── */

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const getRelativeTime = (dateStr: string) => {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins || 1}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "—";
  }
};

const FILTERS = [
  { id: "ALL", label: "All" },
  { id: "DRAFTS", label: "Drafts" },
  { id: "PUBLISHED", label: "Published" },
];

const ITEMS_PER_PAGE = 6;

/* ─── page ──────────────────────────────────────────────────────────── */

export default function SketchesPage() {
  const { forms, isLoading } = useListFormsByUserId();
  const { openCreateFormModal } = useDashboard();
  const { deleteFormAsync, isPending: isDeleting } = useDeleteForm();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"createdAt" | "title">("createdAt");
  const [filter, setFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [shareFormId, setShareFormId] = useState<string | null>(null);
  const [shareFormTitle, setShareFormTitle] = useState("");
  const [shareOwnerEmail, setShareOwnerEmail] = useState<string | null | undefined>(undefined);
  const [shareRole, setShareRole] = useState<"owner" | "editor" | "viewer">("viewer");

  // Debounce the search input — the filter pass runs over every form on
  // every keystroke; debouncing keeps typing snappy and avoids resetting
  // pagination mid-type. 200ms is below the perceptual threshold so the
  // result still feels live.
  const debouncedSearch = useDebounce(search, 200);

  // Reset to page 1 whenever the *debounced* query changes so pagination
  // matches the visible result set.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const processedForms = useMemo(() => {
    if (!forms) return [];
    let result = [...forms];

    if (filter === "DRAFTS") result = result.filter((f) => !f.isPublished);
    else if (filter === "PUBLISHED") result = result.filter((f) => f.isPublished);

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q) ||
          f.slug.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      if (sort === "createdAt") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sort === "title") return a.title.localeCompare(b.title);
      return 0;
    });

    return result;
  }, [forms, filter, debouncedSearch, sort]);

  const totalPages = Math.ceil(processedForms.length / ITEMS_PER_PAGE) || 1;
  const paginatedForms = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return processedForms.slice(start, start + ITEMS_PER_PAGE);
  }, [processedForms, page]);

  const handleDelete = async (formId: string) => {
    try {
      await deleteFormAsync({ id: formId });
      toast.success("Form deleted");
      setConfirmDeleteId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete form");
    }
  };

  const confirmDeleteForm = forms?.find((f) => f.id === confirmDeleteId);
  const hasActiveFilters = !!search || filter !== "ALL";

  return (
    <div className="space-y-8">
      {/* ───── hero ───── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">My forms</p>
          <h1 className="mt-3 cf-display text-[36px] sm:text-[48px] leading-[0.95]">Your studio</h1>
          <p className="mt-3 text-[14.5px] text-[color:var(--cf-ink-soft)] leading-relaxed max-w-md">
            {forms?.length ?? 0} {forms?.length === 1 ? "form" : "forms"} in your workspace.
          </p>
        </div>

        <button
          onClick={openCreateFormModal}
          className="inline-flex items-center justify-center gap-1.5 h-[44px] px-5 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white rounded-full text-[13.5px] font-medium tracking-tight transition-colors self-start sm:self-auto"
        >
          <Plus className="size-4" />
          New form
        </button>
      </div>

      {/* ───── toolbar ───── */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-3">
        {/* search */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[color:var(--cf-ink-soft)]" />
          <input
            type="text"
            placeholder="Search forms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[color:var(--cf-cream)] rounded-md ring-1 ring-[color:var(--cf-line)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none pl-10 pr-3 h-[40px] text-[13.5px] text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 transition-shadow"
          />
        </div>

        {/* sort + filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="cf-eyebrow text-[color:var(--cf-ink-soft)] shrink-0">Sort</span>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "createdAt" | "title")}
                className="appearance-none bg-[color:var(--cf-cream)] rounded-md ring-1 ring-[color:var(--cf-line)] py-2 pl-3 pr-8 text-[13px] text-[color:var(--cf-ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--cf-orange)] cursor-pointer"
              >
                <option value="createdAt">Date created</option>
                <option value="title">Title</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-[color:var(--cf-ink-soft)] pointer-events-none" />
            </div>
          </div>

          <div className="hidden sm:block h-5 w-px bg-[color:var(--cf-line-strong)]" />

          <div className="inline-flex bg-[color:var(--cf-cream)] p-1 rounded-full text-[12px] font-medium select-none ring-1 ring-[color:var(--cf-line)] overflow-x-auto">
            {FILTERS.map((f) => {
              const isActive = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setFilter(f.id);
                    setPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-[color:var(--cf-cream-2)] text-[color:var(--cf-ink)] ring-1 ring-[color:var(--cf-line-strong)]"
                      : "text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-ink)]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ───── grid ───── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-8 h-8 border-2 border-[color:var(--cf-line-strong)] border-t-[color:var(--cf-orange)] rounded-full animate-spin" />
          <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Loading your forms...</p>
        </div>
      ) : paginatedForms.length === 0 ? (
        <EmptyState
          onCreate={openCreateFormModal}
          hasFilters={hasActiveFilters}
          onClearFilters={() => {
            setSearch("");
            setFilter("ALL");
            setPage(1);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedForms.map((form) => (
            <FormCard
              key={form.id}
              form={form}
              onDelete={() => setConfirmDeleteId(form.id)}
              onShare={() => {
                setShareFormId(form.id);
                setShareFormTitle(form.title);
                setShareOwnerEmail(form.ownerEmail);
                setShareRole(form.role);
              }}
            />
          ))}
        </div>
      )}

      {/* ───── pagination ───── */}
      {!isLoading && processedForms.length > ITEMS_PER_PAGE && (
        <div className="flex flex-col sm:flex-row justify-between items-center border-t border-[color:var(--cf-line)] pt-6 gap-3">
          <p className="text-[12px] font-mono text-[color:var(--cf-ink-soft)]">
            Page <span className="text-[color:var(--cf-ink)]">{page}</span> of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="bg-[color:var(--cf-cream-2)] hover:bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] ring-1 ring-[color:var(--cf-line)] p-2 rounded-full transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="bg-[color:var(--cf-cream-2)] hover:bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] ring-1 ring-[color:var(--cf-line)] p-2 rounded-full transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ───── delete confirm ───── */}
      {confirmDeleteId && confirmDeleteForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[color:var(--cf-ink)]/45 backdrop-blur-sm p-4">
          <div className="bg-[color:var(--cf-cream-2)] rounded-2xl ring-1 ring-[color:var(--cf-line-strong)] p-7 max-w-sm w-full shadow-[0_30px_80px_-30px_rgba(22,19,17,0.35)]">
            <p className="cf-eyebrow text-[color:var(--cf-orange)]">Permanent action</p>
            <h3 className="mt-3 cf-display text-[22px] leading-snug text-[color:var(--cf-ink)]">
              Delete this form?
            </h3>
            <p className="mt-2 text-[13.5px] text-[color:var(--cf-ink-soft)] leading-relaxed">
              <span className="text-[color:var(--cf-ink)] font-medium">
                &ldquo;{confirmDeleteForm.title}&rdquo;
              </span>{" "}
              and all its fields and submissions will be permanently removed. This cannot be undone.
            </p>

            <div className="flex justify-end gap-3 pt-6">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-[13px] font-medium rounded-full text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-[13px] font-medium rounded-full bg-[#c1281d] hover:bg-[#a92218] text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      {shareFormId && (
        <ShareCollaboratorsDialog
          show={!!shareFormId}
          formId={shareFormId}
          formTitle={shareFormTitle}
          ownerEmail={shareOwnerEmail}
          role={shareRole}
          onClose={() => setShareFormId(null)}
        />
      )}
    </div>
  );
}

/* ─── form card ──────────────────────────────────────────────────────── */

interface FormCardProps {
  form: {
    id: string;
    title: string;
    isPublished: boolean;
    submissionsCount?: number;
    createdAt: string;
    publishedAt?: string | null;
    updatedAt: string;
    ownerEmail?: string | null;
    role?: "owner" | "editor" | "viewer";
    permissions?: any;
  };
  onDelete: () => void;
  onShare: () => void;
}

function FormCard({ form, onDelete, onShare }: FormCardProps) {
  const isPublished = form.isPublished;
  const responses = form.submissionsCount ?? 0;
  const canDelete = form.permissions?.settings?.canDelete ?? form.role === "owner";

  // Hover/focus prefetch — warm the builder's tRPC caches so clicking the
  // Open / Continue editing link feels instant. Cheap to call multiple
  // times: tRPC dedups in-flight + already-cached prefetches.
  const utils = trpc.useUtils();
  const prefetchBuilder = () => {
    void utils.form.getForm.prefetch({ id: form.id });
    void utils.form.listFormFields.prefetch({ formId: form.id });
  };

  return (
    <div
      onMouseEnter={prefetchBuilder}
      onFocus={prefetchBuilder}
      className="group bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] hover:ring-[color:var(--cf-line-strong)] transition-shadow p-4 flex flex-col gap-3 sm:gap-4"
    >
      {/* mini form preview — hidden on mobile to keep cards short */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] hidden sm:block">
        <div className="absolute inset-0 px-6 py-5 flex flex-col justify-center gap-3">
          {/* fake title */}
          <div className="h-1.5 w-1/3 rounded-full bg-[color:var(--cf-ink)]/20" />

          {/* fake fields */}
          <div className="space-y-1.5 mt-1">
            <div className="h-2 w-full rounded-sm bg-[color:var(--cf-cream-2)] ring-1 ring-[color:var(--cf-line)]" />
            <div className="h-2 w-full rounded-sm bg-[color:var(--cf-cream-2)] ring-1 ring-[color:var(--cf-line)]" />
            <div className="h-2 w-4/5 rounded-sm bg-[color:var(--cf-cream-2)] ring-1 ring-[color:var(--cf-line)]" />
          </div>

          {/* fake submit */}
          <div className="mt-2">
            <span
              className={`block h-3 w-16 rounded-full ${
                isPublished ? "bg-[color:var(--cf-ink)]" : "bg-[color:var(--cf-orange)]"
              }`}
            />
          </div>
        </div>

        {/* status pill — inside preview on sm+ */}
        <span
          className={`absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ring-1 ${
            isPublished
              ? "bg-[color:var(--cf-orange)]/15 text-[color:var(--cf-orange)] ring-[color:var(--cf-orange)]/40"
              : "bg-[color:var(--cf-cream-2)] text-[color:var(--cf-ink-soft)] ring-[color:var(--cf-line-strong)]"
          }`}
        >
          {isPublished ? "Published" : "Draft"}
        </span>
      </div>

      {/* title + meta */}
      <div className="flex-1 space-y-3">
        {/* status pill — visible only on mobile, since preview is hidden */}
        <span
          className={`sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ring-1 ${
            isPublished
              ? "bg-[color:var(--cf-orange)]/15 text-[color:var(--cf-orange)] ring-[color:var(--cf-orange)]/40"
              : "bg-[color:var(--cf-cream-2)] text-[color:var(--cf-ink-soft)] ring-[color:var(--cf-line-strong)]"
          }`}
        >
          {isPublished ? "Published" : "Draft"}
        </span>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="cf-display text-[20px] sm:text-[22px] leading-tight line-clamp-1">
              {form.title}
            </h3>
            {form.role && form.role !== "owner" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line-strong)] text-[10px] font-mono text-[color:var(--cf-ink-soft)] capitalize">
                Shared: {form.role}
              </span>
            )}
          </div>
          {canDelete && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
              title="Delete form"
              aria-label="Delete form"
              className="p-1.5 rounded-md text-[color:var(--cf-ink-soft)]/60 hover:text-[color:var(--cf-orange)] hover:bg-[color:var(--cf-cream)] transition-colors cursor-pointer shrink-0"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>

        <dl className="text-[12px] font-mono text-[color:var(--cf-ink-soft)] space-y-1">
          <div className="flex justify-between">
            <dt>{isPublished ? "Published" : "Edited"}</dt>
            <dd className="text-[color:var(--cf-ink)]">
              {isPublished
                ? formatDate(form.publishedAt || form.createdAt)
                : getRelativeTime(form.updatedAt)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Responses</dt>
            <dd className="text-[color:var(--cf-ink)]">{responses}</dd>
          </div>
        </dl>
      </div>

      {/* actions */}
      <div className="flex gap-2 pt-1">
        {isPublished ? (
          <Link
            href={`/dashboard/sketches/${form.id}`}
            className="group/btn flex-1 inline-flex items-center justify-center gap-1.5 h-[38px] px-4 bg-[color:var(--cf-ink)] hover:bg-black text-white rounded-full text-[12.5px] font-medium tracking-tight transition-colors"
          >
            Open
            <ArrowUpRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
          </Link>
        ) : (
          <Link
            href={`/dashboard/sketches/${form.id}`}
            className="group/btn flex-1 inline-flex items-center justify-center gap-1.5 h-[38px] px-4 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white rounded-full text-[12.5px] font-medium tracking-tight transition-colors"
          >
            Continue editing
            <ArrowUpRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
          </Link>
        )}
        <button
          type="button"
          title="Share form"
          aria-label="Share form"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onShare();
          }}
          className="inline-flex items-center justify-center h-[38px] w-[38px] rounded-full ring-1 ring-[color:var(--cf-line-strong)] text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] transition-colors cursor-pointer shrink-0"
        >
          <Share2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── empty state ────────────────────────────────────────────────────── */

function EmptyState({
  onCreate,
  hasFilters,
  onClearFilters,
}: {
  onCreate: () => void;
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-dashed ring-[color:var(--cf-line-strong)] p-12 text-center max-w-lg mx-auto space-y-4">
      <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">
        {hasFilters ? "Nothing found" : "Empty studio"}
      </p>
      <h3 className="cf-display text-[26px] leading-tight">
        {hasFilters ? "No matches" : "Start your first form"}
      </h3>
      <p className="text-[13.5px] text-[color:var(--cf-ink-soft)] leading-relaxed max-w-sm mx-auto">
        {hasFilters
          ? "Try a different search or clear your filters to see all forms."
          : "Sketch on an open canvas in minutes. Free to start, no card required."}
      </p>
      <div className="flex items-center justify-center gap-3 pt-1">
        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 text-[13px] font-medium rounded-full text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] transition-colors cursor-pointer"
          >
            Clear filters
          </button>
        )}
        <button
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-1.5 h-[42px] px-5 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white rounded-full text-[13px] font-medium tracking-tight transition-colors"
        >
          <Plus className="size-4" />
          New form
        </button>
      </div>
    </div>
  );
}
