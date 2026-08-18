"use client";

import React, { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { MentiOption, MentiSlide } from "~/lib/menti";
import { motion } from "motion/react";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
  variant?: "panel" | "canvas";
}

/** Podium accents mirroring RankingViewer so the editor previews truthfully. */
const PODIUM_BARS = ["#e4a23e", "#9189eb", "#43b7a6"];
const REST_BAR = "#5268e8";

const MIN_ITEMS = 2;

const makeItem = (index: number): MentiOption => ({
  id: `rank-${crypto.randomUUID()}`,
  label: `Item ${index}`,
  voteCount: 0,
});

export function RankingEditor({ slide, onChange, variant = "panel" }: Props) {
  const items = slide.options;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const updateItem = (index: number, patch: Partial<MentiOption>) => {
    onChange({
      options: items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  };

  const addItem = () => onChange({ options: [...items, makeItem(items.length + 1)] });

  const removeItem = (index: number) => {
    if (items.length > MIN_ITEMS) {
      onChange({ options: items.filter((_, itemIndex) => itemIndex !== index) });
    }
  };

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    onChange({ options: next });
  };

  const updateSettings = (patch: Partial<MentiSlide["responseSettings"]>) => {
    onChange({ responseSettings: { ...slide.responseSettings, ...patch } });
  };

  /* ── canvas variant: edit directly on the 16:9 stage ─────────────────── */

  if (variant === "canvas") {
    const questionLength = slide.question?.length || 0;
    const fontSizeClass =
      questionLength > 60
        ? "text-xl sm:text-2xl md:text-3xl"
        : questionLength > 30
          ? "text-2xl sm:text-3xl md:text-4xl"
          : "text-3xl sm:text-4xl md:text-5xl";

    const isHidden = slide.responseSettings.hideResultsFromAudience ?? false;

    return (
      <section className="relative flex h-full min-h-0 w-full flex-col p-3 select-none sm:p-5">
        <div className="flex w-full shrink-0 flex-col items-center gap-1">
          <textarea
            value={slide.question}
            onChange={(event) => onChange({ question: event.target.value })}
            placeholder="Rank these in order"
            rows={questionLength > 35 ? 2 : 1}
            className={`w-full max-w-3xl resize-none overflow-hidden rounded-2xl border-2 border-transparent bg-transparent px-3 py-1 text-center font-medium leading-[1.15] tracking-[-0.04em] text-neutral-800 outline-none transition hover:border-(--cf-orange)/30 focus:border-(--cf-orange) ${fontSizeClass}`}
          />
          {isHidden && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 animate-in fade-in">
              <span>Results hidden from audience</span>
            </div>
          )}
        </div>

        {/* Ranked rows preview — descending bars stand in for a live tally. */}
        <div className="mx-auto mt-4 flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-center gap-2">
          {items.map((item, index) => {
            const selected = item.id === selectedId;
            const barColor = PODIUM_BARS[index] ?? REST_BAR;
            // Illustrative descending fill; real widths come from Borda points.
            const fill = Math.max(14, 100 - index * (70 / Math.max(items.length, 1)));

            return (
              <motion.div
                key={item.id}
                layout
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                onClick={() => setSelectedId(item.id)}
                className={`group flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 transition-colors ${
                  selected
                    ? "border-(--cf-orange) bg-white/95 ring-1 ring-(--cf-orange)"
                    : "border-transparent hover:border-neutral-300 hover:bg-white/60"
                }`}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-(--cf-ink) font-mono text-xs font-bold text-white tabular-nums">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <input
                    value={item.label}
                    onClick={(event) => event.stopPropagation()}
                    onFocus={() => setSelectedId(item.id)}
                    onChange={(event) => updateItem(index, { label: event.target.value })}
                    placeholder={`Item ${index + 1}`}
                    className="w-full bg-transparent text-sm font-semibold tracking-[-0.02em] text-neutral-800 outline-none placeholder:text-neutral-400 sm:text-base"
                  />
                  <div className="mt-1 h-3 w-full overflow-hidden rounded-full border border-(--cf-line) bg-(--cf-cream)">
                    <div
                      className="h-full rounded-full opacity-60"
                      style={{ width: `${fill}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>

                {/* Reorder + delete, revealed on hover/selection. */}
                <div
                  className={`flex shrink-0 items-center gap-0.5 transition-opacity ${
                    selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <button
                    type="button"
                    aria-label={`Move ${item.label} up`}
                    disabled={index === 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveItem(index, index - 1);
                    }}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-25"
                  >
                    <GripVertical className="size-3.5 rotate-90" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${item.label}`}
                    disabled={items.length <= MIN_ITEMS}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeItem(index);
                    }}
                    className="rounded p-1 text-neutral-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-25"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}

          <button
            type="button"
            onClick={addItem}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-(--cf-orange)/40 py-2 text-xs font-bold text-(--cf-orange) transition hover:bg-(--cf-orange)/5"
          >
            <Plus className="size-3.5 stroke-[3]" /> Add item
          </button>
        </div>
      </section>
    );
  }

  /* ── panel variant: inspector sidebar ────────────────────────────────── */

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-neutral-500">
          Question
        </label>
        <textarea
          value={slide.question}
          onChange={(event) => onChange({ question: event.target.value })}
          placeholder="Rank these in order"
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold tracking-wider uppercase text-neutral-500">
            Items to rank
          </label>
          <span className="text-xs text-neutral-400">Minimum {MIN_ITEMS}</span>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="group flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded bg-(--cf-cream) font-mono text-[11px] font-bold text-(--cf-ink) tabular-nums">
                {index + 1}
              </span>
              <input
                value={item.label}
                onChange={(event) => updateItem(index, { label: event.target.value })}
                placeholder={`Item ${index + 1}`}
                className="min-w-0 flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
              />
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  aria-label={`Move item ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => moveItem(index, index - 1)}
                  className="rounded px-1 text-neutral-400 transition hover:text-neutral-700 disabled:opacity-25"
                >
                  <GripVertical className="size-3 -rotate-90" />
                </button>
                <button
                  type="button"
                  aria-label={`Move item ${index + 1} down`}
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(index, index + 1)}
                  className="rounded px-1 text-neutral-400 transition hover:text-neutral-700 disabled:opacity-25"
                >
                  <GripVertical className="size-3 rotate-90" />
                </button>
              </div>
              <button
                type="button"
                aria-label={`Delete item ${index + 1}`}
                disabled={items.length <= MIN_ITEMS}
                onClick={() => removeItem(index)}
                className="rounded p-1 text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addItem}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-(--cf-orange)/40 py-2 text-xs font-semibold text-(--cf-orange) transition hover:bg-blue-50"
        >
          <Plus className="size-3.5" /> Add item
        </button>
      </div>

      <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-3.5">
        <p className="cf-eyebrow text-(--cf-ink)">Response settings</p>
        <p className="text-[11px] leading-relaxed text-neutral-500">
          Participants order every item. Results are scored with a Borda count —
          a first choice earns {items.length} points, the last earns 1.
        </p>
        <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-neutral-100 pt-2 text-xs font-medium text-neutral-700">
          <span>Hide results from audience</span>
          <input
            type="checkbox"
            checked={slide.responseSettings.hideResultsFromAudience ?? false}
            onChange={(event) =>
              updateSettings({ hideResultsFromAudience: event.target.checked })
            }
            className="size-4 rounded border-neutral-300 accent-(--cf-orange)"
          />
        </label>
      </div>
    </div>
  );
}
