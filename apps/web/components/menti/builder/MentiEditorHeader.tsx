"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Eye,
} from "lucide-react";
import { MentiPresentation } from "~/lib/menti";

interface Props {
  presentation: MentiPresentation;
  activeTab: "create" | "results";
  onTabChange: (tab: "create" | "results") => void;
  onTitleChange: (title: string) => void;
  onOpenSettings?: () => void;
  onOpenShare?: () => void;
}

export function MentiEditorHeader({
  presentation,
  activeTab,
  onTabChange,
  onTitleChange,
  onOpenSettings,
  onOpenShare,
}: Props) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(presentation.title);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onTitleChange(titleInput.trim());
    } else {
      setTitleInput(presentation.title);
    }
  };

  return (
    <header className="flex flex-col w-full select-none z-30 border-b border-(--cf-line-strong) bg-(--cf-cream-2)">
      {/* Main Builder Navigation Bar */}
      <div className="flex items-center justify-between h-14 px-3 sm:px-5">
        {/* Left: Navigation & Presentation Title */}
        <div className="flex items-center gap-3">
          {/* Back button */}
          <Link
            href="/dashboard"
            className="cf-btn-outline size-8 flex items-center justify-center p-0 rounded-(--hex-radius)"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="w-px h-5 bg-(--cf-line-strong)" />

          {/* Inline Editable Title + Breadcrumb */}
          <div className="flex flex-col justify-center">
            {isEditingTitle ? (
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSubmit();
                  if (e.key === "Escape") {
                    setTitleInput(presentation.title);
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                className="cf-input px-2 py-0.5 text-xs font-bold leading-tight max-w-[240px]"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingTitle(true)}
                className="text-left font-semibold text-[13px] text-(--cf-ink) hover:underline truncate max-w-[240px]"
                title="Click to edit title"
              >
                {presentation.title || "Untitled presentation"}
              </button>
            )}
          </div>
        </div>

        {/* Center: Tabs (Create / Results) */}
        <nav className="flex items-center gap-8 self-end" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "create"}
            onClick={() => onTabChange("create")}
            className="cf-tab text-xs font-semibold pb-2.5"
          >
            Create
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "results"}
            onClick={() => onTabChange("results")}
            className="cf-tab text-xs font-semibold pb-2.5 flex items-center gap-1.5"
          >
            Results
            <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-(--cf-cream) border border-(--cf-line) rounded-full text-(--cf-ink-soft)">
              {presentation.slides.reduce((acc, s) => acc + (s.totalResponses || 0), 0)}
            </span>
          </button>
        </nav>

        {/* Right: Preview + Start Presentation */}
        <div className="flex items-center gap-2.5">
          {/* Preview Button */}
          <Link
            href={`/menti/${presentation.id}/present`}
            className="cf-btn-outline px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 rounded-(--hex-radius)"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </Link>

          {/* Start Presentation Button */}
          <Link
            href={`/menti/${presentation.id}/present`}
            className="cf-btn cf-raised cf-press px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 rounded-(--hex-radius)"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Start presentation
          </Link>
        </div>
      </div>
    </header>
  );
}
