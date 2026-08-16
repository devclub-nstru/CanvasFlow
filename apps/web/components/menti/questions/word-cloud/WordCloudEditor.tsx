"use client";

import { Plus } from "lucide-react";
import { MentiSlide } from "~/lib/menti";
import { DEFAULT_WORD_CLOUD_COLORS, WordCloudViewer } from "./WordCloudViewer";

interface Props { slide: MentiSlide; onChange: (updated: Partial<MentiSlide>) => void; variant?: "panel" | "canvas"; }

const createColor = (index: number) => {
  const hue = (index * 47 + 191) % 360;
  const saturation = 66;
  const lightness = 62;
  const chroma = (1 - Math.abs(2 * lightness / 100 - 1)) * saturation / 100;
  const hex = (offset: number) => {
    const value = lightness / 100 - chroma * Math.max(-1, Math.min((offset + hue / 30) % 12 - 3, 9 - (offset + hue / 30) % 12, 1)) / 2;
    return Math.round(255 * value).toString(16).padStart(2, "0");
  };
  return `#${hex(0)}${hex(8)}${hex(4)}`;
};

export function WordCloudEditor({ slide, onChange, variant = "panel" }: Props) {
  const colors = slide.designSettings.wordCloudColors?.length ? slide.designSettings.wordCloudColors : DEFAULT_WORD_CLOUD_COLORS;
  const updateColors = (next: string[]) => onChange({ designSettings: { ...slide.designSettings, wordCloudColors: next } });
  const addColor = () => updateColors([...colors, createColor(colors.length)]);

  if (variant === "canvas") {
    return <section className="flex h-full min-h-0 w-full flex-col p-[3.2%]">
      <input value={slide.question} onChange={(event) => onChange({ question: event.target.value })} placeholder="What word comes to mind?" className="w-full bg-transparent px-3 py-2 text-3xl font-medium tracking-[-0.05em] text-neutral-700 outline-none md:text-5xl" />
      <div className="mt-7 min-h-0 flex-1 rounded-2xl border-2 border-indigo-500 bg-white p-5 md:p-8"><WordCloudViewer slide={slide} isPreview showQuestion={false} muted /></div>
      <div className="mt-5 flex justify-center"><div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-3 shadow-lg">{colors.map((color, index) => <label key={index} className="relative block size-8 cursor-pointer rounded-full border-2 border-black/15" style={{ backgroundColor: color }}><input aria-label={`Cloud colour ${index + 1}`} type="color" value={color} onInput={(event) => updateColors(colors.map((item, itemIndex) => itemIndex === index ? event.currentTarget.value : item))} className="absolute inset-0 cursor-pointer opacity-0" /></label>)}<button type="button" aria-label="Add cloud colour" onClick={addColor} className="grid size-9 place-items-center rounded-xl bg-neutral-100 text-neutral-400 hover:bg-neutral-200"><Plus className="size-5" /></button></div></div>
    </section>;
  }

  return <div className="space-y-4">
    <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">Question</label><input value={slide.question} onChange={(event) => onChange({ question: event.target.value })} placeholder="What word comes to mind?" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></div>
    <div className="h-52 rounded-xl border border-indigo-200 bg-white p-3"><WordCloudViewer slide={slide} isPreview showQuestion={false} muted /></div>
    <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Cloud colours</p><div className="flex flex-wrap gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">{colors.map((color, index) => <input key={index} aria-label={`Cloud colour ${index + 1}`} type="color" value={color} onInput={(event) => updateColors(colors.map((item, itemIndex) => itemIndex === index ? event.currentTarget.value : item))} className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0" />)}<button type="button" aria-label="Add cloud colour" onClick={addColor} className="grid size-7 place-items-center rounded-full border border-dashed border-neutral-300 bg-white text-neutral-500 hover:border-indigo-400 hover:text-indigo-600"><Plus className="size-4" /></button></div></div>
  </div>;
}
