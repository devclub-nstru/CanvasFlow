"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Eye,
  Loader2,
} from "lucide-react";
import { MentiPresentation } from "~/lib/menti";
import { useCreateSession } from "~/hooks/api/menti/useCreateSession";

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
  const router = useRouter();
  const { createSession, isLoading: isStartingSession } = useCreateSession();

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

  const handleStartPresentation = async () => {
    try {
      const sessionData = await createSession(presentation.id);
      const sessionId = sessionData.session.id || sessionData.session._id;
      router.push(`/menti/${presentation.id}/present?sessionId=${sessionId}`);
    } catch (err) {
      console.error("Failed to start presentation session:", err);
      // Fallback navigation if session creation errors out
      router.push(`/menti/${presentation.id}/present`);
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
            href="/dashboard/menti"
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
              {(() => {
                const answerable = (presentation.slides || []).filter((s) => s.type !== "CONTENT");
                const maxQ = Math.max(
                  0,
                  ...answerable.map((s) =>
                    typeof s.totalResponses === "number" && s.totalResponses > 0
                      ? s.totalResponses
                      : (s.options || []).reduce((sum, opt) => sum + (opt.voteCount || 0), 0)
                  )
                );
                return Math.max(presentation.participantCount || 0, maxQ);
              })()}
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
          <button
            type="button"
            onClick={handleStartPresentation}
            disabled={isStartingSession}
            className="cf-btn cf-raised cf-press px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 rounded-(--hex-radius) disabled:opacity-50"
          >
            {isStartingSession ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white" />
            )}
            Start presentation
          </button>
        </div>
      </div>
    </header>
  );
}
