"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { MentiOption, MentiSlide } from "~/lib/menti";
import { motion, useReducedMotion } from "motion/react";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
  variant?: "panel" | "canvas";
}

const colors = ["#5268e8", "#ff7378", "#313c8e", "#9189eb", "#43b7a6", "#e4a23e"];

const makeOption = (index: number): MentiOption => ({
  id: `option-${crypto.randomUUID()}`,
  label: `Option ${index}`,
  color: colors[(index - 1) % colors.length],
  voteCount: 0,
});

/** Split option list into balanced rows (e.g. 4 -> 1x4, 5 -> 3+2, 6 -> 3+3, 7 -> 4+3, 8 -> 4+4) */
function splitIntoBalancedRows<T>(items: T[]): T[][] {
  const n = items.length;
  if (n <= 4) return [items];
  if (n === 5) return [items.slice(0, 3), items.slice(3, 5)];
  if (n === 6) return [items.slice(0, 3), items.slice(3, 6)];
  if (n === 7) return [items.slice(0, 4), items.slice(4, 7)];
  if (n === 8) return [items.slice(0, 4), items.slice(4, 8)];
  if (n === 9) return [items.slice(0, 3), items.slice(3, 6), items.slice(6, 9)];
  if (n === 10) return [items.slice(0, 4), items.slice(4, 7), items.slice(7, 10)];

  const rowCount = Math.ceil(n / 4);
  const perRow = Math.ceil(n / rowCount);
  const rows: T[][] = [];
  for (let i = 0; i < n; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }
  return rows;
}

