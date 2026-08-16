"use client";

import React, { useState } from "react";
import { MentiSlide } from "~/lib/menti";
import { CheckCircle2, Check } from "lucide-react";

interface Props {
  slide: MentiSlide;
  onSubmit: (val: string | string[]) => void;
  hasSubmitted?: boolean;
}

export function BarGraphAudience({ slide, onSubmit, hasSubmitted }: Props) {
  const isMulti = slide.responseSettings.multipleSelection ?? false;
  const options = slide.options || [];

  // State for single select
  const [singleSelected, setSingleSelected] = useState<string | null>(null);

  // State for multi select
  const [multiSelected, setMultiSelected] = useState<string[]>([]);

  const toggleMulti = (id: string) => {
    if (multiSelected.includes(id)) {
      setMultiSelected(multiSelected.filter((item) => item !== id));
    } else {
      setMultiSelected([...multiSelected, id]);
    }
  };

  if (hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <CheckCircle2 className="w-12 h-12 mb-3 text-green-600 animate-bounce" />
        <h3 className="text-xl font-bold text-neutral-900">Vote Cast!</h3>
        <p className="mt-1 text-sm text-neutral-500">Look at the big screen to see the live results.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold leading-snug text-neutral-900">{slide.question}</h2>
        <p className="text-xs text-neutral-500">
          {isMulti ? "Select all options that apply" : "Select one option"}
        </p>
      </div>

      <div className="space-y-2.5">
        {options.map((opt) => {
          const isChosen = isMulti
            ? multiSelected.includes(opt.id)
            : singleSelected === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                if (isMulti) {
                  toggleMulti(opt.id);
                } else {
                  setSingleSelected(opt.id);
                }
              }}
              className={`w-full p-4 text-left font-semibold text-sm md:text-base border-2 transition-all flex items-center justify-between ${
                isMulti ? "rounded-xl" : "rounded-xl"
              } ${
                isChosen
                  ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm"
                  : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300"
              }`}
            >
              <span>{opt.label}</span>

              {/* Indicator (Circle for Single / Square for Multi) */}
              {isMulti ? (
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                    isChosen ? "border-blue-600 bg-blue-600" : "border-neutral-300"
                  }`}
                >
                  {isChosen && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </div>
              ) : (
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isChosen ? "border-blue-600 bg-blue-600" : "border-neutral-300"
                  }`}
                >
                  {isChosen && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={isMulti ? multiSelected.length === 0 : !singleSelected}
        onClick={() => {
          if (isMulti) {
            if (multiSelected.length > 0) onSubmit(multiSelected);
          } else {
            if (singleSelected) onSubmit(singleSelected);
          }
        }}
        className="flex items-center justify-center w-full py-3.5 px-4 font-semibold text-white transition-all bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-md"
      >
        Submit Vote {isMulti && multiSelected.length > 0 ? `(${multiSelected.length})` : ""}
      </button>
    </div>
  );
}
