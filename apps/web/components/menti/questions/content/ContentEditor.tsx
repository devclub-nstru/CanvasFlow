"use client";

import React from "react";
import { Sparkles, Type, AlignCenter } from "lucide-react";
import { MentiSlide } from "~/lib/menti";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
  variant?: "panel" | "canvas";
}

export function ContentEditor({ slide, onChange, variant = "panel" }: Props) {
  const title = slide.question || "";
  const description =
    slide.description !== undefined && slide.description !== null
      ? slide.description
      : "We appreciate your time and participation.";

  if (variant === "canvas") {
    const qLength = title.length;
    const titleSizeClass =
      qLength > 40
        ? "text-3xl sm:text-4xl md:text-5xl"
        : qLength > 20
          ? "text-4xl sm:text-5xl md:text-6xl"
          : "text-5xl sm:text-6xl md:text-7xl";

    return (
      <section className="flex h-full min-h-0 w-full flex-col justify-center items-center p-6 sm:p-10 select-none relative text-center">
        <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 max-w-3xl w-full my-auto">
          {/* Eyebrow badge */}

          {/* Inline Editable Main Heading */}
          <textarea
            value={title}
            onChange={(e) => onChange({ question: e.target.value })}
            placeholder="Thank you!"
            rows={qLength > 30 ? 2 : 1}
            className={`w-full resize-none overflow-hidden text-center rounded-2xl border-2 border-transparent bg-transparent px-4 py-2 font-black leading-[1.1] tracking-tight text-(--cf-ink) outline-none transition hover:border-(--cf-orange)/30 focus:border-(--cf-orange) ${titleSizeClass}`}
          />

          {/* Inline Editable Subheading / Description */}
          <textarea
            value={description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Add a subtitle or thank you message..."
            rows={2}
            className="w-full max-w-2xl resize-none overflow-hidden text-center rounded-xl border-2 border-transparent bg-transparent px-3 py-1.5 font-medium text-base sm:text-lg md:text-xl text-(--cf-ink-soft) outline-none transition hover:border-(--cf-orange)/30 focus:border-(--cf-orange) leading-relaxed"
          />
        </div>
      </section>
    );
  }

  // Panel Inspector Form
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Heading / Title
        </label>
        <textarea
          value={title}
          onChange={(e) => onChange({ question: e.target.value })}
          placeholder="Thank you!"
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Description / Subtitle
        </label>
        <textarea
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Add a subtitle or message..."
          rows={4}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
        />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-2">
        <p className="cf-eyebrow text-(--cf-ink)">Slide Info</p>
        <p className="text-xs text-neutral-500 leading-relaxed">
          This is a blank content slide. Participants will see your message without any voting or
          input form.
        </p>
      </div>
    </div>
  );
}
