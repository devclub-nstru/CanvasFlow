"use client";

import React from "react";
import { ChevronDown, ChevronUp, Layers, Plus, Trash2 } from "lucide-react";

export interface SegmentLike {
  id: string;
  title: string;
  description?: string | null;
  index: string | number;
  _isNew?: boolean;
}

interface SegmentPanelProps {
  segments: SegmentLike[];
  /** How many questions sit in each segment, keyed by segment id. */
  questionCounts: Record<string, number>;
  /** Questions not yet filed under any segment. Only non-zero on forms that
   *  have never been segmented. */
  unassignedCount: number;
  selectedSegmentId: string | null;
  onSelectSegment: (id: string | null) => void;
  onAddSegment: () => void;
  onRenameSegment: (id: string, title: string) => void;
  onMoveSegment: (id: string, direction: "up" | "down") => void;
  onDeleteSegment: (id: string) => void;
}

/**
 * Segment list for the builder — the form's pages, in order.
 *
 * Selecting a segment filters the canvas/outline to its questions, which is
 * what makes segments usable at all: a twenty-question form spread over four
 * pages is unreadable as one flat canvas.
 *
 * Reordering uses up/down buttons rather than drag, matching `FieldOutline`.
 * Segment order decides which page follows which, so it needs to be
 * adjustable without the precision a drag target demands.
 */
export function SegmentPanel({
  segments,
  questionCounts,
  unassignedCount,
  selectedSegmentId,
  onSelectSegment,
  onAddSegment,
  onRenameSegment,
  onMoveSegment,
  onDeleteSegment,
}: SegmentPanelProps) {
  const totalQuestions =
    unassignedCount + segments.reduce((sum, s) => sum + (questionCounts[s.id] ?? 0), 0);

  return (
    <div className="flex flex-col border-b" style={{ borderBottomColor: "var(--cf-line-strong)" }}>
      <div className="cf-pane-bar">
        <div className="flex min-w-0 items-center gap-2">
          <Layers className="size-3.5 text-(--cf-orange)" />
          <span className="cf-meta">Segments</span>
          <span className="font-mono text-[10px] tracking-wider text-(--cf-ink-soft)">
            {segments.length || "none"}
          </span>
        </div>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto px-3 py-3">
        {/* "All questions" resets the filter. Shown only when there's a
            filter to reset, so an unsegmented form gains no extra chrome. */}
        {segments.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectSegment(null)}
            className={`flex w-full items-center justify-between border px-3 py-2 text-left text-[12.5px] transition-colors ${
              selectedSegmentId === null
                ? "border-(--cf-orange) bg-(--cf-cream-2)"
                : "border-(--cf-line-strong) bg-(--cf-cream) hover:bg-(--cf-cream-2)"
            }`}
          >
            <span className="font-medium">All questions</span>
            <span className="font-mono text-[10px] text-(--cf-ink-soft)">{totalQuestions}</span>
          </button>
        )}

        {unassignedCount > 0 && segments.length > 0 && (
          <div
            className="border border-dashed px-3 py-2 text-[12px] text-(--cf-ink-soft)"
            style={{ borderColor: "var(--cf-line-strong)" }}
          >
            {unassignedCount} question{unassignedCount === 1 ? "" : "s"} not in a segment — they
            come first.
          </div>
        )}

        {segments.length === 0 ? (
          <p className="px-1 py-2 text-[12.5px] leading-relaxed text-(--cf-ink-soft)">
            This form is one continuous list. Add a segment to split it into pages and to branch
            between them.
          </p>
        ) : (
          segments.map((segment, idx) => (
            <SegmentRow
              key={segment.id}
              segment={segment}
              position={idx + 1}
              questionCount={questionCounts[segment.id] ?? 0}
              isFirst={idx === 0}
              isLast={idx === segments.length - 1}
              selected={selectedSegmentId === segment.id}
              onSelect={() => onSelectSegment(segment.id)}
              onRename={(title) => onRenameSegment(segment.id, title)}
              onMove={(direction) => onMoveSegment(segment.id, direction)}
              onDelete={() => onDeleteSegment(segment.id)}
            />
          ))
        )}

        <button
          type="button"
          onClick={onAddSegment}
          className="cf-btn cf-press h-9 w-full text-[12.5px]"
        >
          <Plus className="size-3.5" />
          {segments.length === 0 ? "Split into segments" : "Add segment"}
        </button>
      </div>
    </div>
  );
}

function SegmentRow({
  segment,
  position,
  questionCount,
  isFirst,
  isLast,
  selected,
  onSelect,
  onRename,
  onMove,
  onDelete,
}: {
  segment: SegmentLike;
  position: number;
  questionCount: number;
  isFirst: boolean;
  isLast: boolean;
  selected: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}) {
  return (
    /* The card is the click target, not a control inside it.
     *
     * Selection used to hang off two things only: the 28px number badge, and
     * focusing the rename input. Clicking the card anywhere else — its body,
     * the padding around the title, the row with the question count — did
     * nothing, which reads as a broken segment list rather than as a small hit
     * area. `onMouseDown` on the wrapper catches all of it, and runs before
     * focus moves so clicking straight into the rename field selects the
     * segment first.
     *
     * The buttons and the input stop propagation instead of relying on the
     * wrapper ignoring them: reordering segment 2 while viewing segment 1
     * shouldn't quietly change what the canvas is showing. */
    <div
      onMouseDown={onSelect}
      className={`cursor-pointer border-2 bg-(--cf-cream-2) transition-shadow ${
        selected
          ? "border-(--cf-orange) shadow-[3px_3px_0_0_var(--cf-orange)]"
          : "border-(--cf-line-strong) hover:border-(--cf-ink)"
      }`}
    >
      <div className="flex items-center gap-2 p-2">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center border font-mono text-[11px] font-bold"
          style={{
            borderColor: selected ? "var(--cf-orange)" : "var(--cf-line-strong)",
            color: selected ? "var(--cf-orange)" : "var(--cf-ink)",
            background: "var(--cf-cream)",
          }}
        >
          {position}
        </span>

        {/* Rename in place. A separate dialog for one text field is more
            clicks than the edit is worth. */}
        <input
          value={segment.title}
          onChange={(e) => onRename(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder={`Segment ${position}`}
          aria-label={`Segment ${position} title`}
          className="cf-input h-8 min-w-0 flex-1 px-2 text-[12.5px]"
        />
      </div>

      <div
        className="flex items-center justify-between border-t px-2 py-1.5"
        style={{ borderTopColor: "var(--cf-line)" }}
      >
        {/* Announces the filter state, which the border alone can't convey to
            a screen reader. */}
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="cursor-pointer font-mono text-[10px] tracking-wider text-(--cf-ink-soft) hover:text-(--cf-ink)"
        >
          {selected ? "viewing · " : ""}
          {questionCount} {questionCount === 1 ? "question" : "questions"}
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onMove("up")}
            disabled={isFirst}
            className="flex size-7 cursor-pointer items-center justify-center border border-(--cf-line-strong) bg-(--cf-cream) hover:bg-(--cf-cream-2) disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Move ${segment.title} up`}
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onMove("down")}
            disabled={isLast}
            className="flex size-7 cursor-pointer items-center justify-center border border-(--cf-line-strong) bg-(--cf-cream) hover:bg-(--cf-cream-2) disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Move ${segment.title} down`}
          >
            <ChevronDown className="size-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onDelete}
            className="flex size-7 cursor-pointer items-center justify-center border border-(--cf-line-strong) bg-(--cf-cream) text-(--cf-ink-soft) hover:border-red-500 hover:text-red-600"
            aria-label={`Delete ${segment.title}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
