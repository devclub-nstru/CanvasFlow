"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";
import { AVAILABLE_FIELDS } from "./FormFieldNode";

interface FieldSidebarProps {
  onDragStart: (event: React.DragEvent, type: string) => void;
}

const CATEGORIES = [
  { label: "Text", types: ["TEXT", "TEXTAREA", "EMAIL", "PHONE", "URL"] },
  { label: "Numbers", types: ["NUMBER"] },
  { label: "Choice", types: ["SELECT", "CHECKBOX"] },
  { label: "Interactive", types: ["RATING", "TOGGLE"] },
  { label: "Date & time", types: ["DATE", "TIME"] },
];

export function FieldSidebar({ onDragStart }: FieldSidebarProps) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? AVAILABLE_FIELDS.filter(
        (f) =>
          f.label.toLowerCase().includes(query.toLowerCase()) ||
          f.description.toLowerCase().includes(query.toLowerCase()),
      )
    : null;

  return (
    <aside className="w-64 bg-[color:var(--cf-cream-2)] border-r border-[color:var(--cf-line)] flex flex-col shrink-0">
      {/* header */}
      <div className="px-4 pt-4 pb-3 border-b border-[color:var(--cf-line)] space-y-2.5">
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Fields</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[color:var(--cf-ink-soft)]/60 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-2 h-[34px] text-[12px] bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] focus:ring-2 focus:ring-[color:var(--cf-orange)] focus:outline-none rounded-md text-[color:var(--cf-ink)] placeholder:text-[color:var(--cf-ink-soft)]/55 transition-shadow"
          />
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
        {filtered ? (
          filtered.length > 0 ? (
            <div className="space-y-1">
              {filtered.map((f) => (
                <FieldItem key={f.type} field={f} onDragStart={onDragStart} />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[color:var(--cf-ink-soft)] text-center py-6">
              No fields match &ldquo;{query}&rdquo;
            </p>
          )
        ) : (
          CATEGORIES.map((cat) => {
            const catFields = AVAILABLE_FIELDS.filter((f) => cat.types.includes(f.type));
            if (catFields.length === 0) return null;
            return (
              <div key={cat.label}>
                <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]/70 px-2 mb-1.5">
                  {cat.label}
                </p>
                <div className="space-y-0.5">
                  {catFields.map((f) => (
                    <FieldItem key={f.type} field={f} onDragStart={onDragStart} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* footer hint */}
      <div className="px-4 py-2.5 border-t border-[color:var(--cf-line)]">
        <p className="text-[11px] font-mono text-[color:var(--cf-ink-soft)]/70 text-center">
          Drag to canvas
        </p>
      </div>
    </aside>
  );
}

function FieldItem({
  field,
  onDragStart,
}: {
  field: (typeof AVAILABLE_FIELDS)[number];
  onDragStart: (e: React.DragEvent, type: string) => void;
}) {
  const Icon = field.icon;
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, field.type)}
      className="flex items-center gap-3 px-2.5 py-2 rounded-md cursor-grab active:cursor-grabbing select-none group hover:bg-[color:var(--cf-cream)] hover:ring-1 hover:ring-[color:var(--cf-line-strong)] transition-all"
    >
      <div className="shrink-0 size-7 rounded-md bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] group-hover:ring-[color:var(--cf-orange)]/40 flex items-center justify-center transition-colors">
        <Icon className="size-3.5 text-[color:var(--cf-orange)]" />
      </div>
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-[color:var(--cf-ink)] leading-tight truncate">
          {field.label}
        </p>
        <p className="text-[11px] text-[color:var(--cf-ink-soft)] truncate mt-0.5">
          {field.description}
        </p>
      </div>
    </div>
  );
}
