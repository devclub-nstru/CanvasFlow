"use client";

import { Check, Copy, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { MentiOption, MentiSlide } from "~/lib/menti";
import { CustomSelect } from "~/components/ui/CustomSelect";
import { motion, useReducedMotion } from "motion/react";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
  onToggleQuizLeaderboard?: (quizSlideId: string, enable: boolean) => void;
  variant?: "panel" | "canvas";
}

const colors = ["#2d5cf6", "#ff7378", "#9189eb", "#43b7a6", "#e4a23e", "#313c8e"];

const makeOption = (index: number, isCorrect: boolean = false): MentiOption => ({
  id: `q-opt-${crypto.randomUUID()}`,
  label: `Option ${index}`,
  color: colors[(index - 1) % colors.length],
  isCorrect,
  voteCount: 0,
});

/** Split option list into balanced rows (e.g. 4 -> 1x4, 5 -> 3+2, 6 -> 3+3, 7 -> 4+3, 8 -> 4+4) */
function splitIntoBalancedRows<T>(items: T[]): T[][] {
  const n = items.length;
  if (n <= 4) return [items];
  if (n === 5) return [items.slice(0, 3), items.slice(3, 5)];
  if (n === 6) return [items.slice(0, 3), items.slice(3, 6)];
  if (n === 7) return [items.slice(0, 4), items.slice(4, 7)];
  if (n === 8) return [items.slice(0, 4), items.slice(4, 8)];
  if (n === 9) return [items.slice(0, 3), items.slice(3, 6), items.slice(6, 9)];
  if (n === 10) return [items.slice(0, 4), items.slice(4, 7), items.slice(7, 10)];

  const rowCount = Math.ceil(n / 4);
  const perRow = Math.ceil(n / rowCount);
  const rows: T[][] = [];
  for (let i = 0; i < n; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }
  return rows;
}

const TIME_OPTIONS = [
  { value: "10", label: "10 seconds" },
  { value: "15", label: "15 seconds" },
  { value: "20", label: "20 seconds" },
  { value: "30", label: "30 seconds" },
  { value: "45", label: "45 seconds" },
  { value: "60", label: "60 seconds" },
  { value: "90", label: "90 seconds" },
];

const SCORE_ALLOCATION_OPTIONS = [
  { value: "time_based", label: "Time-based" },
  { value: "fixed", label: "Fixed points" },
  { value: "none", label: "None" },
];

