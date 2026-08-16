"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { MentiOption, MentiSlide } from "~/lib/menti";

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

export function BarGraphEditor({ slide, onChange, variant = "panel" }: Props) {
  const options = slide.options;
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
    return (
      <section className="flex h-full min-h-0 w-full flex-col p-[3.2%]">
        <input
          value={slide.question}
          onChange={(event) => onChange({ question: event.target.value })}
          placeholder="Which of these..."
          className="w-full rounded-2xl border-2 border-transparent bg-transparent px-3 py-2 text-3xl font-medium tracking-[-0.05em] text-neutral-700 outline-none transition hover:border-indigo-200 focus:border-indigo-500 md:text-5xl"
        />
        <div className="mt-auto grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] items-end gap-3 pt-8">
          {options.map((option, index) => {
            const selected = option.id === selectedId;
            return (
            <div
              key={option.id}
              onClick={() => setSelectedId(option.id)}
              onMouseEnter={() => setHoveredId(option.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`group relative min-w-0 cursor-text rounded-2xl border-2 px-3 pb-3 pt-8 transition ${selected ? "border-indigo-500 bg-white shadow-[0_12px_30px_rgba(79,70,229,0.12)]" : hoveredId === option.id ? "border-indigo-200 bg-white" : "border-transparent"}`}
              >
                {(selected || hoveredId === option.id) && <button type="button" aria-label="Add option" onClick={(event) => { event.stopPropagation(); addOption(); }} className="absolute right-[-18px] top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-indigo-500 text-xl font-light text-white shadow-sm"><Plus className="size-5" /></button>}
                <p className="text-3xl font-medium tracking-[-0.04em] text-neutral-900">{option.voteCount || 0}</p>
                <div className="mt-3 h-1.5 rounded-full" style={{ backgroundColor: option.color || colors[index % colors.length] }} />
                <input
                  value={option.label}
                  onClick={(event) => event.stopPropagation()}
                  onFocus={() => setSelectedId(option.id)}
                  onChange={(event) => updateOption(index, { label: event.target.value })}
                  placeholder={`Option ${index + 1}`}
                  className="mt-3 w-full bg-transparent text-xl font-medium tracking-[-0.04em] text-neutral-700 outline-none placeholder:text-neutral-400"
                />
              </div>
            );
          })}
        </div>
        {selectedOption && (
          <div className="mt-4 flex w-fit items-center gap-1 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
            {colors.map((color) => <button key={color} type="button" aria-label={`Set ${selectedOption.label} colour`} onClick={() => updateOption(selectedIndex, { color })} className={`size-6 rounded-full border-2 ${selectedOption.color === color ? "border-neutral-900" : "border-transparent"}`} style={{ backgroundColor: color }} />)}
            <span className="mx-1 h-6 w-px bg-neutral-200" />
            <button type="button" aria-label="Duplicate option" onClick={() => onChange({ options: [...options, { ...selectedOption, id: `option-${crypto.randomUUID()}`, label: `${selectedOption.label} copy` }] })} className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100"><Copy className="size-4" /></button>
            <button type="button" aria-label="Delete option" disabled={options.length <= 2} onClick={() => removeOption(selectedIndex)} className="rounded p-1.5 text-neutral-600 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><Trash2 className="size-4" /></button>
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
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-indigo-300 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
        >
          <Plus className="size-3.5" /> Add option
        </button>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <p className="mb-2 text-xs font-semibold text-neutral-800">Response settings</p>
        <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5 text-xs text-neutral-600">
          Allow multiple selections
          <input
            type="checkbox"
            checked={slide.responseSettings.multipleSelection ?? false}
            onChange={(event) => updateSettings({ multipleSelection: event.target.checked })}
            className="size-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-neutral-200 py-2 text-xs text-neutral-600">
          Show results as percentage
          <input
            type="checkbox"
            checked={slide.responseSettings.showResultsAsPercentage ?? false}
            onChange={(event) => updateSettings({ showResultsAsPercentage: event.target.checked })}
            className="size-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-neutral-200 pt-2 text-xs text-neutral-600">
          Hide results from audience
          <input
            type="checkbox"
            checked={slide.responseSettings.hideResultsFromAudience ?? false}
            onChange={(event) => updateSettings({ hideResultsFromAudience: event.target.checked })}
            className="size-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
          />
        </label>
      </div>
    </div>
  );
}
