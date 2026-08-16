"use client";

import React from "react";
import { MentiSlide } from "~/lib/menti";
import { ScalesViewer } from "./ScalesViewer";
import { Star, Palette } from "lucide-react";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
  variant?: "panel" | "canvas";
}

const SCALE_THEME_COLORS = [
  "#e4a23e", // Amber / Warm Orange
  "#5268e8", // Indigo Blue
  "#ff7378", // Coral Pink
  "#43b7a6", // Teal Green
  "#9189eb", // Soft Violet
  "#e11d48", // Rose Red
  "#17171c", // Ink Black
];

const PRESET_RANGES = [
  { label: "1 to 5 (Standard)", min: 1, max: 5 },
  { label: "1 to 10 (NPS / Decade)", min: 1, max: 10 },
  { label: "1 to 3 (Ternary)", min: 1, max: 3 },
  { label: "1 to 7 (Likert 7-Pt)", min: 1, max: 7 },
  { label: "0 to 5 (Zero-based)", min: 0, max: 5 },
  { label: "0 to 10 (Zero to Ten)", min: 0, max: 10 },
];

export function ScalesEditor({ slide, onChange, variant = "panel" }: Props) {
  const updateSettings = (patch: Partial<MentiSlide["responseSettings"]>) =>
    onChange({ responseSettings: { ...slide.responseSettings, ...patch } });

  const updateDesign = (patch: Partial<MentiSlide["designSettings"]>) =>
    onChange({ designSettings: { ...slide.designSettings, ...patch } });

  const rawMin = slide.responseSettings?.minRating;
  const rawMax = slide.responseSettings?.maxRating;
  const minRating = typeof rawMin === "number" && !isNaN(rawMin) ? rawMin : 1;
  const maxRating = typeof rawMax === "number" && !isNaN(rawMax) ? rawMax : 5;
  const accentColor = slide.designSettings?.accentColor || "#e4a23e";

  const qLength = slide.question?.length || 0;
  const fontSizeClass =
    qLength > 60
      ? "text-xl sm:text-2xl md:text-3xl"
      : qLength > 30
      ? "text-2xl sm:text-3xl md:text-4xl"
      : "text-3xl sm:text-4xl md:text-5xl";

  const isCustomRange = !PRESET_RANGES.some(
    (p) => p.min === minRating && p.max === maxRating
  );
  const currentPresetValue = isCustomRange
    ? "custom"
    : `${minRating}-${maxRating}`;

  const handleRangePreset = (min: number, max: number) => {
    updateSettings({ minRating: min, maxRating: max });
  };

  // ─── CANVAS VARIANT ─────────────────────────────────────────────────────────
  if (variant === "canvas") {
    return (
      <section className="flex h-full min-h-0 w-full flex-col justify-between p-3 sm:p-5 select-none relative">
        {/* Dynamic Multi-line Question Input */}
        <div className="w-full flex flex-col items-center gap-1">
          <textarea
            value={slide.question}
            onChange={(event) => onChange({ question: event.target.value })}
            placeholder={`Rate this statement from ${minRating} to ${maxRating}...`}
            rows={qLength > 35 ? 2 : 1}
            className={`w-full max-w-3xl resize-none overflow-hidden text-center rounded-2xl border-2 border-transparent bg-transparent px-3 py-1 font-medium leading-[1.15] tracking-[-0.04em] text-neutral-800 outline-none transition hover:border-(--cf-orange)/30 focus:border-(--cf-orange) ${fontSizeClass}`}
          />
        </div>

        {/* Live Scale Visual Stage Card */}
        <div className="mt-auto min-h-0 flex-1 mx-auto w-full max-w-5xl pt-4">
          <div className="h-full min-h-[220px] rounded-2xl border-2 border-(--cf-line-strong) bg-white p-5 sm:p-7 cf-raised overflow-hidden flex items-center justify-center">
            <ScalesViewer slide={slide} isPreview showQuestion={false} />
          </div>
        </div>

        {/* Floating Pill Toolbar for Spectrum Labels, Color Theme & Range */}
        <div className="mx-auto mt-3 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg">
          {/* Color Palette Selector */}
          <div className="flex items-center gap-1 pl-1">
            <Palette className="size-3.5 text-neutral-400 shrink-0 mr-0.5" />
            {SCALE_THEME_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Set scale color ${color}`}
                onClick={() => updateDesign({ accentColor: color })}
                className={`size-5 rounded-full border-2 transition-transform ${
                  accentColor === color
                    ? "border-neutral-900 scale-110 shadow-sm"
                    : "border-neutral-200 hover:scale-105"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <span className="h-5 w-px bg-neutral-200" />

          {/* Quick Range Selector */}
          <div className="flex items-center gap-1 text-xs font-semibold text-(--cf-ink)">
            <span className="cf-meta text-[10px] text-(--cf-ink-soft) font-bold uppercase">Scale:</span>
            <select
              value={currentPresetValue}
              onChange={(e) => {
                if (e.target.value === "custom") return;
                const [mn, mx] = e.target.value.split("-").map(Number);
                if (mn !== undefined && mx !== undefined) handleRangePreset(mn, mx);
              }}
              className="bg-(--cf-cream) border border-(--cf-line) rounded px-2 py-0.5 text-xs font-mono font-bold text-(--cf-ink) outline-none cursor-pointer"
            >
              {isCustomRange && (
                <option value="custom">Custom ({minRating} to {maxRating})</option>
              )}
              {PRESET_RANGES.map((preset) => (
                <option
                  key={`${preset.min}-${preset.max}`}
                  value={`${preset.min}-${preset.max}`}
                >
                  {preset.min} to {preset.max}
                </option>
              ))}
            </select>
          </div>

          <span className="h-5 w-px bg-neutral-200" />

          {/* Spectrum Low/High Labels */}
          <div className="flex items-center gap-1.5 px-1.5">
            <span className="cf-meta text-[10px] text-(--cf-ink-soft) font-bold uppercase">Low ({minRating}):</span>
            <input
              value={slide.responseSettings?.ratingLowLabel ?? ""}
              onChange={(e) => updateSettings({ ratingLowLabel: e.target.value })}
              placeholder="Low"
              className="w-20 bg-transparent text-xs font-semibold text-(--cf-ink) outline-none border-b border-transparent focus:border-(--cf-orange)"
            />
            <span className="cf-meta text-[10px] text-(--cf-ink-soft) font-bold uppercase ml-1">High ({maxRating}):</span>
            <input
              value={slide.responseSettings?.ratingHighLabel ?? ""}
              onChange={(e) => updateSettings({ ratingHighLabel: e.target.value })}
              placeholder="High"
              className="w-20 bg-transparent text-xs font-semibold text-(--cf-ink) outline-none border-b border-transparent focus:border-(--cf-orange)"
            />
          </div>
        </div>
      </section>
    );
  }

  // ─── PANEL VARIANT (Inspector Sidebar) ──────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Statement Question */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Statement / Question
        </label>
        <textarea
          value={slide.question}
          onChange={(event) => onChange({ question: event.target.value })}
          placeholder={`Rate this statement from ${minRating} to ${maxRating}...`}
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
        />
      </div>

      {/* Rating Range Settings (Custom Min & Max) */}
      <div className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-3">
        <p className="cf-eyebrow text-(--cf-ink)">Rating Range</p>

        {/* Preset Range Selector */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-neutral-600">
            Scale Preset
          </label>
          <select
            value={currentPresetValue}
            onChange={(e) => {
              if (e.target.value === "custom") return;
              const [mn, mx] = e.target.value.split("-").map(Number);
              if (mn !== undefined && mx !== undefined) handleRangePreset(mn, mx);
            }}
            className="w-full rounded-lg border border-neutral-200 bg-(--cf-cream) px-2.5 py-1.5 text-xs font-bold text-neutral-800 outline-none focus:border-(--cf-orange)"
          >
            {isCustomRange && (
              <option value="custom">Custom ({minRating} to {maxRating})</option>
            )}
            {PRESET_RANGES.map((preset) => (
              <option
                key={`${preset.min}-${preset.max}`}
                value={`${preset.min}-${preset.max}`}
              >
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Lowest & Highest Number Inputs */}
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-100">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Lowest Rating
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={rawMin !== undefined ? rawMin : 1}
              onChange={(e) => {
                const text = e.target.value.trim();
                if (text === "") {
                  updateSettings({ minRating: ("" as unknown as number) });
                  return;
                }
                const clean = text.replace(/^0+(?=\d)/, "");
                const parsed = parseInt(clean, 10);
                if (!isNaN(parsed)) {
                  updateSettings({ minRating: parsed });
                }
              }}
              onBlur={() => {
                if (typeof rawMin !== "number" || isNaN(rawMin)) {
                  updateSettings({ minRating: 1 });
                }
              }}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-mono font-bold text-neutral-900 outline-none focus:border-(--cf-orange)"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Highest Rating
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={rawMax !== undefined ? rawMax : 5}
              onChange={(e) => {
                const text = e.target.value.trim();
                if (text === "") {
                  updateSettings({ maxRating: ("" as unknown as number) });
                  return;
                }
                const clean = text.replace(/^0+(?=\d)/, "");
                const parsed = parseInt(clean, 10);
                if (!isNaN(parsed)) {
                  updateSettings({ maxRating: parsed });
                }
              }}
              onBlur={() => {
                if (typeof rawMax !== "number" || isNaN(rawMax)) {
                  updateSettings({ maxRating: 5 });
                }
              }}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-mono font-bold text-neutral-900 outline-none focus:border-(--cf-orange)"
            />
          </div>
        </div>
      </div>

      {/* Spectrum Labels (Low & High) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Low label ({minRating})
          </label>
          <input
            value={slide.responseSettings?.ratingLowLabel ?? ""}
            onChange={(event) => updateSettings({ ratingLowLabel: event.target.value })}
            placeholder="Low"
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
            High label ({maxRating})
          </label>
          <input
            value={slide.responseSettings?.ratingHighLabel ?? ""}
            onChange={(event) => updateSettings({ ratingHighLabel: event.target.value })}
            placeholder="High"
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
          />
        </div>
      </div>

      {/* Color Theme Selector in Panel */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Scale Theme Color
        </label>
        <div className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          {SCALE_THEME_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Select scale color ${color}`}
              onClick={() => updateDesign({ accentColor: color })}
              className={`size-7 rounded-full border-2 transition-transform ${
                accentColor === color
                  ? "border-neutral-900 scale-110 shadow-sm ring-1 ring-neutral-900"
                  : "border-black/10 hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          {/* Custom Color Input */}
          <label
            className="relative block size-7 cursor-pointer rounded-full border-2 border-dashed border-neutral-300 hover:scale-110 transition-transform overflow-hidden"
            style={{ backgroundColor: accentColor }}
          >
            <input
              type="color"
              aria-label="Custom scale color"
              value={accentColor}
              onChange={(e) => updateDesign({ accentColor: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      {/* Response Settings Panel */}
      <div className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-3">
        <p className="cf-eyebrow text-(--cf-ink)">Response settings</p>
        <div className="space-y-2.5">
          <label className="flex cursor-pointer items-center justify-between gap-4 text-xs font-medium text-neutral-700">
            <span>Hide results from audience</span>
            <input
              type="checkbox"
              checked={slide.responseSettings?.hideResultsFromAudience ?? false}
              onChange={(event) =>
                updateSettings({ hideResultsFromAudience: event.target.checked })
              }
              className="size-4 rounded border-neutral-300 accent-(--cf-orange)"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export const ScaleEditor = ScalesEditor;
