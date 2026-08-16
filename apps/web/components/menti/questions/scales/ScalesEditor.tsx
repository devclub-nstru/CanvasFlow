"use client";

import { MentiSlide } from "~/lib/menti";
import { ScalesViewer } from "./ScalesViewer";

interface Props { slide: MentiSlide; onChange: (updated: Partial<MentiSlide>) => void; variant?: "panel" | "canvas"; }

export function ScalesEditor({ slide, onChange, variant = "panel" }: Props) {
  const updateSettings = (patch: Partial<MentiSlide["responseSettings"]>) => onChange({ responseSettings: { ...slide.responseSettings, ...patch } });

  if (variant === "canvas") return <section className="flex h-full min-h-0 w-full flex-col p-[3.2%]">
    <input value={slide.question} onChange={(event) => onChange({ question: event.target.value })} placeholder="Statement 1" className="w-full rounded-2xl border-2 border-transparent bg-transparent px-3 py-2 text-3xl font-medium tracking-[-0.05em] text-neutral-700 outline-none transition hover:border-indigo-200 focus:border-indigo-500 md:text-5xl" />
    <div className="mt-5 min-h-0 flex-1 rounded-2xl border-2 border-indigo-500 bg-white"><ScalesViewer slide={slide} showQuestion={false} /></div>
  </section>;

  return <div className="space-y-5">
    <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">Statement</label><textarea value={slide.question} onChange={(event) => onChange({ question: event.target.value })} placeholder="Statement 1" rows={2} className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></div>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Low label<input value={slide.responseSettings.ratingLowLabel || ""} onChange={(event) => updateSettings({ ratingLowLabel: event.target.value })} placeholder="Low" className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-800 outline-none focus:border-indigo-400" /></label>
      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">High label<input value={slide.responseSettings.ratingHighLabel || ""} onChange={(event) => updateSettings({ ratingHighLabel: event.target.value })} placeholder="High" className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-800 outline-none focus:border-indigo-400" /></label>
    </div>
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"><p className="mb-2 text-xs font-semibold text-neutral-700">Five-point scale</p><div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((value) => <span key={value} className="rounded-md bg-white py-2 text-center text-sm font-semibold text-neutral-700 shadow-sm">{value}</span>)}</div></div>
  </div>;
}

export const ScaleEditor = ScalesEditor;
