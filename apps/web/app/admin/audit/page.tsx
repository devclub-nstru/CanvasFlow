"use client";

import React from "react";
import { ScrollText } from "lucide-react";

import { Pager } from "~/components/admin/Pager";
import { useAuditLog } from "~/hooks/api/admin";
import { AUDIT_CATEGORIES, AUDIT_LABEL, type AuditCategory } from "~/lib/admin-audit";

function stamp(value: unknown): string {
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function describe(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const entries = Object.entries(detail as Record<string, unknown>);
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
}

export default function AdminAuditPage() {
  const [page, setPage] = React.useState(0);
  const [category, setCategory] = React.useState<AuditCategory | "all">("all");

  const { entries, total, isLoading, pageCount } = useAuditLog({
    page,
    category: category === "all" ? undefined : category,
  });

  return (
    <div className="max-w-250 space-y-6">
      <div>
        <p className="cf-meta">History</p>
        <h1 className="cf-display mt-3 text-[32px] leading-none sm:text-[42px]">
          Audit log
          <span style={{ color: "var(--cf-orange)" }}>.</span>
        </h1>
        <p className="mt-3 text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
          Every suspension, sign-out, reset, and role change made from this panel.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {AUDIT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCategory(c.id);
              /* Narrowing can leave the current page past the end of the new
                 result set, which reads as "nothing recorded". */
              setPage(0);
            }}
            className="cf-btn-outline h-8 px-3 text-[10px] font-bold tracking-[0.16em] uppercase"
            style={
              category === c.id ? { background: "var(--cf-ink)", color: "var(--cf-cream)" } : undefined
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="cf-panel cf-raised">
        <div className="border-b px-4 py-3" style={{ borderBottomColor: "var(--cf-line)" }}>
          <p className="cf-meta">
            {isLoading ? "Loading…" : `${total} entr${total === 1 ? "y" : "ies"}`}
          </p>
        </div>

        {!isLoading && entries.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <ScrollText className="size-6" style={{ color: "var(--cf-ink-soft)" }} />
            <p className="text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
              {category === "all"
                ? "Nothing recorded yet. Actions taken from the panel show up here."
                : "Nothing in this group yet."}
            </p>
          </div>
        )}

        <ul className="divide-y" style={{ borderColor: "var(--cf-line)" }}>
          {entries.map((e) => {
            const extra = describe(e.detail);
            return (
              <li key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] font-medium">
                    {AUDIT_LABEL[e.action] ?? e.action}
                    {e.targetLabel && (
                      <span className="font-normal" style={{ color: "var(--cf-ink-soft)" }}>
                        {" — "}
                        {e.targetLabel}
                      </span>
                    )}
                  </p>
                  <p className="cf-meta shrink-0" style={{ color: "var(--cf-ink-soft)" }}>
                    {stamp(e.createdAt)}
                  </p>
                </div>
                <p className="mt-1 text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
                  by {e.actorEmail}
                  {extra ? ` · ${extra}` : ""}
                </p>
              </li>
            );
          })}
        </ul>

        <Pager page={page} pageCount={pageCount} total={total} noun="entry" onChange={setPage} />
      </div>
    </div>
  );
}