export function BarGraphEditor({ slide, onChange, variant = "panel" }: Props) {
  const options = slide.options;
  const reduceMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const updateOption = (index: number, patch: Partial<MentiOption>) => {
    onChange({
      options: options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option,
      ),
    });
  };

  const addOption = () => onChange({ options: [...options, makeOption(options.length + 1)] });

  const removeOption = (index: number) => {
    if (options.length > 2) onChange({ options: options.filter((_, optionIndex) => optionIndex !== index) });
  };

  const updateSettings = (patch: Partial<MentiSlide["responseSettings"]>) => {
    onChange({ responseSettings: { ...slide.responseSettings, ...patch } });
  };

  const selectedIndex = options.findIndex((option) => option.id === selectedId);
  const selectedOption = options[selectedIndex];

  if (variant === "canvas") {
    const qLength = slide.question?.length || 0;
    const fontSizeClass =
      qLength > 60
        ? "text-xl sm:text-2xl md:text-3xl"
        : qLength > 30
        ? "text-2xl sm:text-3xl md:text-4xl"
        : "text-3xl sm:text-4xl md:text-5xl";

    const totalVotes = options.reduce((sum, o) => sum + (o.voteCount || 0), 0);
    const isPercentage = slide.responseSettings.showResultsAsPercentage ?? false;
    const isHidden = slide.responseSettings.hideResultsFromAudience ?? false;

    const rows = splitIntoBalancedRows(options);
    const isMultiRow = rows.length > 1;

    const containerHeight = isMultiRow
      ? "h-20 sm:h-24 md:h-28"
      : "h-44 sm:h-52 md:h-60 lg:h-72";

    return (
      <section className="flex h-full min-h-0 w-full flex-col justify-between p-3 sm:p-5 select-none relative">
        {/* Dynamic Multi-line Question Input */}
        <div className="w-full flex flex-col items-center gap-1">
          <textarea
            value={slide.question}
            onChange={(event) => onChange({ question: event.target.value })}
            placeholder="Which of these..."
            rows={qLength > 35 ? 2 : 1}
            className={`w-full max-w-3xl resize-none overflow-hidden text-center rounded-2xl border-2 border-transparent bg-transparent px-3 py-1 font-medium leading-[1.15] tracking-[-0.04em] text-neutral-800 outline-none transition hover:border-(--cf-orange)/30 focus:border-(--cf-orange) ${
              isMultiRow ? "text-2xl sm:text-3xl md:text-4xl" : fontSizeClass
            }`}
          />
          {isHidden && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[11px] font-bold animate-in fade-in">
              <span>Results hidden from audience</span>
            </div>
          )}
        </div>

        {/* Centered Multi-Row Grid of Option Columns */}
        <div className={`mt-auto flex flex-col items-center justify-end w-full max-w-5xl mx-auto ${isMultiRow ? "gap-3 sm:gap-4 pt-1" : "pt-4"}`}>
          {rows.map((rowOptions, rowIndex) => (
            <div
              key={`edit-row-${rowIndex}`}
              className={`flex items-end justify-center w-full gap-3 sm:gap-5 ${
                isMultiRow
                  ? "h-28 sm:h-36 md:h-42"
                  : "h-60 sm:h-72 md:h-80 lg:h-92"
              }`}
            >
              {rowOptions.map((option) => {
                const globalIndex = options.findIndex((o) => o.id === option.id);
                const selected = option.id === selectedId;
                const count = option.voteCount || 0;
                const displayVal = isPercentage
                  ? `${totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0}%`
                  : count;

                const maxVotes = Math.max(1, ...options.map((o) => o.voteCount || 0));
                const fill = totalVotes > 0 ? (count / maxVotes) * 100 : 0;
                const optionColor = option.color || colors[globalIndex % colors.length];

                return (
                  <div
                    key={option.id}
                    onClick={() => setSelectedId(option.id)}
                    onMouseEnter={() => setHoveredId(option.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`group relative flex-1 min-w-[100px] h-full flex flex-col justify-end cursor-pointer rounded-2xl border-2 px-3 pb-3 pt-2 transition-all duration-150 ${
                      isMultiRow ? "max-w-[200px]" : "max-w-[240px]"
                    } ${
                      selected
                        ? "border-(--cf-orange) bg-white/95 shadow-xl ring-1 ring-(--cf-orange)"
                        : hoveredId === option.id
                        ? "border-neutral-300 bg-white/70"
                        : "border-transparent bg-neutral-50/40 hover:bg-white/50"
                    }`}
                  >
                    {/* Floating Add Option Button on Right Edge of Box */}
                    {(selected || hoveredId === option.id) && (
                      <button
                        type="button"
                        aria-label="Add option"
                        onClick={(event) => {
                          event.stopPropagation();
                          addOption();
                        }}
                        className="absolute right-[-14px] top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-(--cf-orange) text-white shadow-md hover:scale-110 transition-transform z-10"
                      >
                        <Plus className="size-4 stroke-[3]" />
                      </button>
                    )}

                    {/* Rising Bar Visual Stage */}
                    <div className={`relative w-full flex flex-col justify-end items-center mb-2.5 ${containerHeight}`}>
                      <motion.div
                        initial={{ height: "0%" }}
                        animate={{
                          height: `${fill}%`,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 75,
                          damping: 15,
                          mass: 0.85,
                          delay: reduceMotion ? 0 : globalIndex * 0.06,
                        }}
                        className="w-full relative rounded-t-xl"
                        style={{
                          backgroundColor: fill > 0 ? optionColor : "#e5e7eb",
                          minHeight: "6px",
                        }}
                      >
                        {/* Attached Value Label - Sits directly above the bar */}
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : globalIndex * 0.06 + 0.08 }}
                          className="absolute bottom-full mb-1.5 left-0 right-0 flex items-center justify-center pointer-events-none"
                        >
                          <span className="font-bold text-sm text-neutral-800 text-center tabular-nums whitespace-nowrap animate-in fade-in">
                            {displayVal}
                          </span>
                        </motion.div>
                      </motion.div>
                    </div>

                    {/* Option Label Input */}
                    <input
                      value={option.label}
                      onClick={(event) => event.stopPropagation()}
                      onFocus={() => setSelectedId(option.id)}
                      onChange={(event) => updateOption(globalIndex, { label: event.target.value })}
                      placeholder={`Option ${globalIndex + 1}`}
                      className={`mt-2 w-full bg-transparent font-medium tracking-[-0.03em] text-neutral-700 outline-none text-center placeholder:text-neutral-400 ${
                        isMultiRow ? "text-xs sm:text-sm md:text-base" : "text-sm sm:text-base md:text-lg"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Selected Option Toolbar */}
        {selectedOption && (
          <div className="mx-auto mt-3 flex w-fit items-center gap-1 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg animate-in fade-in zoom-in-95">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Set ${selectedOption.label} colour`}
                onClick={() => updateOption(selectedIndex, { color })}
                className={`size-5 rounded-full border-2 transition-transform ${
                  selectedOption.color === color ? "border-neutral-900 scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <span className="mx-1 h-5 w-px bg-neutral-200" />
            <button
              type="button"
              aria-label="Duplicate option"
              onClick={() =>
                onChange({
                  options: [
                    ...options,
                    {
                      ...selectedOption,
                      id: `option-${crypto.randomUUID()}`,
                      label: `${selectedOption.label} copy`,
                    },
                  ],
                })
              }
              className="rounded p-1 text-neutral-600 hover:bg-neutral-100"
            >
              <Copy className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete option"
              disabled={options.length <= 2}
              onClick={() => removeOption(selectedIndex)}
              className="rounded p-1 text-neutral-600 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Question
        </label>
        <textarea
          value={slide.question}
          onChange={(event) => onChange({ question: event.target.value })}
          placeholder="Which of these..."
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Options</label>
          <span className="text-xs text-neutral-400">Minimum 2</span>
        </div>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={option.id} className="group flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
              <input
                aria-label={`Option ${index + 1} colour`}
                type="color"
                value={option.color || colors[index % colors.length]}
                onChange={(event) => updateOption(index, { color: event.target.value })}
                className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              <input
                value={option.label}
                onChange={(event) => updateOption(index, { label: event.target.value })}
                placeholder={`Option ${index + 1}`}
                className="min-w-0 flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
              />
              <button
                type="button"
                aria-label={`Delete option ${index + 1}`}
                disabled={options.length <= 2}
                onClick={() => removeOption(index)}
                className="rounded p-1 text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addOption}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-(--cf-orange)/40 py-2 text-xs font-semibold text-(--cf-orange) transition hover:bg-blue-50"
        >
          <Plus className="size-3.5" /> Add option
        </button>
      </div>

      {/* Response Settings Panel */}
      <div className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-3">
        <p className="cf-eyebrow text-(--cf-ink)">Response settings</p>
        <div className="space-y-2.5">
          <label className="flex cursor-pointer items-center justify-between gap-4 text-xs font-medium text-neutral-700">
            <span>Allow multiple selections</span>
            <input
              type="checkbox"
              checked={slide.responseSettings.multipleSelection ?? false}
              onChange={(event) =>
                updateSettings({
                  multipleSelection: event.target.checked,
                  maxSelections: event.target.checked ? slide.options.length : 1,
                })
              }
              className="size-4 rounded border-neutral-300 accent-(--cf-orange)"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-neutral-100 pt-2 text-xs font-medium text-neutral-700">
            <span>Show results as percentage</span>
            <input
              type="checkbox"
              checked={slide.responseSettings.showResultsAsPercentage ?? false}
              onChange={(event) => updateSettings({ showResultsAsPercentage: event.target.checked })}
              className="size-4 rounded border-neutral-300 accent-(--cf-orange)"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-neutral-100 pt-2 text-xs font-medium text-neutral-700">
            <span>Hide results from audience</span>
            <input
              type="checkbox"
              checked={slide.responseSettings.hideResultsFromAudience ?? false}
              onChange={(event) => updateSettings({ hideResultsFromAudience: event.target.checked })}
              className="size-4 rounded border-neutral-300 accent-(--cf-orange)"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
