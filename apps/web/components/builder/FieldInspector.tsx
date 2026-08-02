"use client";

import React from "react";
import { MousePointerClick, SlidersHorizontal, Trash2 } from "lucide-react";
import { GitBranch, Pencil } from "lucide-react";
import { getFieldIcon } from "./FormFieldNode";
import { CustomSelect } from "~/components/ui/CustomSelect";

export interface FieldFlowProps {
  segmentOptions?: Array<{ id: string; label: string }>;
  currentSegmentId?: string | null;
  onChangeSegment?: (segmentId: string | null) => void;
  ruleSummaries?: string[];
  incompleteRuleCount?: number;
  onEditBranching?: () => void;
  isLastInSegment?: boolean;
}

export interface FieldInspectorProps extends FieldFlowProps {
  selectedField: any;
  label: string;
  setLabel: (val: string) => void;
  placeholder: string;
  setPlaceholder: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  isRequired: boolean;
  handleRequiredChange: (checked: boolean) => void;
  optionsList: string[];
  setOptionsList: (opts: string[]) => void;
  updateLocal: (id: string, patch: Record<string, any>) => void;
  handleDeleteField: () => void;
}

/* ─── helpers ────────────────────────────────────────────────────────── */

function mergeChoices(currentOptions: any, nextChoices: string[]): Record<string, any> {
  const base =
    currentOptions && typeof currentOptions === "object" && !Array.isArray(currentOptions)
      ? (currentOptions as Record<string, any>)
      : {};
  return { ...base, choices: nextChoices };
}

const PRESET_FILE_TYPES = [
  { label: "Any allowed type", value: "" },
  { label: "PDF", value: "application/pdf" },
  { label: "Images", value: "image/*" },
  { label: "ZIP & Archives", value: "application/zip, application/x-zip-compressed, .zip" },
  {
    label: "Word Documents",
    value:
      "application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, .doc, .docx",
  },
  {
    label: "Excel Spreadsheets",
    value:
      "application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv, .xls, .xlsx, .csv",
  },
];

const normalizeForMatch = (str: string) =>
  str
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");

