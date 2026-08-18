"use client";

import React, { useEffect, useState } from "react";
import { MentiOption, MentiSlide } from "~/lib/menti";
import { Send, CheckCircle2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { Reorder, useDragControls } from "motion/react";

interface Props {
  slide: MentiSlide;
  onSubmit: (orderedOptionIds: string[]) => void;
  hasSubmitted?: boolean;
}

/**
 * One draggable row.
 *
 * Dragging is bound to the grip handle only (`dragListener={false}` plus
 * explicit drag controls). With a whole-row listener, taps on the move buttons
 * and vertical page scrolling on touch both register as drags.
 */
function RankRow({
  option,
  position,
  total,
  onMove,
}: {
  option: MentiOption;
  position: number;
  total: number;
  onMove: (from: number, to: number) => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={option}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.03, boxShadow: "0 8px 24px rgb(0 0 0 / 0.16)", zIndex: 10 }}
      className="flex items-center gap-2 rounded-xl border-2 border-(--cf-line-strong) bg-white p-2.5 sm:p-3"
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-(--cf-ink) font-mono text-[11px] font-bold text-white tabular-nums sm:size-7 sm:text-xs">
        {position + 1}
      </span>

      <span className="min-w-0 flex-1 text-xs font-semibold break-words text-(--cf-ink) sm:text-sm">
        {option.label || `Item ${position + 1}`}
      </span>

      {/* Keyboard/tap accessible reordering — also the only option for anyone
          who cannot drag. */}
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          aria-label={`Move ${option.label} up`}
          disabled={position === 0}
          onClick={() => onMove(position, position - 1)}
          className="rounded p-0.5 text-(--cf-ink-soft) transition hover:bg-(--cf-cream) hover:text-(--cf-ink) disabled:opacity-25"
        >
          <ChevronUp className="size-4 stroke-[2.5]" />
        </button>
        <button
          type="button"
          aria-label={`Move ${option.label} down`}
          disabled={position === total - 1}
          onClick={() => onMove(position, position + 1)}
          className="rounded p-0.5 text-(--cf-ink-soft) transition hover:bg-(--cf-cream) hover:text-(--cf-ink) disabled:opacity-25"
        >
          <ChevronDown className="size-4 stroke-[2.5]" />
        </button>
      </div>

      <button
        type="button"
        aria-label={`Drag ${option.label} to reorder`}
        onPointerDown={(event) => controls.start(event)}
        className="shrink-0 cursor-grab rounded p-1 text-(--cf-ink-soft) transition hover:bg-(--cf-cream) hover:text-(--cf-ink) active:cursor-grabbing"
        style={{ touchAction: "none" }}
      >
        <GripVertical className="size-4" />
      </button>
    </Reorder.Item>
  );
}

export function RankingAudience({ slide, onSubmit, hasSubmitted }: Props) {
  const [items, setItems] = useState<MentiOption[]>(slide.options ?? []);
  const [touched, setTouched] = useState(false);

  /*
   * Re-seed when the slide changes, and also when the host edits the item list
   * mid-session — the server rejects any ranking that is not a full permutation
   * of the current options, so a stale local list must not linger.
   */
  useEffect(() => {
    setItems(slide.options ?? []);
    setTouched(false);
  }, [slide.id, slide.options]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setItems(next);
    setTouched(true);
  };

  if (hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center select-none animate-in fade-in zoom-in-95 duration-200">
        <div className="flex size-14 items-center justify-center rounded-full border-2 border-(--cf-line-strong) bg-(--cf-cream) cf-raised">
          <CheckCircle2 className="h-7 w-7 text-(--cf-orange)" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold tracking-[-0.03em] text-(--cf-ink) sm:text-xl">
            Ranking Submitted!
          </h3>
          <p className="mx-auto max-w-xs text-xs leading-relaxed text-(--cf-ink-soft) sm:text-sm">
            Please wait for the presenter to move to the next question…
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (items.length > 0) onSubmit(items.map((item) => item.id));
      }}
      className="flex w-full flex-col space-y-4 select-none"
    >
      <div className="space-y-1">
        <h2 className="text-base font-bold leading-snug tracking-[-0.03em] text-(--cf-ink) sm:text-lg md:text-xl">
          {slide.question || "Rank these in order"}
        </h2>
        <p className="cf-meta text-[11px] text-(--cf-ink-soft)">
          Drag the handle or use the arrows — best at the top
        </p>
      </div>

      <Reorder.Group
        axis="y"
        values={items}
        onReorder={(next) => {
          setItems(next);
          setTouched(true);
        }}
        layoutScroll
        className="max-h-[46vh] space-y-2 overflow-y-auto pr-1 sm:max-h-[50vh]"
      >
        {items.map((option, index) => (
          <RankRow
            key={option.id}
            option={option}
            position={index}
            total={items.length}
            onMove={move}
          />
        ))}
      </Reorder.Group>

      <div className="pt-1">
        <button
          type="submit"
          disabled={items.length === 0}
          className="cf-btn cf-raised cf-press flex min-h-[48px] w-full items-center justify-center gap-2 rounded-(--hex-radius) py-3.5 text-sm font-bold shadow-md disabled:pointer-events-none disabled:opacity-40 sm:py-4 sm:text-base"
        >
          <Send className="mr-1 h-4 w-4" />
          {touched ? "Submit Ranking" : "Submit This Order"}
        </button>
      </div>
    </form>
  );
}
