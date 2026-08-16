"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, Share2, Play, ChevronDown, Eye } from "lucide-react";
import { MentiPresentation } from "~/lib/menti";

interface Props {
  presentation: MentiPresentation;
  activeTab: "create" | "results";
  onTabChange: (tab: "create" | "results") => void;
  onTitleChange: (title: string) => void;
}

export function MentiEditorHeader({
  presentation,
  activeTab,
  onTabChange,
  onTitleChange,
}: Props) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(presentation.title);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (title.trim()) onTitleChange(title.trim());
  };

  return (
    <header className="flex items-center justify-between h-14 px-4 bg-white border-b border-neutral-200 select-none">
      {/* Left: Back & Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
          title="Back to dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex flex-col">
          {isEditingTitle ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              autoFocus
              className="px-1.5 py-0.5 text-sm font-semibold border rounded border-blue-500 focus:outline-none"
            />
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-semibold text-neutral-900 cursor-pointer hover:bg-neutral-100 px-1.5 py-0.5 rounded transition-colors"
              title="Click to rename"
            >
              {presentation.title || "Untitled presentation"}
            </h1>
          )}
          <span className="text-[10px] text-neutral-400 px-1.5 flex items-center gap-1">
            My Mentis
          </span>
        </div>

        <div className="flex items-center gap-1 ml-2">
          <button className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-md" title="Settings">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded-md" title="Share">
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center: Tabs (Create / Results) */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => onTabChange("create")}
          className={`relative py-4 text-xs font-semibold uppercase tracking-wider transition-colors ${
            activeTab === "create" ? "text-blue-600 font-bold" : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          Create
          {activeTab === "create" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>

        <button
          onClick={() => onTabChange("results")}
          className={`relative py-4 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
            activeTab === "results" ? "text-blue-600 font-bold" : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          Results
          <span className="px-1.5 py-0.2 text-[10px] font-bold text-neutral-600 bg-neutral-100 rounded-full">
            {presentation.participantCount}
          </span>
          {activeTab === "results" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2.5">
        <Link
          href={`/menti/${presentation.id}/live`}
          target="_blank"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          Preview
        </Link>

        <Link
          href={`/menti/${presentation.id}/present`}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          Start presentation
          <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
        </Link>
      </div>
    </header>
  );
}