/* ─── primitives ─────────────────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return <label className="cf-meta mb-1.5 block">{children}</label>;
}

const INPUT_CLS = "cf-input h-[36px] px-3 text-[13px]";

function Section({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="cf-section">
      {title && (
        <div className="cf-section-bar">
          <p className="cf-meta">{title}</p>
        </div>
      )}
      <div className="cf-section-body space-y-3">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      type="button"
      role="switch"
      aria-checked={on}
      className="cf-toggle"
    >
      <span />
    </button>
  );
}

export function FieldInspectorBody({
  selectedField,
  label,
  setLabel,
  placeholder,
  setPlaceholder,
  description,
  setDescription,
  isRequired,
  handleRequiredChange,
  optionsList,
  setOptionsList,
  updateLocal,
  segmentOptions,
  currentSegmentId,
  onChangeSegment,
  ruleSummaries,
  incompleteRuleCount,
  onEditBranching,
  isLastInSegment,
}: Omit<FieldInspectorProps, "handleDeleteField">) {
  return (
    <div className="space-y-3">
      <Section title="General">
        <div>
          <Label>Label</Label>
          <input
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              updateLocal(selectedField.id, { label: e.target.value });
            }}
            placeholder="Enter field label..."
            className={INPUT_CLS}
          />
        </div>

        <div>
          <Label>Placeholder</Label>
          <input
            type="text"
            value={placeholder}
            onChange={(e) => {
              setPlaceholder(e.target.value);
              updateLocal(selectedField.id, { placeholder: e.target.value });
            }}
            placeholder="Hint text..."
            className={INPUT_CLS}
          />
        </div>

        <div>
          <Label>Help text</Label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              updateLocal(selectedField.id, { description: e.target.value });
            }}
            placeholder="Optional description..."
            rows={2}
            className="cf-input resize-none px-3 py-2 text-[13px]"
          />
        </div>
      </Section>

      <Section title="Validation">
        <div className="flex items-center justify-between gap-3 border border-(--cf-line) bg-(--cf-cream) px-2.5 py-2">
          <div className="min-w-0">
            <p className="text-[13px] text-(--cf-ink)">Required</p>
            <p className="text-[11px] text-(--cf-ink-soft)">Force an answer</p>
          </div>
          <Toggle on={isRequired} onChange={handleRequiredChange} />
        </div>
      </Section>

      {(selectedField.type === "SELECT" || selectedField.type === "CHECKBOX") && (
        <Section title="Options">
          <div className="space-y-1.5">
            {optionsList.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className="size-3 shrink-0 border"
                  style={{ borderColor: "var(--cf-line-strong)" }}
                />
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...optionsList];
                    next[idx] = e.target.value;
                    setOptionsList(next);
                    updateLocal(selectedField.id, {
                      options: mergeChoices(selectedField.options, next),
                    });
                  }}
                  className="cf-input h-8.5 min-w-0 flex-1 px-2.5 text-[12.5px]"
                />
                <button
                  onClick={() => {
                    const next = optionsList.filter((_, i) => i !== idx);
                    setOptionsList(next);
                    updateLocal(selectedField.id, {
                      options: mergeChoices(selectedField.options, next),
                    });
                  }}
                  disabled={optionsList.length <= 1}
                  className="cf-danger-ghost shrink-0 cursor-pointer p-1.5 transition-colors disabled:opacity-30"
                  aria-label="Remove option"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const next = [...optionsList, `Option ${optionsList.length + 1}`];
              setOptionsList(next);
              updateLocal(selectedField.id, {
                options: mergeChoices(selectedField.options, next),
              });
            }}
            className="cf-add-dashed w-full cursor-pointer border border-dashed py-2 text-[12px]"
          >
            + Add option
          </button>
        </Section>
      )}

      {selectedField.type === "RATING" && (
        <Section title="Rating scale">
          <div>
            <Label>Max stars</Label>
            <CustomSelect
              value={(selectedField.options as any)?.max || 5}
              onChange={(val) =>
                updateLocal(selectedField.id, {
                  options: {
                    ...((selectedField.options as any) || {}),
                    max: parseInt(val, 10),
                  },
                })
              }
              options={[
                { value: 3, label: "3 — Small" },
                { value: 5, label: "5 — Standard" },
                { value: 10, label: "10 — Detailed" },
              ]}
            />
          </div>
        </Section>
      )}

      {selectedField.type === "DATE" && (
        <Section title="Date range">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Min date</Label>
              <input
                type="date"
                value={(selectedField.options as any)?.minDate || ""}
                onChange={(e) =>
                  updateLocal(selectedField.id, {
                    options: {
                      ...((selectedField.options as any) || {}),
                      minDate: e.target.value,
                    },
                  })
                }
                className={INPUT_CLS}
              />
            </div>
            <div>
              <Label>Max date</Label>
              <input
                type="date"
                value={(selectedField.options as any)?.maxDate || ""}
                onChange={(e) =>
                  updateLocal(selectedField.id, {
                    options: {
                      ...((selectedField.options as any) || {}),
                      maxDate: e.target.value,
                    },
                  })
                }
                className={INPUT_CLS}
              />
            </div>
          </div>
        </Section>
      )}

      {selectedField.type === "TIME" && (
        <Section title="Time range">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Min time</Label>
              <input
                type="time"
                value={(selectedField.options as any)?.minTime || ""}
                onChange={(e) =>
                  updateLocal(selectedField.id, {
                    options: {
                      ...((selectedField.options as any) || {}),
                      minTime: e.target.value,
                    },
                  })
                }
                className={INPUT_CLS}
              />
            </div>
            <div>
              <Label>Max time</Label>
              <input
                type="time"
                value={(selectedField.options as any)?.maxTime || ""}
                onChange={(e) =>
                  updateLocal(selectedField.id, {
                    options: {
                      ...((selectedField.options as any) || {}),
                      maxTime: e.target.value,
                    },
                  })
                }
                className={INPUT_CLS}
              />
            </div>
          </div>
        </Section>
      )}

      {selectedField.type === "TOGGLE" && (
        <Section title="Toggle">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-(--cf-ink)">Default on</p>
            <Toggle
              on={!!(selectedField.options as any)?.defaultValue}
              onChange={(v) =>
                updateLocal(selectedField.id, {
                  options: {
                    ...((selectedField.options as any) || {}),
                    defaultValue: v,
                  },
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Active label</Label>
              <input
                type="text"
                defaultValue={(selectedField.options as any)?.activeLabel || "Yes"}
                onBlur={(e) =>
                  updateLocal(selectedField.id, {
                    options: {
                      ...((selectedField.options as any) || {}),
                      activeLabel: e.target.value || "Yes",
                    },
                  })
                }
                className={INPUT_CLS}
              />
            </div>
            <div>
              <Label>Inactive label</Label>
              <input
                type="text"
                defaultValue={(selectedField.options as any)?.inactiveLabel || "No"}
                onBlur={(e) =>
                  updateLocal(selectedField.id, {
                    options: {
                      ...((selectedField.options as any) || {}),
                      inactiveLabel: e.target.value || "No",
                    },
                  })
                }
                className={INPUT_CLS}
              />
            </div>
          </div>
        </Section>
      )}

      {selectedField.type === "FILE_UPLOAD" && (
        <Section title="File upload">
          <div>
            <Label>Files per response</Label>
            <CustomSelect
              value={(selectedField.options as any)?.maxFiles || 1}
              onChange={(val) =>
                updateLocal(selectedField.id, {
                  options: {
                    ...((selectedField.options as any) || {}),
                    maxFiles: parseInt(val, 10),
                  },
                })
              }
              options={[1, 2, 3, 4, 5, 8, 10, 15, 20].map((n) => ({
                value: n,
                label: n === 1 ? "1 — Single file" : `${n} files`,
              }))}
            />
            <p className="mt-1 text-[11px] text-(--cf-ink-soft)">
              Respondents upload one at a time, so each file gets its own progress and retry.
            </p>
          </div>

          <div>
            <Label>Max size per file</Label>
            <CustomSelect
              value={(selectedField.options as any)?.maxMb || ""}
              onChange={(val) => {
                const next = { ...((selectedField.options as any) || {}) };
                if (val) next.maxMb = parseInt(val, 10);
                else delete next.maxMb;
                updateLocal(selectedField.id, { options: next });
              }}
              options={[
                { value: "", label: "Server limit" },
                ...[1, 2, 5, 10, 25, 50, 100].map((n) => ({
                  value: n,
                  label: `${n} MB`,
                })),
              ]}
            />
            <p className="mt-1 text-[11px] text-(--cf-ink-soft)">
              Clamped by the server&apos;s own cap, so this can only be stricter.
            </p>
          </div>

          <div>
            <Label>Accepted types</Label>
            {(() => {
              const currentAcceptArr = (selectedField.options as any)?.accept || [];
              const currentAcceptStr = Array.isArray(currentAcceptArr)
                ? currentAcceptArr.join(", ")
                : "";

              const matchedPreset = PRESET_FILE_TYPES.find(
                (preset) => normalizeForMatch(preset.value) === normalizeForMatch(currentAcceptStr),
              );

              const selectValue = matchedPreset ? matchedPreset.value : "";

              return (
                <CustomSelect
                  value={selectValue}
                  onChange={(val) => {
                    const next = { ...((selectedField.options as any) || {}) };
                    if (val) {
                      next.accept = String(val)
                        .split(",")
                        .map((s) => s.trim());
                    } else {
                      delete next.accept;
                    }
                    updateLocal(selectedField.id, { options: next });
                  }}
                  options={PRESET_FILE_TYPES}
                />
              );
            })()}
            <p className="mt-1 text-[11px] text-(--cf-ink-soft)">
              Narrow down accepted file types. Leave as Any allowed type to accept everything the
              server allows.
            </p>
          </div>
        </Section>
      )}

      {/* ── flow: which page this question is on, and where answers lead ── */}
      {segmentOptions && segmentOptions.length > 0 && onChangeSegment && (
        <Section title="Segment">
          <div>
            <Label>This question belongs to</Label>
            <CustomSelect
              value={currentSegmentId ?? ""}
              onChange={(val) => onChangeSegment(val || null)}
              options={[
                ...(!currentSegmentId ? [{ value: "", label: "Not in a segment" }] : []),
                ...segmentOptions.map((option) => ({
                  value: option.id,
                  label: option.label,
                })),
              ]}
            />
          </div>
        </Section>
      )}

      {onEditBranching && (
        <Section title="Branching">
          {ruleSummaries && ruleSummaries.length > 0 ? (
            <ol className="space-y-1.5">
              {ruleSummaries.map((summary, i) => (
                <li
                  key={i}
                  className="border-l-2 pl-2.5 text-[12px] leading-relaxed text-(--cf-ink-soft)"
                  style={{ borderLeftColor: "var(--cf-orange)" }}
                >
                  {summary}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[12px] leading-relaxed text-(--cf-ink-soft)">
              {isLastInSegment
                ? "This is the last question of its segment — a good place to send people to different segments based on their answers."
                : "Route people to different questions based on the answers so far."}
            </p>
          )}

          {!!incompleteRuleCount && incompleteRuleCount > 0 && (
            <p className="text-[11px] leading-relaxed text-(--cf-orange)">
              {incompleteRuleCount} {incompleteRuleCount === 1 ? "branch is" : "branches are"} not
              finished and {incompleteRuleCount === 1 ? "does" : "do"} nothing yet.
            </p>
          )}

          <button
            type="button"
            onClick={onEditBranching}
            className="cf-btn cf-press h-9 w-full text-[12.5px]"
          >
            {ruleSummaries && ruleSummaries.length > 0 ? (
              <>
                <Pencil className="size-3.5" />
                Edit branching
              </>
            ) : (
              <>
                <GitBranch className="size-3.5" />
                Add branching
              </>
            )}
          </button>
        </Section>
      )}
    </div>
  );
}

/* ─── inspector (desktop aside) ──────────────────────────────────────── */

export function FieldInspector(props: FieldInspectorProps) {
  const { selectedField, handleDeleteField } = props;

  if (!selectedField) {
    return (
      <aside className="cf-rail flex w-64 shrink-0 flex-col items-center justify-center gap-3 p-6 select-none xl:w-72">
        <div
          className="flex size-12 items-center justify-center border text-(--cf-ink-soft)"
          style={{ borderColor: "var(--cf-line-strong)", background: "var(--cf-cream)" }}
        >
          <MousePointerClick className="size-5" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="cf-meta">No field selected</p>
          <p className="max-w-50 text-[12px] leading-relaxed text-(--cf-ink-soft)">
            Click a field on the canvas to inspect and configure it.
          </p>
        </div>
      </aside>
    );
  }

  const FieldIcon = getFieldIcon(selectedField.type);

  return (
    <aside className="cf-rail flex w-64 shrink-0 flex-col xl:w-72">
      {/* header */}
      <div className="cf-pane-bar">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-3.5" style={{ color: "var(--cf-orange)" }} />
          <span className="cf-meta" style={{ color: "var(--cf-ink)" }}>
            Inspector
          </span>
        </div>
        <div
          className="inline-flex items-center gap-1.5 border px-2 py-0.5"
          style={{ borderColor: "var(--cf-line-strong)", background: "var(--cf-cream-2)" }}
        >
          <FieldIcon className="size-3" style={{ color: "var(--cf-orange)" }} />
          <span className="font-mono text-[10px] tracking-wider text-(--cf-ink-soft) uppercase">
            {selectedField.type.replace("_", " ").toLowerCase()}
          </span>
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <FieldInspectorBody {...props} />
      </div>

      {/* delete footer */}
      <div
        className="border-t px-4 py-3"
        style={{ borderTopColor: "var(--cf-line-strong)", background: "var(--cf-cream)" }}
      >
        <button onClick={handleDeleteField} className="cf-btn-danger h-9 w-full text-[12.5px]">
          <Trash2 className="size-3.5" />
          Remove field
        </button>
      </div>
    </aside>
  );
}
