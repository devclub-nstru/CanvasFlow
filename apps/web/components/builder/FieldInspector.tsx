"use client";

import React from "react";
import { MousePointerClick, SlidersHorizontal, Trash2 } from "lucide-react";
import { getFieldIcon } from "./FormFieldNode";

export interface FieldInspectorProps {
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

// SELECT/CHECKBOX `choices` live alongside other config (like `position`) on
// the field's options. Merge the new choices into the existing object so we
// don't clobber position or any future config when editing the choice list.
function mergeChoices(currentOptions: any, nextChoices: string[]): Record<string, any> {
  const base =
    currentOptions && typeof currentOptions === "object" && !Array.isArray(currentOptions)
      ? (currentOptions as Record<string, any>)
      : {};
  return { ...base, choices: nextChoices };
}

/* ─── primitives ─────────────────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block cf-eyebrow text-[color:var(--cf-ink-soft)] mb-1.5">{children}</label>
  );
}

const INPUT_CLS =
  "w-full bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none rounded-md px-3 h-[36px] text-[13px] text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 transition-shadow";

function Section({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="space-y-3">
      {title && (
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]/70 border-b border-[color:var(--cf-line)] pb-2">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none ${
        on ? "bg-[color:var(--cf-orange)]" : "bg-[color:var(--cf-ink)]/15"
      }`}
      aria-pressed={on}
    >
      <span
        className={`pointer-events-none inline-block size-4 mt-0.5 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/* ─── shared body ────────────────────────────────────────────────────────
 *
 * Form inputs for a selected field. Used both by the desktop aside
 * `FieldInspector` and the mobile `MobileFieldEditorSheet`. Caller is
 * responsible for ensuring `selectedField` is non-null before rendering.
 */
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
}: Omit<FieldInspectorProps, "handleDeleteField">) {
  return (
    <div className="space-y-6">
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
            className="w-full bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none rounded-md px-3 py-2 text-[13px] text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 resize-none transition-shadow"
          />
        </div>
      </Section>

      <Section title="Validation">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[color:var(--cf-ink)]">Required</p>
            <p className="text-[11px] text-[color:var(--cf-ink-soft)]">Force an answer</p>
          </div>
          <Toggle on={isRequired} onChange={handleRequiredChange} />
        </div>
      </Section>

      {(selectedField.type === "SELECT" || selectedField.type === "CHECKBOX") && (
        <Section title="Options">
          <div className="space-y-1.5">
            {optionsList.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="size-3 shrink-0 rounded-sm ring-1 ring-[color:var(--cf-line-strong)] bg-[color:var(--cf-cream)]" />
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
                  className="flex-1 min-w-0 bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none px-2.5 h-[34px] text-[12.5px] text-[color:var(--cf-ink)] rounded-md transition-shadow"
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
                  className="shrink-0 p-1.5 text-[color:var(--cf-ink-soft)]/60 hover:text-[#c1281d] rounded-md hover:bg-[color:var(--cf-cream)] disabled:opacity-30 cursor-pointer transition-colors"
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
            className="w-full py-2 rounded-md ring-1 ring-dashed ring-[color:var(--cf-line-strong)] hover:ring-[color:var(--cf-orange)] text-[12px] text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-orange)] transition-all cursor-pointer"
          >
            + Add option
          </button>
        </Section>
      )}

      {selectedField.type === "RATING" && (
        <Section title="Rating scale">
          <div>
            <Label>Max stars</Label>
            <select
              value={(selectedField.options as any)?.max || 5}
              onChange={(e) =>
                updateLocal(selectedField.id, {
                  options: {
                    ...((selectedField.options as any) || {}),
                    max: parseInt(e.target.value),
                  },
                })
              }
              className="w-full bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none rounded-md px-3 h-[36px] text-[13px] text-[color:var(--cf-ink)] cursor-pointer transition-shadow"
            >
              <option value={3}>3 — Small</option>
              <option value={5}>5 — Standard</option>
              <option value={10}>10 — Detailed</option>
            </select>
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
            <p className="text-[13px] text-[color:var(--cf-ink)]">Default on</p>
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
    </div>
  );
}

/* ─── inspector (desktop aside) ──────────────────────────────────────── */

export function FieldInspector(props: FieldInspectorProps) {
  const { selectedField, handleDeleteField } = props;

  if (!selectedField) {
    return (
      <aside className="w-72 bg-[color:var(--cf-cream-2)] border-l border-[color:var(--cf-line)] flex flex-col items-center justify-center gap-3 select-none shrink-0 p-6">
        <div className="size-12 rounded-full bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] flex items-center justify-center text-[color:var(--cf-ink-soft)]/55">
          <MousePointerClick className="size-5" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">No field selected</p>
          <p className="text-[12px] text-[color:var(--cf-ink-soft)] leading-relaxed max-w-[200px]">
            Click a field on the canvas to inspect and configure it.
          </p>
        </div>
      </aside>
    );
  }

  const FieldIcon = getFieldIcon(selectedField.type);

  return (
    <aside className="w-72 bg-[color:var(--cf-cream-2)] border-l border-[color:var(--cf-line)] flex flex-col shrink-0">
      {/* header */}
      <div className="px-4 py-3 border-b border-[color:var(--cf-line)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-3.5 text-[color:var(--cf-orange)]" />
          <span className="cf-eyebrow text-[color:var(--cf-ink)]">Inspector</span>
        </div>
        <div className="inline-flex items-center gap-1.5 bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] px-2 py-0.5 rounded-full">
          <FieldIcon className="size-3 text-[color:var(--cf-orange)]" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--cf-ink-soft)]">
            {selectedField.type.replace("_", " ").toLowerCase()}
          </span>
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <FieldInspectorBody {...props} />
      </div>

      {/* delete footer */}
      <div className="px-4 py-3 border-t border-[color:var(--cf-line)]">
        <button
          onClick={handleDeleteField}
          className="w-full flex items-center justify-center gap-1.5 h-[36px] rounded-full ring-1 ring-[#c1281d]/30 text-[#c1281d] hover:bg-[#c1281d]/8 text-[12.5px] font-medium transition-all cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          Remove field
        </button>
      </div>
    </aside>
  );
}
