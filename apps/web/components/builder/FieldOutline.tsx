"use client";

import React from "react";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { getFieldIcon } from "./FormFieldNode";

interface FieldLike {
  id: string;
  type: string;
  label: string;
  isRequired: boolean;
}

interface FieldOutlineProps {
  fields: FieldLike[];
  onTapField: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  /** Which field the details pane is currently showing, if any. */
  selectedId?: string | null;
  /**
   * Add affordance. Omitted on surfaces that already have a field palette
   * beside the outline — a second "Add field" button next to a full palette
   * is just a slower way to do the same thing.
   */
  onAdd?: () => void;
}

/**
 * Ordered outline of a form's fields: what the sequence is, and how to
 * change it. Reordering is done with up/down buttons rather than drag, which
 * works the same under a mouse and under a thumb, and doesn't fight vertical
 * scrolling on a phone.
 *
 * Used by two surfaces, hence the neutral name: the phone editor (where
 * tapping a card opens a bottom sheet) and the desktop outline builder (where
 * it sits between the palette and the details pane, and tapping a card just
 * selects it).
 */
export function FieldOutline({ fields, onTapField, onMove, selectedId, onAdd }: FieldOutlineProps) {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="cf-pane-bar">
        <div className="flex min-w-0 items-center gap-2">
          <span className="cf-meta">Arrangement</span>
          <span className="font-mono text-[10px] tracking-wider text-[color:var(--cf-ink-soft)]">
            {fields.length} {fields.length === 1 ? "field" : "fields"}
          </span>
        </div>
      </div>

      {/* Capped and centred: on a wide screen the middle pane runs past 900px,
          and a card stretched that far leaves its label and its edit
          affordance at opposite ends of the row. The cap never binds on a
          phone. Bottom padding clears the sticky CTA where there is one. */}
      <div
        className={`mx-auto w-full max-w-[760px] flex-1 space-y-3 overflow-y-auto px-4 pt-4 ${
          onAdd ? "pb-28" : "pb-6"
        }`}
      >
        {fields.length === 0 ? (
          <EmptyState onAdd={onAdd} />
        ) : (
          fields.map((field, idx) => (
            <FieldCard
              key={field.id}
              field={field}
              position={idx + 1}
              isFirst={idx === 0}
              isLast={idx === fields.length - 1}
              selected={selectedId === field.id}
              onTap={() => onTapField(field.id)}
              onMove={(direction) => onMove(field.id, direction)}
            />
          ))
        )}
      </div>

      {onAdd && fields.length > 0 && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[color:var(--cf-cream)] via-[color:var(--cf-cream)]/95 to-[color:var(--cf-cream)]/0 px-4 pt-6 pb-5">
          <button
            onClick={onAdd}
            className="cf-btn cf-raised cf-press pointer-events-auto h-[48px] w-full text-[14px]"
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
  position,
  isFirst,
  isLast,
  selected,
  onTap,
  onMove,
}: {
  field: FieldLike;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  selected: boolean;
  onTap: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const Icon = getFieldIcon(field.type);
  const displayLabel = field.label || `Untitled ${field.type.replace("_", " ").toLowerCase()}`;

  return (
    /* Selected cards re-ink their edge rather than thicken it, the same way
       canvas nodes do, so selecting one doesn't nudge the list. */
    <div
      className={`overflow-hidden border-2 bg-[color:var(--cf-cream-2)] transition-shadow ${
        selected
          ? "border-[color:var(--cf-orange)] shadow-[4px_4px_0_0_var(--cf-orange)]"
          : "border-[color:var(--cf-line-strong)]"
      }`}
    >
      <button
        type="button"
        onClick={onTap}
        aria-current={selected ? "true" : undefined}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-[color:var(--cf-cream)]"
      >
        {/* Position in the sequence — the thing this surface exists to show. */}
        <span
          className="flex size-9 shrink-0 items-center justify-center border font-mono text-[12px] font-bold"
          style={{
            borderColor: selected ? "var(--cf-orange)" : "var(--cf-line-strong)",
            color: selected ? "var(--cf-orange)" : "var(--cf-ink)",
            background: "var(--cf-cream)",
          }}
        >
          {position}
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="cf-meta inline-flex items-center gap-1.5">
              <Icon className="size-3 text-[color:var(--cf-orange)]" />
              {field.type.replace("_", " ")}
            </span>
            {field.isRequired && (
              <span
                className="inline-flex items-center border px-1.5 py-0.5 font-mono text-[9px] tracking-wider uppercase"
                style={{ borderColor: "var(--cf-orange)", color: "var(--cf-orange)" }}
              >
                Required
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-[14px] leading-tight font-medium text-[color:var(--cf-ink)]">
            {displayLabel}
          </p>
        </div>

        <Pencil className="mt-1 size-3.5 shrink-0 text-[color:var(--cf-ink-soft)]" />
      </button>

      <div className="flex items-center justify-between border-t border-[color:var(--cf-line)] bg-[color:var(--cf-cream-2)] px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove("up");
            }}
            disabled={isFirst}
            className="flex size-8 cursor-pointer items-center justify-center border border-[color:var(--cf-line-strong)] bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream-2)] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Move ${displayLabel} up`}
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
            className="flex size-8 cursor-pointer items-center justify-center border border-[color:var(--cf-line-strong)] bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream-2)] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Move ${displayLabel} down`}
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onTap}
          className="cursor-pointer px-2 py-1 text-[12px] font-medium text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-orange)]"
        >
          Edit →
        </button>
      </div>
    </div>
  );
}

/* ─── empty state ────────────────────────────────────────────────────── */

function EmptyState({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="mt-6 space-y-4 border border-dashed border-[color:var(--cf-line-strong)] bg-[color:var(--cf-cream-2)] p-8 text-center">
      <p className="cf-meta">No fields yet</p>
      <h3 className="cf-display text-[24px] leading-tight">Add your first field</h3>
      <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-[color:var(--cf-ink-soft)]">
        {onAdd
          ? "Build your form one question at a time. Pick a field type to start."
          : "Build your form one question at a time. Choose a field type from the palette on the left."}
      </p>
      {onAdd && (
        <button onClick={onAdd} className="cf-btn cf-raised cf-press h-[44px] px-5 text-[13.5px]">
          <Plus className="size-4" />
          Add field
        </button>
      )}
    </div>
  );
}
