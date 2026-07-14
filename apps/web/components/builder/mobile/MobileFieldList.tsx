"use client";

import React from "react";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { getFieldIcon } from "../FormFieldNode";

interface FieldLike {
  id: string;
  type: string;
  label: string;
  isRequired: boolean;
}

interface MobileFieldListProps {
  fields: FieldLike[];
  onTapField: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onAdd: () => void;
}

/**
 * Mobile list view for the form builder. Each field is a tappable card
 * that opens the edit sheet; reorder is done with up/down arrows since
 * touch drag-and-drop fights vertical scrolling on phones.
 */
export function MobileFieldList({ fields, onTapField, onMove, onAdd }: MobileFieldListProps) {
  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* count bar */}
      <div className="px-4 py-3 border-b border-[color:var(--cf-line)] bg-[color:var(--cf-cream-2)] flex items-center justify-between shrink-0">
        <div>
          <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Fields</p>
          <p className="text-[12px] font-mono text-[color:var(--cf-ink-soft)] mt-0.5">
            {fields.length} {fields.length === 1 ? "field" : "fields"} · tap to edit
          </p>
        </div>
      </div>

      {/* list — leave bottom padding so the sticky CTA doesn't cover the last card */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 space-y-3">
        {fields.length === 0 ? (
          <EmptyState onAdd={onAdd} />
        ) : (
          fields.map((field, idx) => (
            <FieldCard
              key={field.id}
              field={field}
              isFirst={idx === 0}
              isLast={idx === fields.length - 1}
              onTap={() => onTapField(field.id)}
              onMove={(direction) => onMove(field.id, direction)}
            />
          ))
        )}
      </div>

      {/* sticky add bar */}
      {fields.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 pt-6 bg-gradient-to-t from-[color:var(--cf-cream)] via-[color:var(--cf-cream)]/95 to-[color:var(--cf-cream)]/0 pointer-events-none">
          <button
            onClick={onAdd}
            className="pointer-events-auto w-full inline-flex items-center justify-center gap-1.5 h-[48px] bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] active:bg-[color:var(--cf-orange-hover)] text-white rounded-full text-[14px] font-medium tracking-tight transition-colors shadow-[0_10px_30px_-12px_rgba(246,111,0,0.5)]"
          >
            <Plus className="size-4" />
            Add field
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── field card ─────────────────────────────────────────────────────── */

function FieldCard({
  field,
  isFirst,
  isLast,
  onTap,
  onMove,
}: {
  field: FieldLike;
  isFirst: boolean;
  isLast: boolean;
  onTap: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const Icon = getFieldIcon(field.type);
  const displayLabel = field.label || `Untitled ${field.type.replace("_", " ").toLowerCase()}`;

  return (
    <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] active:ring-[color:var(--cf-line-strong)] transition-shadow overflow-hidden">
      <button
        type="button"
        onClick={onTap}
        className="w-full text-left p-4 flex items-start gap-3 active:bg-[color:var(--cf-cream)]/60 transition-colors"
      >
        <div className="size-9 rounded-md bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] flex items-center justify-center shrink-0">
          <Icon className="size-4 text-[color:var(--cf-orange)]" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="cf-eyebrow text-[color:var(--cf-ink-soft)]">
              {field.type.replace("_", " ")}
            </span>
            {field.isRequired && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-[color:var(--cf-orange)]/15 text-[color:var(--cf-orange)] ring-1 ring-[color:var(--cf-orange)]/30">
                Required
              </span>
            )}
          </div>
          <p className="text-[14px] font-medium text-[color:var(--cf-ink)] leading-tight line-clamp-2">
            {displayLabel}
          </p>
        </div>
        <Pencil className="size-3.5 text-[color:var(--cf-ink-soft)]/60 shrink-0 mt-1" />
      </button>

      {/* reorder bar */}
      <div className="px-4 py-2 border-t border-[color:var(--cf-line)] flex items-center justify-between bg-[color:var(--cf-cream-2)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove("up");
            }}
            disabled={isFirst}
            className="size-8 rounded-md ring-1 ring-[color:var(--cf-line)] bg-[color:var(--cf-cream)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-[color:var(--cf-ink)] active:bg-[color:var(--cf-cream-2)]"
            aria-label="Move field up"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove("down");
            }}
            disabled={isLast}
            className="size-8 rounded-md ring-1 ring-[color:var(--cf-line)] bg-[color:var(--cf-cream)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-[color:var(--cf-ink)] active:bg-[color:var(--cf-cream-2)]"
            aria-label="Move field down"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onTap}
          className="text-[12px] font-medium text-[color:var(--cf-ink-soft)] active:text-[color:var(--cf-orange)] px-2 py-1"
        >
          Edit →
        </button>
      </div>
    </div>
  );
}

/* ─── empty state ────────────────────────────────────────────────────── */

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-dashed ring-[color:var(--cf-line-strong)] p-8 text-center space-y-4 mt-6">
      <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Empty canvas</p>
      <h3 className="cf-display text-[24px] leading-tight">Add your first field</h3>
      <p className="text-[13px] text-[color:var(--cf-ink-soft)] leading-relaxed max-w-xs mx-auto">
        Build your form one question at a time. Tap below to pick a field type.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center justify-center gap-1.5 h-[44px] px-5 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white rounded-full text-[13.5px] font-medium tracking-tight transition-colors"
      >
        <Plus className="size-4" />
        Add field
      </button>
    </div>
  );
}
