"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Star,
  Lightbulb,
  Heart,
  Info,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { MentiSlide } from "~/lib/menti";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
  variant?: "panel" | "canvas";
}

const ICONS = [
  { id: "none", label: "None", icon: null },
  { id: "sparkles", label: "Sparkles", icon: Sparkles },
  { id: "star", label: "Star", icon: Star },
  { id: "lightbulb", label: "Idea", icon: Lightbulb },
  { id: "heart", label: "Heart", icon: Heart },
  { id: "info", label: "Info", icon: Info },
  { id: "quote", label: "Quote", icon: Quote },
];

const ACCENT_COLORS = [
  { id: "orange", label: "Canvas Orange", color: "#e4a23e" },
  { id: "blue", label: "Electric Blue", color: "#2563eb" },
  { id: "green", label: "Emerald Green", color: "#059669" },
  { id: "purple", label: "Vivid Purple", color: "#7c3aed" },
  { id: "rose", label: "Crimson Rose", color: "#e11d48" },
  { id: "dark", label: "Neutral Slate", color: "#17171c" },
];

export function ContentEditor({ slide, onChange, variant = "panel" }: Props) {
  const title = slide.question || "";
  const description = slide.description || "";
  const eyebrow = slide.designSettings?.eyebrow || "";
  const textAlign = slide.designSettings?.textAlign || "center";
  const icon = slide.designSettings?.icon || "none";
  const accentColor = slide.designSettings?.accentColor || "#e4a23e";

  const [hasEyebrow, setHasEyebrow] = useState(Boolean(slide.designSettings?.eyebrow));

  const updateDesignSetting = (key: string, value: any) => {
    onChange({
      designSettings: {
        ...slide.designSettings,
        [key]: value,
      },
    });
  };

  if (variant === "canvas") {
    const qLength = title.length;
    const titleSizeClass =
      qLength > 40
        ? "text-3xl sm:text-4xl md:text-5xl"
        : qLength > 20
        ? "text-4xl sm:text-5xl md:text-6xl"
        : "text-5xl sm:text-6xl md:text-7xl";

    const alignClasses =
      textAlign === "left"
        ? "items-start text-left"
        : textAlign === "right"
        ? "items-end text-right"
        : "items-center text-center";

    return (
      <section className="flex h-full min-h-0 w-full flex-col justify-center items-center p-6 sm:p-10 select-none relative">
        {/* Floating Canvas Quick Controls Toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 bg-white/90 backdrop-blur-md border border-(--cf-line-strong) cf-raised rounded-full shadow-md animate-in fade-in zoom-in-95 duration-150">
          {/* Alignment Controls */}
          <div className="flex items-center bg-(--cf-cream) p-0.5 rounded-full border border-(--cf-line)">
            <button
              type="button"
              onClick={() => updateDesignSetting("textAlign", "left")}
              className={`p-1.5 rounded-full transition-colors ${
                textAlign === "left"
                  ? "bg-white text-(--cf-ink) shadow-xs font-bold"
                  : "text-(--cf-ink-soft) hover:text-(--cf-ink)"
              }`}
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateDesignSetting("textAlign", "center")}
              className={`p-1.5 rounded-full transition-colors ${
                textAlign === "center"
                  ? "bg-white text-(--cf-ink) shadow-xs font-bold"
                  : "text-(--cf-ink-soft) hover:text-(--cf-ink)"
              }`}
              title="Align Center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateDesignSetting("textAlign", "right")}
              className={`p-1.5 rounded-full transition-colors ${
                textAlign === "right"
                  ? "bg-white text-(--cf-ink) shadow-xs font-bold"
                  : "text-(--cf-ink-soft) hover:text-(--cf-ink)"
              }`}
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-px h-4 bg-neutral-200" />

          {/* Color Palette Swatches */}
          <div className="flex items-center gap-1">
            {ACCENT_COLORS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => updateDesignSetting("accentColor", item.color)}
                className={`size-5 rounded-full border transition-all ${
                  accentColor === item.color
                    ? "ring-2 ring-offset-1 ring-(--cf-ink) scale-110"
                    : "hover:scale-105 border-black/10"
                }`}
                style={{ backgroundColor: item.color }}
                title={item.label}
              />
            ))}
          </div>

          <div className="w-px h-4 bg-neutral-200" />

          {/* Eyebrow Toggle */}
          <button
            type="button"
            onClick={() => {
              if (hasEyebrow) {
                setHasEyebrow(false);
                updateDesignSetting("eyebrow", "");
              } else {
                setHasEyebrow(true);
                updateDesignSetting("eyebrow", "ANNOUNCEMENT");
              }
            }}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-full border transition-colors ${
              hasEyebrow
                ? "bg-orange-50 text-(--cf-orange) border-(--cf-orange)/40"
                : "bg-white text-(--cf-ink-soft) border-(--cf-line) hover:bg-(--cf-cream)"
            }`}
          >
            {hasEyebrow ? "Kicker On" : "+ Kicker"}
          </button>
        </div>

        {/* Canvas Text Stage */}
        <div
          className={`flex flex-col space-y-4 max-w-3xl w-full my-auto ${alignClasses}`}
        >
          {/* Optional Icon */}
          {icon !== "none" && (
            <div
              className="size-14 rounded-2xl bg-(--cf-cream) border-2 border-(--cf-line-strong) cf-raised flex items-center justify-center mb-1"
              style={{ color: accentColor }}
            >
              {(() => {
                const Found = ICONS.find((i) => i.id === icon)?.icon;
                return Found ? <Found className="w-7 h-7" /> : null;
              })()}
            </div>
          )}

          {/* Eyebrow Text Area */}
          {hasEyebrow && (
            <input
              type="text"
              value={eyebrow}
              onChange={(e) => updateDesignSetting("eyebrow", e.target.value.toUpperCase())}
              placeholder="EYEBROW / KICKER"
              className={`w-full bg-transparent px-3 py-1 font-bold text-xs sm:text-sm tracking-widest uppercase outline-none border-2 border-transparent hover:border-(--cf-orange)/30 focus:border-(--cf-orange) rounded-lg transition-all ${
                textAlign === "left"
                  ? "text-left"
                  : textAlign === "right"
                  ? "text-right"
                  : "text-center"
              }`}
              style={{ color: accentColor }}
            />
          )}

          {/* Main Heading Text Area */}
          <textarea
            value={title}
            onChange={(e) => onChange({ question: e.target.value })}
            placeholder="Add your heading text here..."
            rows={qLength > 30 ? 2 : 1}
            className={`w-full resize-none overflow-hidden rounded-2xl border-2 border-transparent bg-transparent px-4 py-2 font-black leading-[1.1] tracking-tight text-(--cf-ink) outline-none transition hover:border-(--cf-orange)/30 focus:border-(--cf-orange) ${
              textAlign === "left"
                ? "text-left"
                : textAlign === "right"
                ? "text-right"
                : "text-center"
            } ${titleSizeClass}`}
          />

          {/* Description / Body Text Area */}
          <textarea
            value={description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Add a subtitle, takeaway, or body text..."
            rows={3}
            className={`w-full max-w-2xl resize-none overflow-hidden rounded-xl border-2 border-transparent bg-transparent px-3 py-2 font-medium text-base sm:text-lg md:text-xl text-(--cf-ink-soft) outline-none transition hover:border-(--cf-orange)/30 focus:border-(--cf-orange) leading-relaxed ${
              textAlign === "left"
                ? "text-left"
                : textAlign === "right"
                ? "text-right"
                : "text-center"
            }`}
          />
        </div>
      </section>
    );
  }

  // Panel Inspector Form
  return (
    <div className="space-y-6">
      {/* Text Alignment */}
      <div className="space-y-1.5">
        <label className="cf-meta text-[11px] font-bold text-(--cf-ink-soft) uppercase tracking-wider block">
          Text Alignment
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => updateDesignSetting("textAlign", "left")}
            className={`py-2 px-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              textAlign === "left"
                ? "border-(--cf-orange) bg-amber-50 text-(--cf-ink) ring-1 ring-(--cf-orange)"
                : "border-(--cf-line-strong) bg-white text-(--cf-ink-soft) hover:text-(--cf-ink)"
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Left</span>
          </button>
          <button
            type="button"
            onClick={() => updateDesignSetting("textAlign", "center")}
            className={`py-2 px-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              textAlign === "center"
                ? "border-(--cf-orange) bg-amber-50 text-(--cf-ink) ring-1 ring-(--cf-orange)"
                : "border-(--cf-line-strong) bg-white text-(--cf-ink-soft) hover:text-(--cf-ink)"
            }`}
          >
            <AlignCenter className="w-3.5 h-3.5" />
            <span>Center</span>
          </button>
          <button
            type="button"
            onClick={() => updateDesignSetting("textAlign", "right")}
            className={`py-2 px-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              textAlign === "right"
                ? "border-(--cf-orange) bg-amber-50 text-(--cf-ink) ring-1 ring-(--cf-orange)"
                : "border-(--cf-line-strong) bg-white text-(--cf-ink-soft) hover:text-(--cf-ink)"
            }`}
          >
            <AlignRight className="w-3.5 h-3.5" />
            <span>Right</span>
          </button>
        </div>
      </div>

      {/* Decorative Icon Picker */}
      <div className="space-y-1.5">
        <label className="cf-meta text-[11px] font-bold text-(--cf-ink-soft) uppercase tracking-wider block">
          Decorative Icon
        </label>
        <div className="grid grid-cols-4 gap-2">
          {ICONS.map((item) => {
            const Icon = item.icon;
            const isSelected = icon === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => updateDesignSetting("icon", item.id)}
                className={`py-2 px-2 rounded-xl border-2 text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                  isSelected
                    ? "border-(--cf-orange) bg-amber-50 text-(--cf-ink) ring-1 ring-(--cf-orange)"
                    : "border-neutral-200 bg-white text-(--cf-ink-soft) hover:border-(--cf-ink)"
                }`}
              >
                {Icon ? <Icon className="w-4 h-4" /> : <span className="text-[10px]">—</span>}
                <span className="text-[10px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent Color Theme */}
      <div className="space-y-1.5">
        <label className="cf-meta text-[11px] font-bold text-(--cf-ink-soft) uppercase tracking-wider block">
          Accent / Theme Color
        </label>
        <div className="flex items-center gap-2">
          {ACCENT_COLORS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => updateDesignSetting("accentColor", item.color)}
              className={`size-7 rounded-full border-2 transition-transform ${
                accentColor === item.color
                  ? "ring-2 ring-(--cf-ink) ring-offset-2 scale-110 border-white"
                  : "border-black/10 hover:scale-105"
              }`}
              style={{ backgroundColor: item.color }}
              title={item.label}
            />
          ))}
        </div>
      </div>

      {/* Eyebrow / Kicker Input */}
      <div className="space-y-1.5">
        <label className="cf-meta text-[11px] font-bold text-(--cf-ink-soft) uppercase tracking-wider block">
          Kicker / Eyebrow (Optional)
        </label>
        <input
          type="text"
          value={eyebrow}
          onChange={(e) => updateDesignSetting("eyebrow", e.target.value.toUpperCase())}
          placeholder="e.g. KEY TAKEAWAY, CHAPTER 01"
          className="w-full py-2 px-3 text-xs font-bold rounded-lg border border-neutral-200 bg-white text-(--cf-ink) outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange) uppercase"
        />
      </div>

      {/* Heading / Title */}
      <div className="space-y-1.5">
        <label className="cf-meta text-[11px] font-bold text-(--cf-ink-soft) uppercase tracking-wider block">
          Heading / Title
        </label>
        <textarea
          value={title}
          onChange={(e) => onChange({ question: e.target.value })}
          placeholder="Enter main slide heading..."
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-(--cf-ink) outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
        />
      </div>

      {/* Description / Body Text */}
      <div className="space-y-1.5">
        <label className="cf-meta text-[11px] font-bold text-(--cf-ink-soft) uppercase tracking-wider block">
          Body Text / Subtitle
        </label>
        <textarea
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Enter body text, bullet points, or message..."
          rows={4}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-(--cf-ink) outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
        />
      </div>
    </div>
  );
}
