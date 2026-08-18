"use client";

import React, { useState } from "react";
import { Plus, Trash2, Check, AlertTriangle } from "lucide-react";
import { MentiOption, MentiSlide } from "~/lib/menti";
import {
  DEFAULT_BASE_POINTS,
  DEFAULT_COUNTDOWN_SECONDS,
  DEFAULT_TIME_LIMIT_SECONDS,
} from "~/lib/quiz";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
  variant?: "panel" | "canvas";
}

const SLOTS = [
  { color: "#5268e8", glyph: "▲" },
  { color: "#ff7378", glyph: "◆" },
  { color: "#e4a23e", glyph: "●" },
  { color: "#43b7a6", glyph: "■" },
  { color: "#9189eb", glyph: "★" },
  { color: "#313c8e", glyph: "✚" },
];

const MIN_OPTIONS = 2;

const makeOption = (index: number): MentiOption => ({
  id: `quiz-${crypto.randomUUID()}`,
  label: `Answer ${index}`,
  isCorrect: false,
  voteCount: 0,
});

export function QuizEditor({ slide, onChange, variant = "panel" }: Props) {
  const options = slide.options;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const settings = slide.responseSettings;
  const correctCount = options.filter((opt) => opt.isCorrect).length;

  const updateOption = (index: number, patch: Partial<MentiOption>) => {
    onChange({
      options: options.map((opt, i) => (i === index ? { ...opt, ...patch } : opt)),
    });
  };

  const toggleCorrect = (index: number) => {
    const target = options[index];
    if (!target) return;
    onChange({
      options: options.map((opt, i) =>
        i === index ? { ...opt, isCorrect: !opt.isCorrect } : opt,
      ),
    });
  };

  const addOption = () => onChange({ options: [...options, makeOption(options.length + 1)] });

  const removeOption = (index: number) => {
    if (options.length > MIN_OPTIONS) {
      onChange({ options: options.filter((_, i) => i !== index) });
    }
  };

  const updateSettings = (patch: Partial<MentiSlide["responseSettings"]>) => {
    onChange({ responseSettings: { ...slide.responseSettings, ...patch } });
  };

  /**
   * A quiz with nothing marked correct can never be answered correctly — every
   * participant scores zero. Surfaced prominently because it is silent at
   * runtime.
   */
  const noAnswerWarning = correctCount === 0;

  /* ── canvas variant ──────────────────────────────────────────────────── */

  if (variant === "canvas") {
    const questionLength = slide.question?.length || 0;
    const fontSizeClass =
      questionLength > 60
        ? "text-xl sm:text-2xl md:text-3xl"
        : questionLength > 30
          ? "text-2xl sm:text-3xl md:text-4xl"
          : "text-3xl sm:text-4xl md:text-5xl";

    return (
      <section className="relative flex h-full min-h-0 w-full flex-col p-3 select-none sm:p-5">
        <div className="flex w-full shrink-0 flex-col items-center gap-1.5">
          <textarea
            value={slide.question}
            onChange={(event) => onChange({ question: event.target.value })}
            placeholder="Ask a question with one right answer"
            rows={questionLength > 35 ? 2 : 1}
            className={`w-full max-w-3xl resize-none overflow-hidden rounded-2xl border-2 border-transparent bg-transparent px-3 py-1 text-center font-medium leading-[1.15] tracking-[-0.04em] text-neutral-800 outline-none transition hover:border-(--cf-orange)/30 focus:border-(--cf-orange) ${fontSizeClass}`}
          />

          <div className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-wider uppercase text-(--cf-ink-soft)">
            <span>
              {settings.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS}s read ·{" "}
              {settings.timeLimitSeconds ?? DEFAULT_TIME_LIMIT_SECONDS}s answer ·{" "}
              {settings.basePoints ?? DEFAULT_BASE_POINTS} pts
            </span>
          </div>

          {noAnswerWarning && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
              <AlertTriangle className="size-3" />
              <span>Mark a correct answer or nobody can score</span>
            </div>
          )}
        </div>

        <div className="mx-auto mt-4 grid w-full max-w-3xl flex-1 content-center gap-2 sm:grid-cols-2">
          {options.map((option, index) => {
            const slot = SLOTS[index % SLOTS.length]!;
            const selected = option.id === selectedId;

            return (
              <div
                key={option.id}
                onClick={() => setSelectedId(option.id)}
                className={`group flex items-center gap-2 rounded-xl border-2 bg-white px-2 py-2 transition-colors ${
                  option.isCorrect
                    ? "border-emerald-500 ring-1 ring-emerald-200"
                    : selected
                      ? "border-(--cf-orange) ring-1 ring-(--cf-orange)"
                      : "border-(--cf-line-strong) hover:border-neutral-400"
                }`}
              >
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-base font-black text-white"
                  style={{ backgroundColor: slot.color }}
                >
                  {slot.glyph}
                </span>

                <input
                  value={option.label}
                  onClick={(event) => event.stopPropagation()}
                  onFocus={() => setSelectedId(option.id)}
                  onChange={(event) => updateOption(index, { label: event.target.value })}
                  placeholder={`Answer ${index + 1}`}
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-neutral-800 outline-none placeholder:text-neutral-400"
                />

                <button
                  type="button"
                  aria-label={`Mark ${option.label} as correct`}
                  title="Mark as correct"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleCorrect(index);
                  }}
                  className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition ${
                    option.isCorrect
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-neutral-300 text-transparent hover:border-emerald-400"
                  }`}
                >
                  <Check className="size-3.5 stroke-[3]" />
                </button>

                <button
                  type="button"
                  aria-label={`Delete ${option.label}`}
                  disabled={options.length <= MIN_OPTIONS}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeOption(index);
                  }}
                  className="rounded p-1 text-neutral-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-25"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addOption}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-(--cf-orange)/40 py-2 text-xs font-bold text-(--cf-orange) transition hover:bg-(--cf-orange)/5"
          >
            <Plus className="size-3.5 stroke-[3]" /> Add answer
          </button>
        </div>
      </section>
    );
  }

  /* ── panel variant ───────────────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-semibold tracking-wider uppercase text-neutral-500">
          Question
        </label>
        <textarea
          value={slide.question}
          onChange={(event) => onChange({ question: event.target.value })}
          placeholder="Ask a question with one right answer"
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
        />
      </div>

      {noAnswerWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] font-medium text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            No correct answer is marked, so every participant will score zero. Tick
            the circle next to the right answer.
          </span>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold tracking-wider uppercase text-neutral-500">
            Answers
          </label>
          <span className="text-xs text-neutral-400">
            {correctCount} correct
          </span>
        </div>

        <div className="space-y-2">
          {options.map((option, index) => (
            <div
              key={option.id}
              className={`flex items-center gap-2 rounded-lg border bg-white p-2 ${
                option.isCorrect ? "border-emerald-400 bg-emerald-50/40" : "border-neutral-200"
              }`}
            >
              <button
                type="button"
                aria-label={`Mark answer ${index + 1} as correct`}
                onClick={() => toggleCorrect(index)}
                className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition ${
                  option.isCorrect
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-neutral-300 text-transparent hover:border-emerald-400"
                }`}
              >
                <Check className="size-3 stroke-[3]" />
              </button>
              <input
                value={option.label}
                onChange={(event) => updateOption(index, { label: event.target.value })}
                placeholder={`Answer ${index + 1}`}
                className="min-w-0 flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
              />
              <button
                type="button"
                aria-label={`Delete answer ${index + 1}`}
                disabled={options.length <= MIN_OPTIONS}
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
          <Plus className="size-3.5" /> Add answer
        </button>

        <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
          Marking more than one answer requires participants to select that exact
          combination — a partial match does not score.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-3.5">
        <p className="cf-eyebrow text-(--cf-ink)">Timing &amp; scoring</p>

        <label className="flex items-center justify-between gap-4 text-xs font-medium text-neutral-700">
          <span>Reading countdown (s)</span>
          <input
            type="number"
            min={0}
            max={30}
            value={settings.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS}
            onChange={(event) =>
              updateSettings({
                countdownSeconds: Math.max(0, Math.min(30, Number(event.target.value) || 0)),
              })
            }
            className="w-20 rounded border border-neutral-200 px-2 py-1 text-right tabular-nums outline-none focus:border-(--cf-orange)"
          />
        </label>

        <label className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-2 text-xs font-medium text-neutral-700">
          <span>Time to answer (s)</span>
          <input
            type="number"
            min={5}
            max={300}
            value={settings.timeLimitSeconds ?? DEFAULT_TIME_LIMIT_SECONDS}
            onChange={(event) =>
              updateSettings({
                timeLimitSeconds: Math.max(5, Math.min(300, Number(event.target.value) || 5)),
              })
            }
            className="w-20 rounded border border-neutral-200 px-2 py-1 text-right tabular-nums outline-none focus:border-(--cf-orange)"
          />
        </label>

        <label className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-2 text-xs font-medium text-neutral-700">
          <span>Points (fastest)</span>
          <input
            type="number"
            min={0}
            max={10000}
            step={100}
            value={settings.basePoints ?? DEFAULT_BASE_POINTS}
            onChange={(event) =>
              updateSettings({
                basePoints: Math.max(0, Math.min(10000, Number(event.target.value) || 0)),
              })
            }
            className="w-20 rounded border border-neutral-200 px-2 py-1 text-right tabular-nums outline-none focus:border-(--cf-orange)"
          />
        </label>

        <p className="border-t border-neutral-100 pt-2 text-[11px] leading-relaxed text-neutral-500">
          A correct answer scores from {settings.basePoints ?? DEFAULT_BASE_POINTS} down
          to {Math.round((settings.basePoints ?? DEFAULT_BASE_POINTS) / 2)} points as
          the clock runs. Wrong answers score nothing.
        </p>
      </div>
    </div>
  );
}
