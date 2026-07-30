"use client";

import React from "react";
import { ArrowLeft, ArrowUpRight, Calendar, Clock, Star } from "lucide-react";

interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string | null;
  description?: string | null;
  isRequired: boolean;
  options?: any;
}

interface FormQuestionProps {
  currentField: FormField | undefined;
  currentQuestionIndex: number;
  totalQuestions: number;
  answers: Record<string, any>;
  isPending: boolean;
  handleFieldChange: (fieldId: string, value: any) => void;
  handleNext: () => void;
  handleBack: () => void;
}

/* ── Restyled from the supplied reference ───────────────────────────────
   The logic is untouched — same props, same handlers, same validation path
   in the parent. What changed is the surface:

   · Drawn boxes instead of soft rings. The reference is all `border-2` and
     square corners with hard offset shadows; so is this app's own design
     system (`--hex-radius: 0`, `cf-panel`'s `5px 5px 0` shadow, and the
     "a drawn edge beats a soft panel" rule). The old `ring-1 rounded-lg`
     inputs were the odd ones out.

   · The question sits in a card with a mono `Q01` eyebrow, rather than
     floating as centred text.

   · Selected choices invert to solid ink instead of tinting 10% orange,
     which is both a stronger signal and legible for anyone who can't
     separate the tint from the unselected state.

   · TOGGLE renders as the reference's two side-by-side `yes_no` buttons
     rather than a 12px switch. In a one-question-at-a-time flow the switch
     was the smallest target on a screen with nothing else competing for
     the space.

   Left alone deliberately: the reference's all-caps option labels. These
   are author-written strings, and shouting them back distorts content the
   form owner wrote — `uppercase` on a sentence-case option looks like a
   bug. Only the app's own furniture is set in caps. */

const FIELD_BOX_STYLE: React.CSSProperties = { borderColor: "var(--cf-line-strong)" };

/** Text-ish inputs. Square, drawn, and focus-ringed with the accent. */
const INPUT_CLS =
  "w-full border bg-white px-4 h-[52px] text-[16px] text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 focus:outline-none focus:shadow-[3px_3px_0_0_var(--cf-line-strong)]";

const CHOICE_BASE =
  "w-full flex items-center gap-3 border px-4 py-3.5 text-[15px] text-left transition-colors cursor-pointer";