export function QuizEditor({
  slide,
  onChange,
  onToggleQuizLeaderboard,
  variant = "panel",
}: Props) {
  const options = slide.options || [];
  const reduceMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Normalize: ensure exactly ONE option is marked as correct
  const correctCount = options.filter((o) => o.isCorrect).length;
  if (options.length > 0 && correctCount !== 1) {
    const firstCorrectIdx = options.findIndex((o) => o.isCorrect);
    const targetIdx = firstCorrectIdx >= 0 ? firstCorrectIdx : 0;
    const normalized = options.map((opt, i) => ({
      ...opt,
      isCorrect: i === targetIdx,
    }));
    onChange({ options: normalized });
  }

  const updateOption = (index: number, patch: Partial<MentiOption>) => {
    onChange({
      options: options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option
      ),
    });
  };

  /** Set single correct option (enforces exactly one correct answer) */
  const setSingleCorrect = (index: number) => {
    onChange({
      options: options.map((option, optionIndex) => ({
        ...option,
        isCorrect: optionIndex === index,
      })),
    });
  };

  const addOption = () => {
    // New option is false by default since one answer is already chosen as correct
    const newOpt = makeOption(options.length + 1, options.length === 0);
    onChange({
      options: [...options, newOpt],
    });
    setSelectedId(newOpt.id);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const wasCorrect = options[index]?.isCorrect;
    const remaining = options.filter((_, optionIndex) => optionIndex !== index);

    // If we removed the single correct option, assign the first remaining option as correct
    if (wasCorrect && remaining.length > 0 && remaining[0]) {
      const firstOpt = remaining[0];
      remaining[0] = {
        id: firstOpt.id,
        label: firstOpt.label,
        color: firstOpt.color,
        voteCount: firstOpt.voteCount,
        isCorrect: true,
      };
    }

    onChange({ options: remaining });
    if (selectedId === options[index]?.id) {
      setSelectedId(null);
    }
  };

  const updateSettings = (patch: Partial<MentiSlide["responseSettings"]>) => {
    const updatedResponseSettings = { ...slide.responseSettings, ...patch };
    const updatedQuizSettings = {
      timeLimitSeconds: updatedResponseSettings.timeToRespondSeconds || 30,
      maxPoints: 1000,
      gradingScheme: (updatedResponseSettings.scoreAllocation === "fixed"
        ? "answer_based"
        : "time_based") as "answer_based" | "time_based",
    };
    onChange({
      responseSettings: updatedResponseSettings,
      quizSettings: updatedQuizSettings,
    });
  };

  const selectedIndex = options.findIndex((option) => option.id === selectedId);
  const selectedOption = options[selectedIndex];

  // 1. CANVAS VARIANT (WYSIWYG with direct inline customization matching BarGraphEditor)
  if (variant === "canvas") {
    const qLength = slide.question?.length || 0;
    const fontSizeClass =
      qLength > 60
        ? "text-xl sm:text-2xl md:text-3xl"
        : qLength > 30
        ? "text-2xl sm:text-3xl md:text-4xl"
        : "text-3xl sm:text-4xl md:text-5xl";

    const totalVotes = options.reduce((sum, o) => sum + (o.voteCount || 0), 0);
    const maxVotes = Math.max(1, ...options.map((o) => o.voteCount || 0));

    const rows = splitIntoBalancedRows(options);
    const isMultiRow = rows.length > 1;

    const containerHeight = isMultiRow
      ? "h-20 sm:h-24 md:h-28"
      : "h-44 sm:h-52 md:h-60 lg:h-72";

    return (
      <section className="flex h-full min-h-0 w-full flex-col justify-between p-3 sm:p-5 select-none relative">
        {/* Dynamic Multi-line Question Input */}
        <div className="w-full flex flex-col items-center gap-1">
          <textarea
            value={slide.question}
            onChange={(event) => onChange({ question: event.target.value })}
            placeholder="Type your quiz question here..."
            rows={qLength > 35 ? 2 : 1}
            className={`w-full max-w-3xl resize-none overflow-hidden text-center rounded-2xl border-2 border-transparent bg-transparent px-3 py-1 font-medium leading-[1.15] tracking-[-0.04em] text-neutral-900 outline-none transition hover:border-(--cf-orange)/30 focus:border-(--cf-orange) ${
              isMultiRow ? "text-2xl sm:text-3xl md:text-4xl" : fontSizeClass
            }`}
          />
        </div>

        {/* Centered Multi-Row Grid of Interactive Option Columns (Like BarGraphEditor) */}
        <div
          className={`mt-auto flex flex-col items-center justify-end w-full max-w-5xl mx-auto ${
            isMultiRow ? "gap-3 sm:gap-4 pt-1" : "pt-4"
          }`}
        >
          {rows.map((rowOptions, rowIndex) => (
            <div
              key={`quiz-edit-row-${rowIndex}`}
              className={`flex items-end justify-center w-full gap-3 sm:gap-5 ${
                isMultiRow
                  ? "h-28 sm:h-36 md:h-42"
                  : "h-60 sm:h-72 md:h-80 lg:h-92"
              }`}
            >
              {rowOptions.map((option) => {
                const globalIndex = options.findIndex((o) => o.id === option.id);
                const selected = option.id === selectedId;
                const isCorrect = Boolean(option.isCorrect);
                const count = option.voteCount || 0;
                const fill = totalVotes > 0 ? (count / maxVotes) * 100 : 0;
                const optionColor = option.color || colors[globalIndex % colors.length];

                return (
                  <div
                    key={option.id}
                    onClick={() => setSelectedId(option.id)}
                    onMouseEnter={() => setHoveredId(option.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`group relative flex-1 min-w-[100px] h-full flex flex-col justify-end cursor-pointer rounded-2xl border-2 px-3 pb-3 pt-2 transition-all duration-150 ${
                      isMultiRow ? "max-w-[200px]" : "max-w-[240px]"
                    } ${
                      selected
                        ? "border-(--cf-orange) bg-white/95 shadow-xl ring-1 ring-(--cf-orange)"
                        : hoveredId === option.id
                        ? "border-neutral-300 bg-white/70"
                        : "border-transparent bg-neutral-50/40 hover:bg-white/50"
                    }`}
                  >
                    {/* Floating Add Option Button on Right Edge of Box */}
                    {(selected || hoveredId === option.id) && (
                      <button
                        type="button"
                        aria-label="Add option"
                        onClick={(event) => {
                          event.stopPropagation();
                          addOption();
                        }}
                        className="absolute right-[-14px] top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-(--cf-orange) text-white shadow-md hover:scale-110 transition-transform z-10"
                      >
                        <Plus className="size-4 stroke-[3]" />
                      </button>
                    )}

                    {/* Top Vote Count & Single Correct Radio Indicator */}
                    <div className="flex items-center justify-between gap-1 mb-2 px-1">
                      <span className="font-semibold text-xl sm:text-2xl text-neutral-900 tabular-nums">
                        {count}
                      </span>

                      {/* Single Correct Radio Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSingleCorrect(globalIndex);
                        }}
                        title={
                          isCorrect
                            ? "Single correct answer"
                            : "Click to set as single correct answer"
                        }
                        className={`size-6 rounded-full flex items-center justify-center transition-all shadow-xs ${
                          isCorrect
                            ? "bg-emerald-600 text-white ring-2 ring-emerald-300 scale-105"
                            : "bg-white border-2 border-neutral-300 text-neutral-300 hover:border-emerald-500 hover:text-emerald-500"
                        }`}
                      >
                        {isCorrect ? (
                          <Check className="size-3.5 stroke-[3]" />
                        ) : (
                          <X className="size-3 stroke-[2.5]" />
                        )}
                      </button>
                    </div>

                    {/* Rising Bar Visual Stage */}
                    <div
                      className={`relative w-full flex flex-col justify-end items-center mb-2.5 ${containerHeight}`}
                    >
                      <motion.div
                        initial={{ height: "0%" }}
                        animate={{
                          height: `${fill}%`,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 75,
                          damping: 15,
                          mass: 0.85,
                          delay: reduceMotion ? 0 : globalIndex * 0.06,
                        }}
                        className={`w-full relative rounded-t-xl transition-all ${
                          isCorrect ? "ring-2 ring-emerald-500/80" : ""
                        }`}
                        style={{
                          backgroundColor: fill > 0 ? optionColor : "#e5e7eb",
                          minHeight: "6px",
                        }}
                      />
                    </div>

                    {/* Option Label Input */}
                    <input
                      value={option.label}
                      onClick={(event) => event.stopPropagation()}
                      onFocus={() => setSelectedId(option.id)}
                      onChange={(event) =>
                        updateOption(globalIndex, { label: event.target.value })
                      }
                      placeholder={`Option ${globalIndex + 1}`}
                      className={`mt-2 w-full bg-transparent font-medium tracking-[-0.03em] text-neutral-800 outline-none text-center placeholder:text-neutral-400 ${
                        isMultiRow
                          ? "text-xs sm:text-sm md:text-base"
                          : "text-sm sm:text-base md:text-lg"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Selected Option Floating Toolbar (Matching BarGraphEditor) */}
        {selectedOption && (
          <div className="mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg animate-in fade-in zoom-in-95">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Set ${selectedOption.label} colour`}
                onClick={() => updateOption(selectedIndex, { color })}
                className={`size-5 rounded-full border-2 transition-transform ${
                  selectedOption.color === color
                    ? "border-neutral-900 scale-110"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <span className="mx-1 h-5 w-px bg-neutral-200" />

            {/* Single Correct Answer Selector */}
            <button
              type="button"
              aria-label="Set as single correct answer"
              onClick={() => setSingleCorrect(selectedIndex)}
              className={`rounded px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 transition-colors ${
                selectedOption.isCorrect
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <Check className="size-3 stroke-[3]" />
              {selectedOption.isCorrect ? "Correct answer" : "Mark as correct"}
            </button>

            <span className="mx-1 h-5 w-px bg-neutral-200" />
            <button
              type="button"
              aria-label="Duplicate option"
              onClick={() => {
                const newOpt = {
                  ...selectedOption,
                  id: `q-opt-${crypto.randomUUID()}`,
                  label: `${selectedOption.label} copy`,
                  isCorrect: false, // duplicate is not correct (enforces single correct)
                };
                onChange({
                  options: [...options, newOpt],
                });
              }}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-100"
            >
              <Copy className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete option"
              disabled={options.length <= 2}
              onClick={() => removeOption(selectedIndex)}
              className="rounded p-1 text-neutral-600 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </section>
    );
  }

  // 2. PANEL VARIANT (Right-hand inspector settings)
  const currentTime = String(slide.responseSettings.timeToRespondSeconds || "30");
  const currentScore = slide.responseSettings.scoreAllocation || "time_based";
  const addLeaderboard = slide.responseSettings.addLeaderboard ?? true;

  return (
    <div className="space-y-5">
      {/* Question Input */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Question
        </label>
        <textarea
          value={slide.question}
          onChange={(event) => onChange({ question: event.target.value })}
          placeholder="Select Answer question..."
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-(--cf-orange) focus:ring-1 focus:ring-(--cf-orange)"
        />
      </div>

      {/* Options List with Single Correct Radio Selection */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Options
          </label>
        </div>
        <div className="space-y-2">
          {options.map((option, index) => {
            const isCorrect = Boolean(option.isCorrect);
            return (
              <div
                key={option.id}
                className={`group flex items-center gap-2 rounded-lg border p-2 transition-colors ${
                  isCorrect
                    ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-400"
                    : "border-neutral-200 bg-white"
                }`}
              >
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

                {/* Single Correct Radio Selector Button */}
                <button
                  type="button"
                  title={
                    isCorrect
                      ? "Single correct answer"
                      : "Click to select as single correct answer"
                  }
                  onClick={() => setSingleCorrect(index)}
                  className={`size-6 rounded-full flex items-center justify-center transition-all ${
                    isCorrect
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "border border-neutral-300 text-neutral-300 hover:border-emerald-500 hover:text-emerald-500 bg-white"
                  }`}
                >
                  <Check className="size-3.5 stroke-[3]" />
                </button>

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
            );
          })}
        </div>

        <button
          type="button"
          onClick={addOption}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-(--cf-orange)/40 py-2 text-xs font-semibold text-(--cf-orange) transition hover:bg-blue-50"
        >
          <Plus className="size-3.5" /> Add option
        </button>
      </div>

      {/* Quiz Settings Section */}
      <div className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-3.5">
        <p className="cf-eyebrow text-(--cf-ink)">Quiz settings</p>

        {/* Time to respond */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600 block">
            Time to respond
          </label>
          <CustomSelect
            value={currentTime}
            onChange={(val) => updateSettings({ timeToRespondSeconds: Number(val) })}
            options={TIME_OPTIONS}
            className="w-full"
          />
        </div>

        {/* Score allocation */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600 block">
            Score allocation
          </label>
          <CustomSelect
            value={currentScore}
            onChange={(val) =>
              updateSettings({
                scoreAllocation: val as "time_based" | "fixed" | "none",
              })
            }
            options={SCORE_ALLOCATION_OPTIONS}
            className="w-full"
          />
        </div>

        {/* Add leaderboard toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-neutral-700 block">
              Add leaderboard
            </span>
            <span className="text-[11px] text-neutral-400 block">
              Insert a live leaderboard after this question
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={addLeaderboard}
            onClick={() => {
              const nextVal = !addLeaderboard;
              if (onToggleQuizLeaderboard) {
                onToggleQuizLeaderboard(slide.id, nextVal);
              } else {
                updateSettings({ addLeaderboard: nextVal });
              }
            }}
            className="cf-toggle"
          >
            <span />
          </button>
        </div>
      </div>
    </div>
  );
}
