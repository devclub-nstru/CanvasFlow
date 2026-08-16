"use client";

import React from "react";
import {
  MentiSlide,
  MentiQuestionType,
  MentiVisualizationType,
} from "~/lib/menti";
import { SlideQuestionEditor } from "../questions/registry";
import {
  BarChart2,
  PieChart,
  Grid,
  ChevronDown,
  Image,
  Palette,
  X,
  Sliders,
} from "lucide-react";

interface Props {
  slide: MentiSlide;
  onChange: (updated: Partial<MentiSlide>) => void;
  onOpenTypePicker: () => void;
}

const QUESTION_TYPE_LABELS: Record<MentiQuestionType, string> = {
  BAR_GRAPH: "Multiple Choice / Bar Graph",
  WORD_CLOUD: "Word Cloud (Text)",
  SCALES: "Scales / Rating",
};

export function SlideInspectorPanel({ slide, onChange, onOpenTypePicker }: Props) {
  return (
    <aside className="flex h-[calc(100vh-3.5rem)] select-none">
      {/* Main Inspector Form */}
      <div className="w-80 bg-white border-l border-neutral-200 p-4 overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            Edit Slide
          </h2>
          <button className="text-neutral-400 hover:text-neutral-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Question Type Selector */}
        <div>
          <label className="block mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Slide Type
          </label>
          <button
            type="button"
            onClick={onOpenTypePicker}
            className="w-full flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg hover:border-neutral-300 text-left transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 bg-blue-100 text-blue-700 rounded">
                <BarChart2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-neutral-800">
                {QUESTION_TYPE_LABELS[slide.type]}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {/* 2. Visualization Type (if Bar Graph) */}
        {slide.type === "BAR_GRAPH" && (
          <div>
            <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Visualization Layout
            </label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-neutral-100 rounded-lg">
              {(["BAR", "DONUT", "PIE", "BUBBLES"] as MentiVisualizationType[]).map((vType) => (
                <button
                  key={vType}
                  type="button"
                  onClick={() => onChange({ visualizationType: vType })}
                  className={`py-1.5 flex justify-center items-center rounded-md transition-all ${
                    (slide.visualizationType || "BAR") === vType
                      ? "bg-white shadow-sm text-blue-600 font-bold"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                  title={vType}
                >
                  {vType === "BAR" && <BarChart2 className="w-4 h-4" />}
                  {vType === "DONUT" && <PieChart className="w-4 h-4" />}
                  {vType === "PIE" && <PieChart className="w-4 h-4" />}
                  {vType === "BUBBLES" && <Grid className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Question-Specific Controls (Delegated to Friend's Editor Components) */}
        <div className="pt-2 border-t border-neutral-100">
          <SlideQuestionEditor slide={slide} onChange={onChange} />
        </div>

        {/* 4. Design & Theme Settings */}
        <div className="pt-4 border-t border-neutral-100 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">Design</h3>

          <div className="space-y-2">
            <button
              type="button"
              className="w-full flex items-center justify-between py-1.5 px-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 rounded"
            >
              <div className="flex items-center gap-2">
                <Image className="w-3.5 h-3.5 text-neutral-400" />
                <span>Background Image</span>
              </div>
              <span className="text-blue-600 font-bold">+</span>
            </button>

            <button
              type="button"
              className="w-full flex items-center justify-between py-1.5 px-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 rounded"
            >
              <div className="flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-neutral-400" />
                <span>Color Theme</span>
              </div>
              <div className="w-3.5 h-3.5 bg-blue-600 rounded-full border border-neutral-200" />
            </button>
          </div>
        </div>

        {/* 5. Joining Information Switch */}
        <div className="pt-4 border-t border-neutral-100">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs font-medium text-neutral-700">Show joining information</span>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 text-blue-600 rounded border-neutral-300 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>
    </aside>
  );
}
