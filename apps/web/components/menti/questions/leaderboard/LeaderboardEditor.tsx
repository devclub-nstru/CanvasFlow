"use client";

import React from "react";
import { Trophy, Lock } from "lucide-react";
import { MentiSlide } from "~/lib/menti";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
  variant?: "panel" | "canvas";
}

/**
 * A leaderboard slide has no options and no response settings — it renders live
 * session standings. Only its heading is authorable.
 */
export function LeaderboardEditor({ slide, onChange, variant = "panel" }: Props) {
  if (variant === "canvas") {
    const questionLength = slide.question?.length || 0;
    const fontSizeClass =
      questionLength > 40
        ? "text-2xl sm:text-3xl md:text-4xl"
        : "text-3xl sm:text-4xl md:text-5xl";

    return (
      <section className="relative flex h-full min-h-0 w-full flex-col items-center p-3 select-none sm:p-5">
        <textarea
          value={slide.question}
          onChange={(event) => onChange({ question: event.target.value })}
          placeholder="Leaderboard"
          rows={1}
          className={`w-full max-w-2xl resize-none overflow-hidden rounded-2xl border-2 border-transparent bg-transparent px-3 py-1 text-center font-medium leading-[1.15] tracking-[-0.04em] text-neutral-800 outline-none transition hover:border-(--cf-orange)/30 focus:border-(--cf-orange) ${fontSizeClass}`}
        />

        {/* Placeholder standings: the real ones only exist during a session. */}
        <div className="mx-auto mt-4 flex w-full max-w-xl flex-1 flex-col justify-center gap-2">
          {[
            { rank: 1, name: "First place", width: "100%", chip: "bg-[#e4a23e]" },
            { rank: 2, name: "Second place", width: "78%", chip: "bg-[#9189eb]" },
            { rank: 3, name: "Third place", width: "61%", chip: "bg-[#43b7a6]" },
            { rank: 4, name: "Fourth place", width: "44%", chip: "bg-(--cf-ink)" },
          ].map((row) => (
            <div
              key={row.rank}
              className="relative flex items-center gap-2 overflow-hidden rounded-xl border-2 border-(--cf-line) bg-white px-3 py-2"
            >
              <div
                className="absolute inset-y-0 left-0 bg-(--cf-cream)"
                style={{ width: row.width }}
              />
              <span
                className={`relative grid size-8 shrink-0 place-items-center rounded-lg font-mono text-sm font-black text-white tabular-nums ${row.chip}`}
              >
                {row.rank}
              </span>
              <span className="relative flex-1 text-sm font-bold text-neutral-400">
                {row.name}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 shrink-0 text-center font-mono text-[10px] font-bold tracking-wider uppercase text-(--cf-ink-soft)">
          Live standings appear when you present
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-neutral-500">
          Heading
        </label>
        <textarea
          value={slide.question}
          onChange={(event) => onChange({ question: event.target.value })}
          placeholder="Leaderboard"
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-white p-3.5">
        <Trophy className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-(--cf-ink)">Automatic standings</p>
          <p className="text-[11px] leading-relaxed text-neutral-500">
            This slide totals every quiz answer in the session and animates the
            change since the previous question — points counting up, bars
            expanding and players swapping places.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
        <Lock className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-amber-900">Paired with a quiz</p>
          <p className="text-[11px] leading-relaxed text-amber-800">
            This leaderboard belongs to the quiz slide before it and is removed
            together with it. Delete the quiz slide to remove both.
          </p>
        </div>
      </div>
    </div>
  );
}
