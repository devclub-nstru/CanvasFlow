"use client";

import React, { useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";

import { rateColor, SEMANTIC } from "./palette";

interface FieldRate {
  fieldId: string;
  fieldLabel: string;
  rate: number;
}

interface FormField {
  id: string;
  label: string;
  type: string;
}

interface SubmissionValue {
  formFieldId: string;
  value: unknown;
}

interface Submission {
  id: string;
  values: SubmissionValue[];
  createdAt: string;
}

interface FieldDropoffProps {
  fieldCompletionRates: FieldRate[];
  fields: FormField[];
  submissions: Submission[];
}

/** Render any stored answer shape as readable text. */
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

/**
 * Per-field completion, with a drill-down into the answers.
 *
 * The rates come from the Pro payload, but the answers behind them come from
 * `submissions`, which the analytics page already has in memory — so opening a
 * field costs no extra request.
 */
export function FieldDropoff({ fieldCompletionRates, fields, submissions }: FieldDropoffProps) {
  const [openFieldId, setOpenFieldId] = useState<string | null>(null);

  // Index answers by field once, rather than scanning every submission each
  // time a row is opened.
  const answersByField = useMemo(() => {
    const map = new Map<string, { submissionId: string; createdAt: string; text: string }[]>();
    for (const sub of submissions) {
      for (const v of sub.values ?? []) {
        const text = formatValue(v.value);
        if (!text) continue;
        const list = map.get(v.formFieldId) ?? [];
        list.push({ submissionId: sub.id, createdAt: sub.createdAt, text });
        map.set(v.formFieldId, list);
      }
    }
    return map;
  }, [submissions]);

  const rows = useMemo(() => {
    // Prefer the server's field order; fall back to the rates list for fields
    // the form no longer has.
    const byId = new Map(fieldCompletionRates.map((r) => [r.fieldId, r]));
    const ordered: (FieldRate & { type?: string })[] = [];
    for (const f of fields) {
      const r = byId.get(f.id);
      if (r) {
        ordered.push({ ...r, type: f.type });
        byId.delete(f.id);
      }
    }
    for (const leftover of byId.values()) ordered.push(leftover);
    return ordered;
  }, [fieldCompletionRates, fields]);

  const openField = rows.find((r) => r.fieldId === openFieldId) ?? null;
  const openAnswers = openFieldId ? (answersByField.get(openFieldId) ?? []) : [];

  if (rows.length === 0) {
    return (
      <div className="cf-panel p-6 text-center sm:p-10">
        <p className="cf-meta">No fields</p>
        <p className="mt-3 text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
          Add fields to this form to see per-question completion.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="cf-panel overflow-hidden">
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5"
          style={{ borderBottomColor: "var(--cf-line)" }}
        >
          <div>
            <p className="cf-meta">Drop-off by field</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--cf-ink-soft)" }}>
              Share of people who started the form and answered each field. Select one to read
              its answers.
            </p>
          </div>
          <span className="cf-meta shrink-0">{rows.length} fields</span>
        </div>

        <ul>
          {rows.map((row, i) => {
            const answered = answersByField.get(row.fieldId)?.length ?? 0;
            const colour = rateColor(row.rate);
            return (
              <li
                key={row.fieldId}
                style={{ borderTopColor: "var(--cf-line)" }}
                className={i === 0 ? "" : "border-t"}
              >
                <button
                  type="button"
                  onClick={() => setOpenFieldId(row.fieldId)}
                  className="group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--cf-cream) sm:gap-4 sm:px-5"
                >
                  <span
                    className="cf-meta w-6 shrink-0 tabular-nums"
                    style={{ color: "var(--cf-ink-muted)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">
                      {row.fieldLabel}
                    </span>
                    {/* The bar is the quantity; the number beside it is the
                        same value for anyone who can't compare lengths. */}
                    <span className="mt-1.5 flex items-center gap-2">
                      <span
                        className="h-1.5 flex-1 overflow-hidden"
                        style={{ background: "var(--cf-line)" }}
                      >
                        <span
                          className="block h-full"
                          style={{ width: `${Math.min(row.rate, 100)}%`, background: colour }}
                        />
                      </span>
                      <span
                        className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums"
                        style={{ color: colour }}
                      >
                        {row.rate}%
                      </span>
                    </span>
                  </span>

                  <span
                    className="hidden shrink-0 font-mono text-[11px] tabular-nums sm:block"
                    style={{ color: "var(--cf-ink-soft)" }}
                  >
                    {answered} {answered === 1 ? "answer" : "answers"}
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: "var(--cf-ink-muted)" }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {openField && (
        <FieldAnswersDialog
          label={openField.fieldLabel}
          rate={openField.rate}
          answers={openAnswers}
          onClose={() => setOpenFieldId(null)}
        />
      )}
    </>
  );
}

/* ─── answers dialog ─────────────────────────────────────────────────── */

function FieldAnswersDialog({
  label,
  rate,
  answers,
  onClose,
}: {
  label: string;
  rate: number;
  answers: { submissionId: string; createdAt: string; text: string }[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  // Close on Escape, and restore the page's scroll lock on unmount.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return answers;
    return answers.filter((a) => a.text.toLowerCase().includes(q));
  }, [answers, query]);

  // Repeated answers are the useful signal on choice fields, so tally them.
  const tally = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of answers) counts.set(a.text, (counts.get(a.text) ?? 0) + 1);
    const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    // Only worth showing when answers actually repeat — on a free-text field
    // every value is unique and a tally is just the list again.
    return list.length > 0 && list.length < answers.length ? list.slice(0, 6) : [];
  }, [answers]);

  return (
    <div
      className="cf-scrim z-300"
      role="dialog"
      aria-modal="true"
      aria-label={`Answers for ${label}`}
      onClick={onClose}
    >
      <div
        className="cf-dark cf-crop flex max-h-[85vh] w-full max-w-2xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative z-1 flex min-h-0 flex-col">
          {/* header */}
          <div
            className="flex items-start justify-between gap-4 border-b p-5 sm:p-6"
            style={{ borderBottomColor: "var(--cfd-line)" }}
          >
            <div className="min-w-0">
              <p className="cf-dark-meta">Field responses</p>
              <h3 className="cf-display mt-2 truncate text-[22px] leading-tight sm:text-[26px]">
                {label}
              </h3>
              <p className="mt-2 font-mono text-[11px]" style={{ color: "var(--cfd-text-soft)" }}>
                <span style={{ color: rateColor(rate) }}>{rate}%</span> completion ·{" "}
                <span style={{ color: "var(--cfd-text)" }}>{answers.length}</span>{" "}
                {answers.length === 1 ? "answer" : "answers"}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="cf-dark-btn-outline size-8 shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* most common answers */}
          {tally.length > 0 && (
            <div className="border-b p-5 sm:p-6" style={{ borderBottomColor: "var(--cfd-line)" }}>
              <p className="cf-dark-meta mb-3">Most common</p>
              <div className="space-y-2">
                {tally.map(([text, count]) => {
                  const pct = answers.length > 0 ? (count / answers.length) * 100 : 0;
                  return (
                    <div key={text} className="flex items-center gap-3">
                      <span
                        className="w-40 shrink-0 truncate text-[12.5px]"
                        style={{ color: "var(--cfd-text)" }}
                      >
                        {text}
                      </span>
                      <span
                        className="h-2 flex-1 overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.08)" }}
                      >
                        <span
                          className="block h-full"
                          style={{ width: `${pct}%`, background: SEMANTIC.accent }}
                        />
                      </span>
                      <span
                        className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums"
                        style={{ color: "var(--cfd-text-soft)" }}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* search */}
          <div className="border-b p-4 sm:px-6" style={{ borderBottomColor: "var(--cfd-line)" }}>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                style={{ color: "var(--cfd-text-muted)" }}
              />
              <label htmlFor="field-answer-search" className="sr-only">
                Search answers
              </label>
              <input
                id="field-answer-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search answers..."
                className="cf-dark-input h-10 pr-3 pl-10 text-[13px]"
              />
            </div>
          </div>

          {/* answer list */}
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p
                className="p-6 text-center text-[13px] sm:p-10"
                style={{ color: "var(--cfd-text-soft)" }}
              >
                {answers.length === 0
                  ? "Nobody has answered this field yet."
                  : "No answers match that search."}
              </p>
            ) : (
              <ul>
                {filtered.map((a, i) => (
                  <li
                    key={`${a.submissionId}-${i}`}
                    className={i === 0 ? "p-4 sm:px-6" : "border-t p-4 sm:px-6"}
                    style={{ borderTopColor: "var(--cfd-line)" }}
                  >
                    <p
                      className="text-[13.5px] leading-relaxed wrap-break-word"
                      style={{ color: "var(--cfd-text)" }}
                    >
                      {a.text}
                    </p>
                    <p
                      className="mt-1.5 font-mono text-[10px]"
                      style={{ color: "var(--cfd-text-muted)" }}
                    >
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className="flex items-center justify-between border-t px-5 py-3 sm:px-6"
            style={{ borderTopColor: "var(--cfd-line)" }}
          >
            <span className="cf-dark-meta">
              Showing {filtered.length} of {answers.length}
            </span>
            <button onClick={onClose} className="cf-dark-btn-outline px-4 py-1.5 text-[12px]">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
