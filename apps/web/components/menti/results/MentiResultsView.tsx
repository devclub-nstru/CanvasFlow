"use client";

import React from "react";
import { MentiPresentation } from "~/lib/menti";
import { ResultsOverviewSidebar } from "./ResultsOverviewSidebar";
import { Users, Download, BarChart2 } from "lucide-react";

interface Props {
  presentation: MentiPresentation;
}

export function MentiResultsView({ presentation }: Props) {
  return (
    <div className="flex flex-1 overflow-hidden bg-neutral-50/50">
      {/* Left: Feed of Responses per slide (Screenshot 2) */}
      <main className="flex-1 p-8 overflow-y-auto space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">Responses</h2>
          <span className="text-xs font-semibold text-neutral-500">
            {presentation.slides.length} slides total
          </span>
        </div>

        <div className="space-y-6">
          {presentation.slides.map((slide, index) => (
            <div
              key={slide.id}
              className="p-6 bg-white border border-neutral-200 rounded-2xl shadow-sm space-y-4"
            >
              {/* Slide Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center w-6 h-6 text-xs font-bold text-neutral-500 bg-neutral-100 rounded-md">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-bold text-neutral-800">{slide.question}</h3>
                </div>

                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {slide.totalResponses || 0} / {presentation.participantCount}
                  </span>
                  <button className="p-1 text-neutral-400 hover:text-neutral-700" title="Download slide data">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Results Breakdown */}
              <div className="pt-2">
                {slide.type === "BAR_GRAPH" ? (
                  <div className="space-y-2">
                    {slide.options.map((opt) => (
                      <div key={opt.id} className="flex items-center justify-between text-xs font-medium">
                        <span className="text-neutral-700">{opt.label}</span>
                        <span className="font-bold text-neutral-900">{opt.voteCount || 0} votes</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slide.options.map((opt, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-200 rounded-lg"
                      >
                        {opt.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Right Overview Sidebar */}
      <ResultsOverviewSidebar presentation={presentation} />
    </div>
  );
}
