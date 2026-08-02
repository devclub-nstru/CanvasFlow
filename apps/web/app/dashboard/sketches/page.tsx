"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Plus,
  Search,
  Share2,
  Trash2,
  Users,
} from "lucide-react";

import { useListFormsByUserId, useDeleteForm } from "~/hooks/api/form";
import { useDashboard } from "~/providers/dashboard-provider";
import { useDebounce } from "~/hooks/useDebounce";
import { trpc } from "~/trpc/client";
import { toast } from "sonner";
import { ShareCollaboratorsDialog } from "~/components/builder/ShareCollaboratorsDialog";
import { CustomSelect } from "~/components/ui/CustomSelect";

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

  const debouncedSearch = useDebounce(search, 200);

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
      {/* ───── hero + toolbar ───── */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="shrink-0">
          <h1 className="cf-display text-[32px] leading-[0.95] uppercase sm:text-[42px] md:text-[52px]">
            Forms
            <span style={{ color: "var(--cf-orange)" }}>.</span>
          </h1>
          <p className="mt-3 max-w-xs font-mono text-[13px] leading-relaxed text-(--cf-ink-soft)">
            Design, publish, and decode your information workflows.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-2xl">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
              style={{ color: "var(--cf-ink-soft)" }}
            />
            <label htmlFor="forms-search" className="sr-only">
              Search forms
            </label>
            <input
              id="forms-search"
              type="text"
              placeholder="Search forms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full border border-(--cf-line-strong) bg-(--cf-cream-2) pr-3 pl-11 text-[14px] transition-shadow placeholder:text-(--cf-ink-soft) focus:shadow-[3px_3px_0_0_var(--cf-line-strong)] focus:outline-none"
            />
          </div>

          <ToolbarSelect
            label="Status"
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
            options={FILTERS.map((f) => ({ value: f.id, label: f.label }))}
          />

          <ToolbarSelect
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as "createdAt" | "title")}
            options={[
              { value: "createdAt", label: "Newest" },
              { value: "title", label: "Title" },
            ]}
          />
        </div>
      </div>

      {/* ───── result count rule ───── */}
      <div className="flex items-end justify-between gap-4 border-b border-(--cf-line-strong) pb-3">
        <p className="cf-meta">{hasActiveFilters ? "Filtered" : "All forms"}</p>
        <p className="cf-meta">
          {processedForms.length} {processedForms.length === 1 ? "result" : "results"}
        </p>
      </div>

      {/* ───── grid ───── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="size-8 animate-spin rounded-full border-2 border-(--cf-line) border-t-(--cf-orange)" />
          <p className="cf-meta">Loading your forms</p>
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
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
        <div className="flex flex-col sm:flex-row justify-between items-center border-t border-(--cf-line) pt-6 gap-3">
          <p className="text-[12px] font-mono text-(--cf-ink-soft)">
            Page <span className="text-(--cf-ink)">{page}</span> of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="cf-btn-outline size-9 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Previous page"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="cf-btn-outline size-9 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Next page"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ───── delete confirm ───── */}
      {confirmDeleteId && confirmDeleteForm && (
        <div className="cf-scrim z-200">
          <div className="cf-dark cf-crop w-full max-w-md">
            <div className="relative z-1 p-6 sm:p-8">
              <p className="cf-dark-meta" style={{ color: "var(--c-red)" }}>
                Permanent action
              </p>
              <h3 className="cf-display mt-3 text-[26px] leading-none uppercase sm:text-[32px]">
                Delete form
                <span style={{ color: "var(--c-red)" }}>.</span>
              </h3>
              <p
                className="mt-3 text-[13.5px] leading-relaxed"
                style={{ color: "var(--cfd-text-soft)" }}
              >
                <span className="font-medium" style={{ color: "var(--cfd-text)" }}>
                  &ldquo;{confirmDeleteForm.title}&rdquo;
                </span>{" "}
                and all its fields and submissions will be permanently removed. This cannot be
                undone.
              </p>

              <div className="flex justify-end gap-3 pt-6">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={isDeleting}
                  className="cf-dark-btn-outline px-4 py-2 text-[13px] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  disabled={isDeleting}
                  className="cf-btn px-5 py-2 text-[13px] disabled:opacity-50"
                  style={{ background: "var(--c-red)" }}
                >
                  <Trash2 className="size-3.5" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
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

function ToolbarSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative shrink-0">
      <label htmlFor={`toolbar-${label}`} className="sr-only">
        {label}
      </label>
      <CustomSelect
        value={value}
        onChange={onChange}
        options={options}
        className="w-full sm:w-[180px]"
      />
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

  const utils = trpc.useUtils();
  const prefetchBuilder = () => {
    void utils.form.getForm.prefetch({ id: form.id });
    void utils.form.listFormFields.prefetch({ formId: form.id });
  };

  return (
    <div
      onMouseEnter={prefetchBuilder}
      onFocus={prefetchBuilder}
      className="cf-panel cf-raised cf-press group relative flex flex-col gap-4 p-4 sm:p-5"
    >
      <span
        aria-hidden
        className="absolute top-0 right-0 z-10 size-4 border-b border-l border-(--cf-line-strong)"
        style={{ background: isPublished ? "var(--cf-orange)" : "var(--cf-ink-soft)" }}
      />

      <div className="relative hidden aspect-video w-full overflow-hidden border border-(--cf-line-strong) bg-(--cf-cream) sm:block">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(var(--cf-ink) 1px, transparent 1px)",
            backgroundSize: "8px 8px",
          }}
        />
        <div className="absolute inset-0 flex flex-col justify-center gap-3 px-6 py-5 transition-transform duration-500 ease-out group-hover:-translate-y-1">
          <div className="h-1.5 w-1/3 bg-(--cf-ink)/25" />
          <div className="mt-1 space-y-1.5">
            <div className="h-2 w-full border border-(--cf-line) bg-(--cf-cream-2)" />
            <div className="h-2 w-full border border-(--cf-line) bg-(--cf-cream-2)" />
            <div className="h-2 w-4/5 border border-(--cf-line) bg-(--cf-cream-2)" />
          </div>
          <div className="mt-2">
            <span
              className="block h-3 w-16"
              style={{ background: isPublished ? "var(--cf-ink)" : "var(--cf-orange)" }}
            />
          </div>
        </div>
      </div>

      {/* title + meta */}
      <div className="flex-1 space-y-3">
        <span
          className="cf-meta inline-block border px-2 py-1"
          style={{
            borderColor: isPublished ? "var(--cf-orange)" : "var(--cf-line-strong)",
            color: isPublished ? "var(--cf-orange)" : "var(--cf-ink-soft)",
          }}
        >
          {isPublished ? "Published" : "Draft"}
        </span>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="cf-display line-clamp-1 text-[19px] leading-tight uppercase sm:text-[21px]">
              {form.title}
            </h3>
            {form.role && form.role !== "owner" && (
              <span className="inline-flex items-center gap-1 border border-(--cf-line-strong) bg-(--cf-cream) px-1.5 py-0.5 font-mono text-[10px] text-(--cf-ink-soft) capitalize">
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
              className="shrink-0 cursor-pointer border border-transparent p-1.5 transition-colors hover:border-(--cf-line-strong)"
              style={{ color: "var(--cf-ink-soft)" }}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>

        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-(--cf-ink-soft)">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 shrink-0" aria-hidden />
            <dt className="sr-only">Responses</dt>
            <dd className="tabular-nums text-(--cf-ink)">{responses}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            <dt className="sr-only">{isPublished ? "Published" : "Last edited"}</dt>
            <dd>
              {isPublished
                ? formatDate(form.publishedAt || form.createdAt)
                : getRelativeTime(form.updatedAt)}
            </dd>
          </div>
        </dl>
      </div>

      {/* actions */}
      <div className="flex gap-2 pt-1">
        {isPublished ? (
          <Link
            href={`/dashboard/sketches/${form.id}`}
            className="cf-btn group/btn h-9.5 flex-1 px-4 text-[12.5px]"
            style={{ background: "var(--cf-ink)" }}
          >
            Open
            <ArrowUpRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
          </Link>
        ) : (
          <Link
            href={`/dashboard/sketches/${form.id}`}
            className="cf-btn group/btn h-9.5 flex-1 px-4 text-[12.5px]"
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
          className="cf-btn-outline size-9.5 shrink-0"
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
    <div className="cf-panel mx-auto max-w-2xl space-y-4 border-dashed p-10 text-center sm:p-16">
      <p className="cf-meta">{hasFilters ? "Nothing found" : "Empty studio"}</p>
      <h3 className="cf-display text-[30px] leading-tight sm:text-[44px]">
        {hasFilters ? "No matches" : "Start your first form"}
      </h3>
      <p className="text-[13.5px] text-(--cf-ink-soft) leading-relaxed max-w-sm mx-auto">
        {hasFilters
          ? "Try a different search or clear your filters to see all forms."
          : "Sketch on an open canvas in minutes. Free to start, no card required."}
      </p>
      <div className="flex items-center justify-center gap-3 pt-1">
        {hasFilters && (
          <button onClick={onClearFilters} className="cf-btn-outline px-4 py-2 text-[13px]">
            Clear filters
          </button>
        )}
        <button onClick={onCreate} className="cf-btn cf-raised cf-press h-10.5 px-6 text-[13px]">
          <Plus className="size-4" />
          New form
        </button>
      </div>
    </div>
  );
}
