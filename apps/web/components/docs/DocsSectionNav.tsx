"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * The docs "On this page" index, with the current section highlighted.
 *
 * Position is derived from a scroll listener reading each section's
 * `getBoundingClientRect().top` rather than from IntersectionObserver. The
 * question being answered is "which section am I inside", and an observer
 * answers a different one — "which sections are visible" — which needs extra
 * bookkeeping once two sections share the viewport, or once a section is
 * taller than it. Comparing tops against a single line is both simpler and
 * exact. Reads are throttled to one per frame, so the listener costs a
 * rect-per-section per frame while scrolling and nothing at rest.
 */

type Section = { id: string; title: string };

/**
 * Where the "you are here" line sits, in px from the top of the viewport.
 * Below the 64px sticky navbar and the 96px `scroll-margin-top` that anchor
 * jumps land on, so the section you just jumped to is the one that lights up
 * rather than the one above it.
 */
const ACTIVE_LINE = 140;

export function DocsSectionNav({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const listRef = useRef<HTMLOListElement>(null);

  // Prop identity comes from the RSC payload; key the effect off the ids so it
  // can't re-subscribe on unrelated re-renders.
  const ids = sections.map((s) => s.id).join(",");

  useEffect(() => {
    const els = ids
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (els.length === 0) return;

    let frame = 0;

    const measure = () => {
      frame = 0;

      // The last section whose top has passed the line is the one being read.
      // Sections are in document order, so the first one still below the line
      // ends the search.
      let current = els[0]!;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= ACTIVE_LINE) current = el;
        else break;
      }

      // Bottom of the document: the final section wins outright. A short last
      // section — or one sitting above the footer — may never get its top past
      // the line, which would otherwise leave the previous entry highlighted
      // while the reader is plainly looking at the last one.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

      setActiveId(atBottom ? els[els.length - 1]!.id : current.id);
    };

    const onScroll = () => {
      // Coalesce to one measurement per frame; scroll fires far more often.
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids]);

  // Keep the highlighted row visible inside the index's own scroll box.
  // Container `scrollTop` is set directly instead of calling
  // `scrollIntoView`, which is free to scroll the window as well and would
  // fight the reader for control of the page.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !activeId) return;

    const link = list.querySelector<HTMLElement>(`[data-section="${activeId}"]`);
    if (!link) return;

    const top = link.offsetTop;
    const bottom = top + link.offsetHeight;

    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [activeId]);

  return (
    <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:self-start">
      <span className="hex-fig">ON THIS PAGE</span>

      <ol
        ref={listRef}
        className="custom-scrollbar mt-4 border-t hex-line-soft lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto"
        style={{ borderTopWidth: 1 }}
      >
        {sections.map((s, i) => {
          const active = s.id === activeId;
          return (
            <li key={s.id} className="border-b hex-line-soft" style={{ borderBottomWidth: 1 }}>
              <a
                href={`#${s.id}`}
                data-section={s.id}
                aria-current={active ? "true" : undefined}
                // Clicking sets the highlight immediately. Smooth scrolling is
                // in effect page-wide, so waiting for the scroll to land would
                // leave the row the reader just clicked looking inert.
                onClick={() => setActiveId(s.id)}
                className="flex items-baseline gap-3 py-2.5 pl-3 text-[13.5px] transition-colors hover:text-foreground"
                style={{
                  // The marker width is always reserved and only inked when
                  // active, so highlighting a row can't shift the list by 2px.
                  borderLeftWidth: 2,
                  borderLeftStyle: "solid",
                  borderLeftColor: active ? "var(--hex-ink)" : "transparent",
                  background: active ? "var(--hex-surface)" : undefined,
                  color: active ? "var(--hex-ink)" : "var(--hex-ink-soft)",
                  fontWeight: active ? 500 : 400,
                }}
              >
                <span
                  className="hex-mono text-[10px] font-bold"
                  style={{ color: active ? "var(--hex-ink)" : "var(--hex-ink-muted)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