export function FormQuestion({
  currentField,
  currentQuestionIndex,
  totalQuestions,
  answers,
  isPending,
  handleFieldChange,
  handleNext,
  handleBack,
}: FormQuestionProps) {
  if (!currentField) return null;

  const isLast = currentQuestionIndex === totalQuestions - 1;
  const options: string[] = Array.isArray(currentField.options)
    ? currentField.options
    : (currentField.options as any)?.choices || [];

  const value = answers[currentField.id];
  const inputId = `field-${currentField.id}`;

  /** Selected/unselected treatment shared by every choice control. */
  const choiceStyle = (on: boolean): React.CSSProperties =>
    on
      ? {
          borderColor: "var(--cf-ink)",
          background: "var(--cf-ink)",
          color: "var(--cf-cream)",
          boxShadow: "3px 3px 0 0 var(--cf-line-strong)",
        }
      : { borderColor: "var(--cf-line-strong)", background: "#fff" };

  return (
    <div key={currentQuestionIndex} className="cf-animate-card w-full max-w-xl space-y-6">
      {/* ── question card ── */}
      <div
        className="border"
        style={{
          borderColor: "var(--cf-line-strong)",
          background: "var(--cf-cream-2)",
          boxShadow: "5px 5px 0 0 rgba(26, 29, 41, 0.08)",
        }}
      >
        {/* Ruled title bar, as on the builder's field nodes. */}
        <div
          className="flex items-center justify-between border-b px-4 py-2"
          style={{ borderBottomColor: "var(--cf-line)", background: "var(--cf-cream)" }}
        >
          <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-[color:var(--cf-ink-soft)] uppercase">
            Q{String(currentQuestionIndex + 1).padStart(2, "0")} / {String(totalQuestions).padStart(2, "0")}
          </span>
          {currentField.isRequired && (
            <span
              className="border px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.16em] uppercase"
              style={{ borderColor: "var(--cf-orange)", color: "var(--cf-orange)" }}
            >
              Required
            </span>
          )}
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          {/* heading */}
          <div className="space-y-2">
            <label
              htmlFor={inputId}
              className="cf-display block text-[24px] leading-[1.15] text-[color:var(--cf-ink)] sm:text-[30px]"
            >
              {currentField.label}
            </label>
            {currentField.description && (
              <p className="text-[14px] leading-relaxed text-[color:var(--cf-ink-soft)]">
                {currentField.description}
              </p>
            )}
          </div>

          {/* ── input ── */}
          <div>
            {currentField.type === "TEXT" && (
              <input
                id={inputId}
                type="text"
                placeholder={currentField.placeholder || "Type your answer..."}
                value={value || ""}
                onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
                className={INPUT_CLS}
                style={FIELD_BOX_STYLE}
              />
            )}

            {currentField.type === "TEXTAREA" && (
              <textarea
                id={inputId}
                placeholder={currentField.placeholder || "Type your answer..."}
                value={value || ""}
                onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
                rows={5}
                className="w-full resize-none border bg-white px-4 py-3.5 text-[16px] text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 focus:shadow-[3px_3px_0_0_var(--cf-line-strong)] focus:outline-none"
                style={FIELD_BOX_STYLE}
              />
            )}

            {currentField.type === "EMAIL" && (
              <input
                id={inputId}
                type="email"
                inputMode="email"
                placeholder={currentField.placeholder || "name@domain.com"}
                value={value || ""}
                onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
                className={INPUT_CLS}
                style={FIELD_BOX_STYLE}
                autoComplete="email"
              />
            )}

            {currentField.type === "NUMBER" && (
              <input
                id={inputId}
                type="number"
                inputMode="numeric"
                placeholder={currentField.placeholder || "0"}
                value={value || ""}
                onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
                className={`${INPUT_CLS} tabular-nums`}
                style={FIELD_BOX_STYLE}
              />
            )}

            {currentField.type === "PHONE" && (
              <input
                id={inputId}
                type="tel"
                inputMode="tel"
                placeholder={currentField.placeholder || "+1 (555) 000-0000"}
                value={value || ""}
                onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
                className={INPUT_CLS}
                style={FIELD_BOX_STYLE}
                autoComplete="tel"
              />
            )}

            {currentField.type === "URL" && (
              <input
                id={inputId}
                type="url"
                inputMode="url"
                placeholder={currentField.placeholder || "https://example.com"}
                value={value || ""}
                onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
                className={INPUT_CLS}
                style={FIELD_BOX_STYLE}
              />
            )}

            {/* Radio semantics, so arrow keys and screen readers behave. */}
            {currentField.type === "SELECT" && (
              <div role="radiogroup" aria-labelledby={inputId} className="space-y-2">
                {options.map((opt, i) => {
                  const on = value === opt;
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => handleFieldChange(currentField.id, opt)}
                      className={CHOICE_BASE}
                      style={choiceStyle(on)}
                    >
                      <span
                        className="flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]"
                        style={{ borderColor: "currentColor" }}
                        aria-hidden
                      >
                        {on && "●"}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentField.type === "CHECKBOX" && (
              <div role="group" aria-labelledby={inputId} className="space-y-2">
                {options.map((opt, i) => {
                  const selected: string[] = value || [];
                  const on = selected.includes(opt);
                  return (
                    <button
                      key={i}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() =>
                        handleFieldChange(
                          currentField.id,
                          on ? selected.filter((c) => c !== opt) : [...selected, opt],
                        )
                      }
                      className={CHOICE_BASE}
                      style={choiceStyle(on)}
                    >
                      <span
                        className="flex size-5 shrink-0 items-center justify-center border text-[11px]"
                        style={{ borderColor: "currentColor" }}
                        aria-hidden
                      >
                        {on && "✓"}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentField.type === "RATING" && (
              <div
                role="radiogroup"
                aria-labelledby={inputId}
                className="flex flex-wrap items-center gap-1.5"
              >
                {Array.from({ length: (currentField.options as any)?.max || 5 }).map((_, i) => {
                  const score = i + 1;
                  const on = (value || 0) >= score;
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={value === score}
                      onClick={() => handleFieldChange(currentField.id, score)}
                      className="cursor-pointer p-1 transition-transform hover:scale-125"
                      aria-label={`Rate ${score}`}
                    >
                      <Star
                        className={`size-9 ${
                          on
                            ? "fill-[color:var(--cf-orange)] text-[color:var(--cf-orange)]"
                            : "fill-current text-[color:var(--cf-ink)]/15"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {currentField.type === "DATE" && (
              <div className="relative">
                <input
                  id={inputId}
                  type="date"
                  min={(currentField.options as any)?.minDate || undefined}
                  max={(currentField.options as any)?.maxDate || undefined}
                  value={value || ""}
                  onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
                  className={`${INPUT_CLS} pr-12`}
                  style={FIELD_BOX_STYLE}
                />
                <Calendar
                  className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-[color:var(--cf-ink-soft)]"
                  aria-hidden
                />
              </div>
            )}

            {currentField.type === "TIME" && (
              <div className="relative">
                <input
                  id={inputId}
                  type="time"
                  min={(currentField.options as any)?.minTime || undefined}
                  max={(currentField.options as any)?.maxTime || undefined}
                  value={value || ""}
                  onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
                  className={`${INPUT_CLS} pr-12`}
                  style={FIELD_BOX_STYLE}
                />
                <Clock
                  className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-[color:var(--cf-ink-soft)]"
                  aria-hidden
                />
              </div>
            )}

            {/* Two drawn buttons rather than a switch — the reference's
                `yes_no` treatment. `value` is a real boolean here, so the
                comparison is explicit to keep `undefined` from lighting up
                the "No" side before the default is applied. */}
            {currentField.type === "TOGGLE" && (
              <div role="radiogroup" aria-labelledby={inputId} className="flex gap-3">
                {[
                  { on: true, label: (currentField.options as any)?.activeLabel || "Yes" },
                  { on: false, label: (currentField.options as any)?.inactiveLabel || "No" },
                ].map((choice) => {
                  const selected = value === choice.on;
                  return (
                    <button
                      key={String(choice.on)}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => handleFieldChange(currentField.id, choice.on)}
                      className="flex-1 cursor-pointer border px-4 py-4 text-[16px] font-medium transition-colors"
                      style={choiceStyle(selected)}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── actions ── */}
      {/* Next is the wide one and sits right, so the thumb lands on it. */}
      <div className="flex items-center gap-3">
        {currentQuestionIndex > 0 && (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-[50px] cursor-pointer items-center gap-1.5 border px-4 text-[13.5px] font-medium transition-colors hover:bg-[color:var(--cf-cream-2)]"
            style={{ borderColor: "var(--cf-line-strong)", color: "var(--cf-ink)" }}
          >
            <ArrowLeft className="size-3.5" />
            Back
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={isPending}
          className="group inline-flex h-[50px] flex-1 cursor-pointer items-center justify-center gap-2 border text-[15px] font-semibold text-white transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "var(--cf-orange)",
            borderColor: "var(--cf-line-strong)",
            boxShadow: "4px 4px 0 0 var(--cf-line-strong)",
          }}
        >
          {isLast ? (isPending ? "Submitting..." : "Submit") : "Next"}
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>

      <p className="text-center font-mono text-[10.5px] tracking-[0.1em] text-[color:var(--cf-ink-soft)]/70 uppercase">
        {isLast ? "Press Submit to send your response" : "Press Next to continue"}
      </p>
    </div>
  );
}
