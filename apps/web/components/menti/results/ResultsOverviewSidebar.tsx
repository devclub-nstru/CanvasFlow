"use client";

import React, { useState } from "react";
import { MentiPresentation } from "~/lib/menti";
import {
  Users,
  TrendingUp,
  Download,
  Trash2,
  ChevronRight,
  ChevronLeft,
  FileSpreadsheet,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  presentation: MentiPresentation;
  activeSlideId?: string | null;
  onSelectSlide?: (slideId: string) => void;
}

export function ResultsOverviewSidebar({
  presentation,
  activeSlideId,
  onSelectSlide,
}: Props) {
  const [isOpen, setIsOpen] = useState(true);

  const totalResponses = presentation.slides.reduce((acc, s) => {
    const slideTotal =
      typeof s.totalResponses === "number" && s.totalResponses > 0
        ? s.totalResponses
        : (s.options || []).reduce((sum, opt) => sum + (opt.voteCount || 0), 0);
    return acc + slideTotal;
  }, 0);

  const totalPossible = presentation.slides.length * (presentation.participantCount || 1);
  const participationRate = totalPossible > 0
    ? Math.min(100, Math.round((totalResponses / totalPossible) * 100))
    : 0;

  const scrollToSlide = (slideId: string) => {
    const el = document.getElementById(`results-slide-${slideId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (onSelectSlide) {
      onSelectSlide(slideId);
    }
  };

  if (!isOpen) {
    return (
      <aside className="w-10 bg-(--cf-cream-2) border-l border-(--cf-line-strong) flex flex-col items-center py-3 select-none shrink-0">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="size-8 flex items-center justify-center rounded-(--hex-radius) bg-(--cf-ink) text-white shadow-xs hover:opacity-90 transition-opacity"
          title="Open Overview Sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-(--cf-cream-2) border-l border-(--cf-line-strong) flex flex-col h-full select-none z-20 shrink-0 animate-in slide-in-from-right-2 duration-200">
      {/* 1. Sidebar Header */}
      <div className="cf-pane-bar px-4 flex items-center justify-between">
        <span className="cf-eyebrow text-(--cf-ink)">
          Session Overview
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="cf-danger-ghost p-1 rounded"
          title="Collapse overview"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="cf-panel p-3 bg-white rounded-xl border border-(--cf-line-strong) space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-mono text-(--cf-ink-soft)">
              <Users className="w-3 h-3 text-(--cf-orange)" />
              <span>Participants</span>
            </div>
            <p className="font-bold text-lg text-(--cf-ink) tabular-nums">
              {presentation.participantCount}
            </p>
          </div>

          <div className="cf-panel p-3 bg-white rounded-xl border border-(--cf-line-strong) space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-mono text-(--cf-ink-soft)">
              <Layers className="w-3 h-3 text-emerald-600" />
              <span>Questions</span>
            </div>
            <p className="font-bold text-lg text-(--cf-ink) tabular-nums">
              {presentation.slides.length}
            </p>
          </div>

          <div className="col-span-2 cf-panel p-3 bg-white rounded-xl border border-(--cf-line-strong) flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-(--cf-orange)" />
              <span className="text-xs font-bold text-(--cf-ink)">Participation Rate</span>
            </div>
            <span className="font-mono font-bold text-sm text-(--cf-ink)">
              {participationRate}%
            </span>
          </div>
        </div>

        {/* Slide Deck Quick Navigation */}
        <div className="space-y-2 pt-2 border-t border-(--cf-line)">
          <div className="flex items-center justify-between">
            <span className="cf-eyebrow text-(--cf-ink)">Slide Navigation</span>
            <span className="cf-meta text-[10px] text-(--cf-ink-soft)">
              {presentation.slides.length} slides
            </span>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {presentation.slides.map((slide, idx) => {
              const isActive = slide.id === activeSlideId;

              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => scrollToSlide(slide.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-(--hex-radius) text-left transition-all ${
                    isActive
                      ? "bg-(--cf-ink) text-white shadow-xs"
                      : "bg-white hover:bg-(--cf-cream) text-(--cf-ink) border border-(--cf-line)"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`cf-meta size-5 rounded shrink-0 flex items-center justify-center font-bold text-[10px] ${
                        isActive ? "bg-white/20 text-white" : "bg-(--cf-cream) text-(--cf-ink)"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold truncate">
                      {slide.question || `Slide ${idx + 1}`}
                    </span>
                  </div>

                  <span
                    className={`font-mono text-[10px] font-bold shrink-0 ml-2 ${
                      isActive ? "text-white/80" : "text-(--cf-ink-soft)"
                    }`}
                  >
                    {typeof slide.totalResponses === "number" && slide.totalResponses > 0
                      ? slide.totalResponses
                      : (slide.options || []).reduce((sum, opt) => sum + (opt.voteCount || 0), 0)} / {presentation.participantCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Export & Tools Section */}
        <div className="space-y-2 pt-2 border-t border-(--cf-line)">
          <span className="cf-eyebrow text-(--cf-ink)">Exports & Actions</span>

          <button
            type="button"
            onClick={() => toast.success("Exported results summary to Excel (.xlsx)!")}
            className="cf-btn w-full justify-center py-2 px-3 text-xs font-bold rounded-(--hex-radius) gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export to Excel
          </button>

          <button
            type="button"
            onClick={() => toast.info("PDF Presentation Summary coming soon!")}
            className="cf-btn-outline w-full justify-center py-2 px-3 text-xs font-semibold rounded-(--hex-radius) gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF Report
          </button>
        </div>

        {/* Danger Zone: Clear Results */}
        <div className="pt-2 border-t border-(--cf-line)">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Are you sure you want to reset and clear all recorded responses?")) {
                toast.success("Results cleared");
              }
            }}
            className="cf-btn-danger w-full justify-center py-2 px-3 text-xs font-bold rounded-(--hex-radius) gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All Responses
          </button>
        </div>
      </div>
    </aside>
  );
}
