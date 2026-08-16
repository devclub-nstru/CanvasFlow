"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Play,
  Plus,
  Search,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { MOCK_PRESENTATION } from "~/lib/mock-menti";
import { MentiPresentation } from "~/lib/menti";
import { useDebounce } from "~/hooks/useDebounce";
import { CustomSelect } from "~/components/ui/CustomSelect";
import { toast } from "sonner";
import { useGetPresentations } from "~/hooks/api/menti/useGetPresentations";
import { useDashboard } from "~/providers/dashboard-provider";
import { env } from "~/env";

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
  { id: "ARCHIVED", label: "Archived" },
];

const ITEMS_PER_PAGE = 6;

/* ─── page ──────────────────────────────────────────────────────────── */

export default function MentiDashboardPage() {
  const router = useRouter();
  const { presentations, isLoading: isPresentationsLoading, refetch } = useGetPresentations();
  const { openCreateMentiModal } = useDashboard();
  
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"createdAt" | "title" | "updatedAt">("updatedAt");
  const [filter, setFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteWordInput, setDeleteWordInput] = useState("");
  const [deleteTitleInput, setDeleteTitleInput] = useState("");

  useEffect(() => {
    setDeleteWordInput("");
    setDeleteTitleInput("");
  }, [confirmDeleteId]);

  const debouncedSearch = useDebounce(search, 200);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const processedPresentations = useMemo(() => {
    let result = [...presentations];

    if (filter === "ALL") result = result.filter((p) => p.isLive || !p.isLive);
    else if (filter === "DRAFTS") result = result.filter((p) => !p.isLive);
    else if (filter === "PUBLISHED") result = result.filter((p) => p.isLive);
    else if (filter === "ARCHIVED") result = [];

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.joinCode.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      if (sort === "updatedAt") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sort === "createdAt") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sort === "title") return a.title.localeCompare(b.title);
      return 0;
    });

    return result;
  }, [presentations, filter, debouncedSearch, sort]);

  const totalPages = Math.ceil(processedPresentations.length / ITEMS_PER_PAGE) || 1;
  const paginatedPresentations = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return processedPresentations.slice(start, start + ITEMS_PER_PAGE);
  }, [processedPresentations, page]);

  const handleCreateNew = () => {
    openCreateMentiModal();
  };

  const handleDelete = async (id: string) => {
    try {
      const baseUrl = env.NEXT_PUBLIC_MENTI_API_URL || "http://localhost:8080";
      const res = await fetch(`${baseUrl}/api/presentations/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Presentation deleted");
      setConfirmDeleteId(null);
      refetch();
    } catch(err) {
      toast.error("Failed to delete presentation");
    }
  };

  const confirmDeletePresentation = presentations.find((p) => p.id === confirmDeleteId);
  const hasActiveFilters = !!search || filter !== "ALL";

  return (
    <div className="space-y-8">
      {/* ───── hero + toolbar ───── */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="shrink-0">
          <h1 className="cf-display text-[32px] leading-[0.95] uppercase sm:text-[42px] md:text-[52px]">
            Menti
            <span style={{ color: "var(--cf-orange)" }}>.</span>
          </h1>
          <p className="mt-3 max-w-xs font-mono text-[13px] leading-relaxed text-(--cf-ink-soft)">
            Design, present, and decode your live audience workflows.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-xl">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
              style={{ color: "var(--cf-ink-soft)" }}
            />
            <label htmlFor="menti-search" className="sr-only">
              Search mentis
            </label>
            <input
              id="menti-search"
              type="text"
              placeholder="Search forms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full border border-(--cf-line-strong) bg-(--cf-cream-2) pr-3 pl-11 text-[14px] transition-shadow placeholder:text-(--cf-ink-soft) focus:shadow-[3px_3px_0_0_var(--cf-line-strong)] focus:outline-none"
            />
          </div>

          <ToolbarSelect
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as "createdAt" | "title" | "updatedAt")}
            options={[
              { value: "updatedAt", label: "Last updated" },
              { value: "createdAt", label: "Newest" },
              { value: "title", label: "Title" },
            ]}
          />
        </div>
      </div>

      {/* ───── status filter tabs ───── */}
      <div className="flex flex-wrap gap-4 sm:gap-6 border-b border-(--cf-line-strong) text-[11px] font-mono uppercase tracking-wider">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
              className={`pb-2.5 transition-colors border-b-2 cursor-pointer font-bold ${
                active
                  ? "border-(--cf-orange) text-(--cf-orange)"
                  : "border-transparent text-(--cf-ink-soft) hover:text-(--cf-ink)"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* ───── result count rule ───── */}
      <div className="flex items-end justify-between gap-4 pb-1">
        <p className="cf-meta">{hasActiveFilters ? "Filtered" : "All forms"}</p>
        <p className="cf-meta">
          {processedPresentations.length}{" "}
          {processedPresentations.length === 1 ? "result" : "results"}
        </p>
      </div>

      {/* ───── grid or empty state ───── */}
      {isPresentationsLoading ? (
        <div className="cf-panel mx-auto max-w-2xl space-y-4 border-dashed p-10 text-center sm:p-16">
          <p className="cf-meta">Loading presentations...</p>
        </div>
      ) : paginatedPresentations.length === 0 ? (
        <EmptyState
          onCreate={handleCreateNew}
          hasFilters={hasActiveFilters}
          onClearFilters={() => {
            setSearch("");
            setFilter("ALL");
            setPage(1);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {paginatedPresentations.map((pres) => (
            <MentiCard
              key={pres.id}
              presentation={pres}
              onDelete={() => setConfirmDeleteId(pres.id)}
            />
          ))}
        </div>
      )}

      {/* ───── pagination ───── */}
      {processedPresentations.length > ITEMS_PER_PAGE && (
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

      {/* ───── delete modal ───── */}
      {confirmDeleteId && confirmDeletePresentation && (
        <div className="cf-scrim z-300">
          <div className="cf-dark cf-crop w-full max-w-md">
            <div className="relative z-1 p-6 sm:p-8">
              <p className="cf-dark-meta" style={{ color: "var(--c-red)" }}>
                Permanent action
              </p>
              <h3 className="cf-display mt-3 text-[26px] leading-none uppercase sm:text-[32px]">
                Delete menti
                <span style={{ color: "var(--c-red)" }}>.</span>
              </h3>
              <p
                className="mt-3 text-[13.5px] leading-relaxed"
                style={{ color: "var(--cfd-text-soft)" }}
              >
                <span className="font-medium" style={{ color: "var(--cfd-text)" }}>
                  &ldquo;{confirmDeletePresentation.title}&rdquo;
                </span>{" "}
                and all its slides and participant responses will be permanently removed.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="dashboard-confirm-delete-word"
                    className="block text-[11px] font-mono mb-1.5 uppercase"
                    style={{ color: "var(--cfd-text-soft)" }}
                  >
                    Type <span className="font-bold text-white">delete</span> to confirm:
                  </label>
                  <input
                    id="dashboard-confirm-delete-word"
                    type="text"
                    value={deleteWordInput}
                    onChange={(e) => setDeleteWordInput(e.target.value)}
                    placeholder="delete"
                    className="w-full h-9 border border-zinc-700 bg-zinc-900 text-white px-3 text-[13px] transition-shadow focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="dashboard-confirm-delete-title"
                    className="block text-[11px] font-mono mb-1.5 uppercase"
                    style={{ color: "var(--cfd-text-soft)" }}
                  >
                    Type presentation name{" "}
                    <span className="font-bold text-white">
                      {confirmDeletePresentation.title}
                    </span>{" "}
                    to confirm:
                  </label>
                  <input
                    id="dashboard-confirm-delete-title"
                    type="text"
                    value={deleteTitleInput}
                    onChange={(e) => setDeleteTitleInput(e.target.value)}
                    placeholder={confirmDeletePresentation.title}
                    className="w-full h-9 border border-zinc-700 bg-zinc-900 text-white px-3 text-[13px] transition-shadow focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="cf-dark-btn-outline px-4 py-2 text-[13px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  disabled={
                    deleteWordInput.trim().toLowerCase() !== "delete" ||
                    deleteTitleInput.trim().toLowerCase() !==
                      confirmDeletePresentation.title.toLowerCase()
                  }
                  className="cf-btn px-5 py-2 text-[13px] text-white hover:!bg-[#b54a41] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  style={{
                    background: "var(--c-red)",
                    borderColor: "var(--cfd-line-strong)",
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
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

/* ─── menti card ─────────────────────────────────────────────────────── */

interface MentiCardProps {
  presentation: MentiPresentation;
  onDelete: () => void;
}

function MentiCard({ presentation, onDelete }: MentiCardProps) {
  const isPublished = presentation.isLive;
  const responses = (presentation.slides || []).reduce(
    (acc, s) => acc + (s.totalResponses || 0),
    0,
  );

  return (
    <div className="cf-panel cf-raised cf-press group relative flex flex-col gap-4 p-4 sm:p-5">
      <span
        aria-hidden
        className="absolute top-0 right-0 z-10 size-4 border-b border-l border-(--cf-line-strong)"
        style={{
          background: isPublished ? "var(--cf-orange)" : "var(--cf-ink-soft)",
        }}
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
            background: "transparent",
          }}
        >
          {isPublished ? "Live" : "Draft"}
        </span>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="cf-display line-clamp-1 text-[19px] leading-tight uppercase sm:text-[21px]">
              {presentation.title}
            </h3>
            <span className="inline-flex items-center gap-1 border border-(--cf-line-strong) bg-(--cf-cream) px-1.5 py-0.5 font-mono text-[10px] text-(--cf-ink-soft)">
              PIN: {presentation.joinCode}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            title="Delete menti"
            aria-label="Delete menti"
            className="shrink-0 cursor-pointer border border-transparent p-1.5 transition-colors hover:border-(--cf-line-strong)"
            style={{ color: "var(--cf-ink-soft)" }}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-(--cf-ink-soft)">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 shrink-0" aria-hidden />
            <dt className="sr-only">Responses</dt>
            <dd className="tabular-nums text-(--cf-ink)">{responses}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            <dt className="sr-only">Last edited</dt>
            <dd>{getRelativeTime(presentation.updatedAt)}</dd>
          </div>
        </dl>
      </div>

      {/* action strip */}
      <div className="flex items-center gap-2 border-t border-(--cf-line) pt-4">
        <Link
          href={`/menti/${presentation.id}/edit`}
          className="cf-btn group/btn h-9.5 flex-1 px-4 text-[12.5px]"
        >
          Edit
          <ArrowUpRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
        </Link>
        <Link
          href={`/menti/${presentation.id}/present`}
          className="cf-btn-outline h-9.5 flex-1 px-4 text-[12.5px] flex items-center justify-center gap-1.5"
        >
          <Play className="size-3.5" />
          Present
        </Link>
        <Link
          href={`/menti/${presentation.id}/results`}
          className="cf-btn-outline h-9.5 flex-1 px-4 text-[12.5px] flex items-center justify-center gap-1.5"
        >
          Results
        </Link>
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
          ? "Try a different search or clear your filters to see all presentations."
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
