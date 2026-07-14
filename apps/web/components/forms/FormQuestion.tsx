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

const INPUT_CLS =
  "w-full bg-[color:var(--cf-cream)] rounded-lg ring-1 ring-[color:var(--cf-line-strong)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none px-5 h-[52px] text-[16px] text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 transition-shadow";

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
  const options = Array.isArray(currentField.options)
    ? currentField.options
    : (currentField.options as any)?.choices || [];

  return (
    <div key={currentQuestionIndex} className="w-full max-w-xl space-y-8 cf-animate-card">
      {/* progress eyebrow */}
      <div className="flex items-center justify-center gap-2 cf-eyebrow text-[color:var(--cf-ink-soft)]">
        <span>
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </span>
        {currentField.isRequired && (
          <>
            <span className="text-[color:var(--cf-line-strong)]">·</span>
            <span className="text-[color:var(--cf-orange)]">Required</span>
          </>
        )}
      </div>

      {/* heading + description */}
      <div className="text-center space-y-3">
        <h2 className="cf-display text-[28px] sm:text-[34px] md:text-[40px] leading-[1.1] text-[color:var(--cf-ink)]">
          {currentField.label}
        </h2>
        {currentField.description && (
          <p className="text-[14.5px] text-[color:var(--cf-ink-soft)] leading-relaxed max-w-md mx-auto">
            {currentField.description}
          </p>
        )}
      </div>

      {/* input */}
      <div className="pt-2">
        {currentField.type === "TEXT" && (
          <input
            type="text"
            placeholder={currentField.placeholder || "Type your answer..."}
            value={answers[currentField.id] || ""}
            onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
            className={INPUT_CLS}
          />
        )}

        {currentField.type === "TEXTAREA" && (
          <textarea
            placeholder={currentField.placeholder || "Type your answer..."}
            value={answers[currentField.id] || ""}
            onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
            rows={4}
            className="w-full bg-[color:var(--cf-cream)] rounded-lg ring-1 ring-[color:var(--cf-line-strong)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none px-5 py-4 text-[16px] text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 resize-none transition-shadow"
          />
        )}

        {currentField.type === "EMAIL" && (
          <input
            type="email"
            placeholder={currentField.placeholder || "name@domain.com"}
            value={answers[currentField.id] || ""}
            onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
            className={INPUT_CLS}
            autoComplete="email"
          />
        )}

        {currentField.type === "NUMBER" && (
          <input
            type="number"
            placeholder={currentField.placeholder || "0"}
            value={answers[currentField.id] || ""}
            onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
            className={INPUT_CLS}
          />
        )}

        {currentField.type === "PHONE" && (
          <input
            type="tel"
            placeholder={currentField.placeholder || "+1 (555) 000-0000"}
            value={answers[currentField.id] || ""}
            onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
            className={INPUT_CLS}
            autoComplete="tel"
          />
        )}

        {currentField.type === "URL" && (
          <input
            type="url"
            placeholder={currentField.placeholder || "https://example.com"}
            value={answers[currentField.id] || ""}
            onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
            className={INPUT_CLS}
          />
        )}

        {currentField.type === "SELECT" && (
          <div className="space-y-2">
            {options.map((opt: string, i: number) => {
              const isSelected = answers[currentField.id] === opt;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleFieldChange(currentField.id, opt)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 rounded-lg text-[15px] text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[color:var(--cf-orange)]/10 ring-2 ring-[color:var(--cf-orange)] text-[color:var(--cf-ink)]"
                      : "bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line-strong)] hover:ring-[color:var(--cf-ink)]/30 text-[color:var(--cf-ink)]"
                  }`}
                >
                  <span>{opt}</span>
                  <span
                    className={`size-4 rounded-full ring-1 transition-colors ${
                      isSelected
                        ? "bg-[color:var(--cf-orange)] ring-[color:var(--cf-orange)]"
                        : "bg-transparent ring-[color:var(--cf-line-strong)]"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        )}

        {currentField.type === "CHECKBOX" && (
          <div className="space-y-2">
            {options.map((opt: string, i: number) => {
              const selected = answers[currentField.id] || [];
              const isChecked = selected.includes(opt);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const next = isChecked
                      ? selected.filter((c: string) => c !== opt)
                      : [...selected, opt];
                    handleFieldChange(currentField.id, next);
                  }}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-lg text-[15px] text-left transition-all cursor-pointer ${
                    isChecked
                      ? "bg-[color:var(--cf-orange)]/10 ring-2 ring-[color:var(--cf-orange)]"
                      : "bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line-strong)] hover:ring-[color:var(--cf-ink)]/30"
                  }`}
                >
                  <span
                    className={`size-4 rounded-sm ring-1 flex items-center justify-center transition-colors ${
                      isChecked
                        ? "bg-[color:var(--cf-orange)] ring-[color:var(--cf-orange)]"
                        : "bg-transparent ring-[color:var(--cf-line-strong)]"
                    }`}
                  >
                    {isChecked && (
                      <svg
                        viewBox="0 0 12 12"
                        className="size-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2.5 6.5l2.5 2.5L9.5 3.5" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[color:var(--cf-ink)]">{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {currentField.type === "RATING" && (
          <div className="flex items-center justify-center gap-1.5">
            {Array.from({
              length: (currentField.options as any)?.max || 5,
            }).map((_, i) => {
              const score = i + 1;
              const isStarred = (answers[currentField.id] || 0) >= score;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleFieldChange(currentField.id, score)}
                  className="p-1.5 hover:scale-110 transition-transform cursor-pointer"
                  aria-label={`Rate ${score}`}
                >
                  <Star
                    className={`size-9 ${
                      isStarred
                        ? "fill-[color:var(--cf-orange)] text-[color:var(--cf-orange)]"
                        : "text-[color:var(--cf-ink)]/15 fill-current"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        )}

        {currentField.type === "DATE" && (
          <div className="relative max-w-xs mx-auto">
            <input
              type="date"
              min={(currentField.options as any)?.minDate || undefined}
              max={(currentField.options as any)?.maxDate || undefined}
              value={answers[currentField.id] || ""}
              onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
              className={`${INPUT_CLS} pr-12 text-center`}
            />
            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-[color:var(--cf-ink-soft)] pointer-events-none" />
          </div>
        )}

        {currentField.type === "TIME" && (
          <div className="relative max-w-xs mx-auto">
            <input
              type="time"
              min={(currentField.options as any)?.minTime || undefined}
              max={(currentField.options as any)?.maxTime || undefined}
              value={answers[currentField.id] || ""}
              onChange={(e) => handleFieldChange(currentField.id, e.target.value)}
              className={`${INPUT_CLS} pr-12 text-center`}
            />
            <Clock className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-[color:var(--cf-ink-soft)] pointer-events-none" />
          </div>
        )}

        {currentField.type === "TOGGLE" && (
          <div className="flex items-center justify-center gap-5">
            <span
              className={`text-[15px] transition-colors ${
                !answers[currentField.id]
                  ? "text-[color:var(--cf-ink)] font-medium"
                  : "text-[color:var(--cf-ink-soft)]/55"
              }`}
            >
              {(currentField.options as any)?.inactiveLabel || "No"}
            </span>
            <button
              type="button"
              onClick={() => handleFieldChange(currentField.id, !answers[currentField.id])}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none ${
                answers[currentField.id]
                  ? "bg-[color:var(--cf-orange)]"
                  : "bg-[color:var(--cf-ink)]/15"
              }`}
              aria-pressed={!!answers[currentField.id]}
            >
              <span
                className={`pointer-events-none inline-block size-5 mt-1 transform rounded-full bg-white shadow transition-transform ${
                  answers[currentField.id] ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span
              className={`text-[15px] transition-colors ${
                answers[currentField.id]
                  ? "text-[color:var(--cf-orange)] font-medium"
                  : "text-[color:var(--cf-ink-soft)]/55"
              }`}
            >
              {(currentField.options as any)?.activeLabel || "Yes"}
            </span>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex items-center justify-center gap-3 pt-4">
        {currentQuestionIndex > 0 && (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 h-[44px] px-4 text-[13.5px] font-medium rounded-full text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream-2)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={isPending}
          className="group inline-flex items-center gap-1.5 h-[44px] px-6 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-full text-[14px] font-medium tracking-tight transition-colors cursor-pointer"
        >
          {isLast ? (isPending ? "Submitting..." : "Submit") : "Next"}
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>

      {/* enter-to-submit hint */}
      <p className="text-center text-[11px] font-mono text-[color:var(--cf-ink-soft)]/70">
        {isLast ? "Press Submit to send your response" : "Press Next to continue"}
      </p>
    </div>
  );
}
