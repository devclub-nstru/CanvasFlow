"use client";

import { Award } from "lucide-react";
import { MentiSlide } from "~/lib/menti";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
  variant?: "panel" | "canvas";
}

export function LeaderboardEditor({ slide, onChange, variant = "panel" }: Props) {
  const heading = slide.question || slide.designSettings.leaderboardTitle || "Quiz leaderboard";
  const showPodium = slide.designSettings.showPodium ?? true;

  // 1. CANVAS VARIANT (WYSIWYG on Stage matching Screenshot 2)
  if (variant === "canvas") {
    return (
      <section className="flex h-full min-h-0 w-full flex-col justify-between p-6 sm:p-10 select-none relative">
        {/* Editable Title */}
        <div className="w-full flex flex-col items-center text-center">
          <input
            value={heading}
            onChange={(event) =>
              onChange({
                question: event.target.value,
                designSettings: {
                  ...slide.designSettings,
                  leaderboardTitle: event.target.value,
                },
              })
            }
            placeholder="Quiz leaderboard"
            className="w-full max-w-2xl text-center rounded-2xl border-2 border-transparent bg-transparent px-3 py-1 font-medium leading-[1.15] tracking-[-0.04em] text-neutral-900 outline-none transition hover:border-(--cf-orange)/30 focus:border-(--cf-orange) text-3xl sm:text-4xl md:text-5xl"
          />
        </div>

        {/* Empty State placeholder (1:1 with Reference Screenshot 2) */}
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto my-auto py-8">
          <div className="size-16 rounded-2xl bg-(--cf-cream) border-2 border-(--cf-line-strong) flex items-center justify-center mb-4 shadow-sm">
            <Award className="size-8 text-(--cf-ink-soft)" />
          </div>
          <h3 className="cf-display text-2xl sm:text-3xl uppercase tracking-tight text-neutral-900">
            No results yet
          </h3>
          <p className="mt-2 text-sm sm:text-base text-(--cf-ink-soft) leading-relaxed">
            Top Quiz participants will be displayed here once there are results!
          </p>
        </div>

        {/* Subtitle */}
        <div className="w-full flex items-center justify-center">
          <span className="cf-meta text-(--cf-ink-soft) text-[10px]">
            Quiz Leaderboard Slide
          </span>
        </div>
      </section>
    );
  }

  // 2. PANEL VARIANT (Inspector settings matching Screenshot 2)
  return (
    <div className="space-y-5">
      {/* Heading input */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Label for heading
        </label>
        <input
          value={heading}
          onChange={(event) =>
            onChange({
              question: event.target.value,
              designSettings: {
                ...slide.designSettings,
                leaderboardTitle: event.target.value,
              },
            })
          }
          placeholder="Quiz leaderboard"
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
        />
      </div>

      {/* Leaderboard Settings Box */}
      <div className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-3">
        <p className="cf-eyebrow text-(--cf-ink)">Leaderboard settings</p>

        {/* Show Top 3 Podium highlight */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-neutral-700 block">
              Highlight Top 3
            </span>
            <span className="text-[11px] text-neutral-400 block">
              Display medals and colored badges for top 3
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showPodium}
            onClick={() =>
              onChange({
                designSettings: {
                  ...slide.designSettings,
                  showPodium: !showPodium,
                },
              })
            }
            className="cf-toggle"
          >
            <span />
          </button>
        </div>
      </div>
    </div>
  );
}
