"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";
import { AVAILABLE_FIELDS } from "./FormFieldNode";

interface FieldSidebarProps {
  onDragStart: (event: React.DragEvent, type: string) => void;
  onPick?: (type: string) => void;
}

const CATEGORIES = [
  { label: "Text", types: ["TEXT", "TEXTAREA", "EMAIL", "PHONE", "URL"] },
  { label: "Numbers", types: ["NUMBER"] },
  { label: "Choice", types: ["SELECT", "CHECKBOX"] },
  { label: "Interactive", types: ["RATING", "TOGGLE"] },
  { label: "Date & time", types: ["DATE", "TIME"] },
  { label: "Files", types: ["FILE_UPLOAD"] },
];

export function FieldSidebar({ onDragStart, onPick }: FieldSidebarProps) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? AVAILABLE_FIELDS.filter(
        (f) =>
          f.label.toLowerCase().includes(query.toLowerCase()) ||
          f.description.toLowerCase().includes(query.toLowerCase()),
      )
    : null;

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r bg-(--cf-cream-2)"
      style={{ borderRightColor: "var(--cf-line-strong)" }}
    >
      <div className="cf-pane-bar">
        <p className="cf-meta">Fields</p>
        {filtered && (
          <span className="font-mono text-[10px] tracking-wider text-(--cf-ink-soft)">
            {filtered.length} of {AVAILABLE_FIELDS.length}
          </span>
        )}
      </div>

      {/* search band */}
      <div
        className="shrink-0 border-b px-3 py-2.5"
        style={{ borderBottomColor: "var(--cf-line-strong)" }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-(--cf-ink-soft)" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fields..."
            className="cf-input h-8 pr-2 pl-8 text-[12px]"
          />
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
        {filtered ? (
          filtered.length > 0 ? (
            <div className="space-y-1">
              {filtered.map((f) => (
                <FieldItem key={f.type} field={f} onDragStart={onDragStart} onPick={onPick} />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-(--cf-ink-soft) text-center py-6">
              No fields match &ldquo;{query}&rdquo;
            </p>
          )
        ) : (
          CATEGORIES.map((cat) => {
            const catFields = AVAILABLE_FIELDS.filter((f) => cat.types.includes(f.type));
            if (catFields.length === 0) return null;
            return (
              <div key={cat.label}>
                <p className="cf-meta mb-1.5 px-2">{cat.label}</p>
                <div className="space-y-1">
                  {catFields.map((f) => (
                    <FieldItem key={f.type} field={f} onDragStart={onDragStart} onPick={onPick} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* footer hint */}
      <div className="border-t px-4 py-2.5" style={{ borderTopColor: "var(--cf-line-strong)" }}>
        <p className="text-[11px] font-mono text-(--cf-ink-soft)/70 text-center">
          {onPick ? "Click to add" : "Drag to canvas"}
        </p>
      </div>
    </aside>
  );
}

function FieldItem({
  field,
  onDragStart,
  onPick,
}: {
  field: (typeof AVAILABLE_FIELDS)[number];
  onDragStart: (e: React.DragEvent, type: string) => void;
  onPick?: (type: string) => void;
}) {
  const Icon = field.icon;

  const Tag = onPick ? "button" : "div";

  return (
    <Tag
      {...(onPick ? ({ type: "button", onClick: () => onPick(field.type) } as const) : {})}
      draggable
      onDragStart={(e: React.DragEvent) => onDragStart(e, field.type)}
      className={`group flex w-full items-center gap-3 border border-(--cf-line) bg-(--cf-cream) px-2.5 py-2 text-left transition-colors select-none hover:border-(--cf-line-strong) hover:bg-white ${
        onPick ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="flex size-7 shrink-0 items-center justify-center border border-(--cf-line) bg-(--cf-cream) transition-colors group-hover:border-(--cf-orange)">
        <Icon className="size-3.5 text-(--cf-orange)" />
      </div>
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-(--cf-ink) leading-tight truncate">
          {field.label}
        </p>
        <p className="text-[11px] text-(--cf-ink-soft) truncate mt-0.5">{field.description}</p>
      </div>
    </Tag>
  );
}
