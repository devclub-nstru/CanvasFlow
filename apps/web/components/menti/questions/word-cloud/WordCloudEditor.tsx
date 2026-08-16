"use client";

import { Plus, Palette } from "lucide-react";
import { MentiSlide } from "~/lib/menti";
import { DEFAULT_WORD_CLOUD_COLORS, WordCloudViewer } from "./WordCloudViewer";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
  variant?: "panel" | "canvas";
}

/** Generate an aesthetically pleasing color for a new swatch */
const createColor = (index: number): string => {
  const hue = (index * 47 + 191) % 360;
  const saturation = 66;
  const lightness = 62;
  const chroma = (1 - Math.abs((2 * lightness) / 100 - 1)) * (saturation / 100);
  const hex = (offset: number) => {
    const value =
      lightness / 100 -
      (chroma *
        Math.max(
          -1,
          Math.min(
            ((offset + hue / 30) % 12) - 3,
            9 - ((offset + hue / 30) % 12),
            1,
          ),
        )) /
        2;
    return Math.round(255 * value)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${hex(0)}${hex(8)}${hex(4)}`;
};

export function WordCloudEditor({ slide, onChange, variant = "panel" }: Props) {
  const colors = slide.designSettings.wordCloudColors?.length
    ? slide.designSettings.wordCloudColors
    : DEFAULT_WORD_CLOUD_COLORS;

  const updateColors = (next: string[]) =>
    onChange({ designSettings: { ...slide.designSettings, wordCloudColors: next } });

  const addColor = () => updateColors([...colors, createColor(colors.length)]);

  const updateSettings = (patch: Partial<MentiSlide["responseSettings"]>) =>
    onChange({ responseSettings: { ...slide.responseSettings, ...patch } });

  // ─── CANVAS VARIANT ─────────────────────────────────────────────────────────
  if (variant === "canvas") {
    const qLength = slide.question?.length || 0;
    const fontSizeClass =
      qLength > 60
        ? "text-xl sm:text-2xl md:text-3xl"
        : qLength > 30
        ? "text-2xl sm:text-3xl md:text-4xl"
        : "text-3xl sm:text-4xl md:text-5xl";

    return (
      <section className="flex h-full min-h-0 w-full flex-col justify-between p-3 sm:p-5 select-none relative">
        {/* Question Input – same style as BarGraphEditor canvas */}
        <div className="w-full flex flex-col items-center gap-1">
          <textarea
            value={slide.question}
            onChange={(event) => onChange({ question: event.target.value })}
            placeholder="What word comes to mind?"
            rows={qLength > 35 ? 2 : 1}
            className={`w-full max-w-3xl resize-none overflow-hidden text-center rounded-2xl border-2 border-transparent bg-transparent px-3 py-1 font-medium leading-[1.15] tracking-[-0.04em] text-neutral-800 outline-none transition hover:border-(--cf-orange)/30 focus:border-(--cf-orange) ${fontSizeClass}`}
          />
        </div>

        {/* Live Cloud Preview – bordered card matching BarGraph's option area style */}
        <div className="mt-auto min-h-0 flex-1 mx-auto w-full max-w-5xl pt-4">
          <div className="h-full min-h-[200px] rounded-2xl border-2 border-(--cf-line-strong) bg-white p-5 sm:p-7 cf-raised overflow-hidden">
            <WordCloudViewer slide={slide} isPreview showQuestion={false} muted />
          </div>
        </div>

        {/* Color Swatch Toolbar – same floating pill toolbar as BarGraph's selected option toolbar */}
        <div className="mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg">
          <Palette className="size-3.5 text-neutral-400 ml-0.5 shrink-0" />
          <span className="mx-1 h-5 w-px bg-neutral-200 shrink-0" />
          {colors.map((color, index) => (
            <label
              key={index}
              className="relative block size-5 cursor-pointer rounded-full border-2 border-neutral-200 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
            >
              <input
                aria-label={`Cloud colour ${index + 1}`}
                type="color"
                value={color}
                onInput={(event) =>
                  updateColors(
                    colors.map((item, itemIndex) =>
                      itemIndex === index ? event.currentTarget.value : item,
                    ),
                  )
                }
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          ))}
          <button
            type="button"
            aria-label="Add cloud colour"
            onClick={addColor}
            className="grid size-5 place-items-center rounded-full border border-dashed border-(--cf-orange)/50 text-(--cf-orange) hover:bg-orange-50 transition-colors"
          >
            <Plus className="size-3" />
          </button>
        </div>
      </section>
    );
  }

  // ─── PANEL VARIANT (Inspector Sidebar) ──────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Question */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Question
        </label>
        <textarea
          value={slide.question}
          onChange={(event) => onChange({ question: event.target.value })}
          placeholder="What word comes to mind?"
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
        />
      </div>

      {/* Cloud Preview */}
      <div className="h-48 rounded-xl border border-neutral-200 bg-white p-3 overflow-hidden">
        <WordCloudViewer slide={slide} isPreview showQuestion={false} muted />
      </div>

      {/* Cloud Colours */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Cloud colours
          </label>
        </div>
        <div className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          {colors.map((color, index) => (
            <label
              key={index}
              className="relative block size-7 cursor-pointer rounded-full border-2 border-black/10 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
            >
              <input
                aria-label={`Cloud colour ${index + 1}`}
                type="color"
                value={color}
                onInput={(event) =>
                  updateColors(
                    colors.map((item, itemIndex) =>
                      itemIndex === index ? event.currentTarget.value : item,
                    ),
                  )
                }
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          ))}
          <button
            type="button"
            aria-label="Add cloud colour"
            onClick={addColor}
            className="grid size-7 place-items-center rounded-full border border-dashed border-(--cf-orange)/40 text-(--cf-orange) hover:bg-orange-50 transition-colors"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {/* Response Settings – same panel style as BarGraphEditor */}
      <div className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-3">
        <p className="cf-eyebrow text-(--cf-ink)">Response settings</p>
        <div className="space-y-2.5">
          <label className="flex cursor-pointer items-center justify-between gap-4 text-xs font-medium text-neutral-700">
            <span>Max entries per participant</span>
            <input
              type="number"
              min={1}
              max={10}
              value={slide.responseSettings.maxEntriesPerParticipant ?? 1}
              onChange={(event) =>
                updateSettings({ maxEntriesPerParticipant: Number(event.target.value) })
              }
              className="w-14 rounded border border-neutral-200 bg-white px-2 py-0.5 text-center text-xs outline-none focus:border-(--cf-orange)"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
