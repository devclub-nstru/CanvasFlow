"use client";

import React, { useEffect, useRef, useState } from "react";

type Section = { id: string; title: string };

const ACTIVE_LINE = 140;

export function DocsSectionNav({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const listRef = useRef<HTMLOListElement>(null);

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
      let current = els[0]!;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= ACTIVE_LINE) current = el;
        else break;
      }

      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

      setActiveId(atBottom ? els[els.length - 1]!.id : current.id);
    };

    const onScroll = () => {
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
                onClick={() => setActiveId(s.id)}
                className="flex items-baseline gap-3 py-2.5 pl-3 text-[13.5px] transition-colors hover:text-foreground"
                style={{
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
