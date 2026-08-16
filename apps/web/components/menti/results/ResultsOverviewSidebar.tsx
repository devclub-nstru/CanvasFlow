"use client";

import React from "react";
import { Download, Trash2, FileSpreadsheet, Users, MessageCircle, Star } from "lucide-react";
import { MentiPresentation } from "~/lib/menti";

interface Props {
  presentation: MentiPresentation;
}

export function ResultsOverviewSidebar({ presentation }: Props) {
  return (
    <aside className="w-80 bg-white border-l border-neutral-200 p-5 space-y-6 overflow-y-auto select-none">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-800">Overview</h2>

      {/* Export to Excel card */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
        <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Need data exports?
        </div>
        <p className="text-xs text-emerald-700 leading-relaxed">
          Export all participant answers, vote tallies, and timestamps into CSV / Excel.
        </p>
        <button
          type="button"
          className="w-full py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Export to Excel
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-neutral-700">Total Participants</span>
          </div>
          <span className="text-xs font-bold text-neutral-900">{presentation.participantCount}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-neutral-700">Participation Rate</span>
          </div>
          <span className="text-xs font-bold text-neutral-900">85%</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-semibold text-neutral-700">Q&A Questions</span>
          </div>
          <span className="text-xs font-bold text-neutral-900">0</span>
        </div>
      </div>

      {/* Danger actions */}
      <div className="pt-4 border-t border-neutral-100 space-y-2">
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download All Slides (PDF)
        </button>

        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear All Results
        </button>
      </div>
    </aside>
  );
}
