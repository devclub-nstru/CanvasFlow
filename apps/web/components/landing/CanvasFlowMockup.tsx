"use client";

import { useState, useRef, type CSSProperties } from "react";
import { motion, useInView } from "motion/react";

export const GeoGlyph = ({ className = "" }: { className?: string }) => (
  <div className={`hex-glyph inline-flex items-center gap-2 ${className}`}>
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect
        x="2.5"
        y="2.5"
        width="39"
        height="39"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.35"
      />
      <line x1="2" y1="22" x2="42" y2="22" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="22" y1="2" x2="22" y2="42" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <circle cx="13" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect
        x="26.5"
        y="26.5"
        width="6"
        height="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <polygon points="29,12 34,21 24,21" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="30" cy="14" r="1.6" fill="#10b981" />
    </svg>
  </div>
);

const SERIES = [
  { name: "Onboarding", color: "var(--c-orange)", pts: [32, 36, 35, 41, 44, 42, 47] },
  { name: "Pricing", color: "var(--c-yellow)", pts: [28, 32, 30, 36, 39, 41, 40] },
  { name: "Churn", color: "var(--c-teal)", pts: [26, 28, 31, 30, 33, 35, 34] },
  { name: "Signup", color: "var(--c-blue)", pts: [22, 24, 27, 26, 28, 27, 30] },
  { name: "Research", color: "var(--c-purple)", pts: [16, 18, 17, 20, 19, 21, 22] },
  { name: "Beta", color: "var(--c-lavender)", pts: [9, 10, 11, 11, 12, 12, 13] },
];

const MultiLineChart = ({ w = 480, h = 220 }: { w?: number; h?: number }) => {
  const padL = 28,
    padR = 8,
    padT = 8,
    padB = 22;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = 50;
  const basePts = SERIES[0]?.pts ?? [];
  const xs = basePts.map((_, i) => padL + (i * innerW) / (basePts.length - 1));
  const yFor = (v: number) => padT + innerH - (v / max) * innerH;
  const [hover, setHover] = useState<string | null>(null);
  const labels = ["Q1", "", "", "Q2", "", "", "Q3"];
  const yTicks = [0, 10, 20, 30, 40, 50];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={w - padR} y1={yFor(t)} y2={yFor(t)} stroke="rgba(26,29,41,0.06)" />
          <text
            x={padL - 6}
            y={yFor(t) + 3}
            fontSize="9"
            textAnchor="end"
            fill="var(--hex-ink-muted)"
          >
            {t}
          </text>
        </g>
      ))}
      {SERIES.map((s) => {
        const d = s.pts.map((v, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${yFor(v)}`).join(" ");
        const dim = hover && hover !== s.name;
        return (
          <g
            key={s.name}
            onMouseEnter={() => setHover(s.name)}
            onMouseLeave={() => setHover(null)}
            style={{ transition: "opacity .2s", opacity: dim ? 0.18 : 1, cursor: "pointer" }}
          >
            <path
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="hex-line-path"
              style={{ "--len": 600 } as CSSProperties}
            />
            {s.pts.map((v, i) => (
              <circle key={i} cx={xs[i]} cy={yFor(v)} r="2" fill={s.color} />
            ))}
          </g>
        );
      })}
      {labels.map(
        (l, i) =>
          l && (
            <text
              key={i}
              x={xs[i]}
              y={h - 6}
              fontSize="9"
              textAnchor="middle"
              fill="var(--hex-ink-muted)"
            >
              {l}
            </text>
          ),
      )}
    </svg>
  );
};

const SCATTER_GROUPS = [
  { color: "var(--c-purple)", n: 36, cx: 0.18, cy: 0.55, spread: 0.12 },
  { color: "var(--c-teal)", n: 42, cx: 0.45, cy: 0.4, spread: 0.16 },
  { color: "var(--c-yellow)", n: 40, cx: 0.78, cy: 0.62, spread: 0.14 },
];

/**
 * Deterministic seeded value in [0, 1) — a mulberry32 finaliser.
 *
 * This deliberately uses only 32-bit integer operations (`Math.imul`, `^`,
 * `>>>`, `| 0`), all of which ECMAScript specifies exactly. The obvious
 * shorthand, `Math.sin(seed) * 10000 % 1`, cannot be used here: the spec
 * lets each engine approximate `Math.sin`, so Node and the browser disagree
 * in the final bits. Scaling by 10000 and taking the fractional part
 * amplifies that into a visible difference, which React then reports as a
 * hydration mismatch on every dot in the scatter plot.
 */
const rng = (seed: number) => {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Fixed-precision rounding, so SSR and client emit the same string. */
const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

const ScatterChart = ({ w = 480, h = 220 }: { w?: number; h?: number }) => {
  const padL = 28,
    padR = 8,
    padT = 8,
    padB = 22;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const yTicks = [0, 5, 10, 15, 20, 25];
  const dots: { x: number; y: number; c: string; d: number }[] = [];
  let seed = 1;
  SCATTER_GROUPS.forEach((g) => {
    for (let i = 0; i < g.n; i++) {
      const dx = (rng(seed++) - 0.5) * 2 * g.spread;
      const dy = (rng(seed++) - 0.5) * 2 * g.spread;
      dots.push({
        // Rounded so the server and the client serialise byte-identical
        // numbers, and so 118 dots don't each carry a 17-digit coordinate
        // into the HTML. Sub-pixel precision is invisible on an r=2.6 dot.
        x: round(padL + (g.cx + dx) * innerW, 2),
        y: round(padT + (g.cy + dy) * innerH, 2),
        c: g.color,
        d: round(rng(seed++) * 0.6, 3),
      });
    }
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={w - padR}
            y1={padT + innerH - (t / 25) * innerH}
            y2={padT + innerH - (t / 25) * innerH}
            stroke="rgba(26,29,41,0.06)"
          />
          <text
            x={padL - 6}
            y={padT + innerH - (t / 25) * innerH + 3}
            fontSize="9"
            textAnchor="end"
            fill="var(--hex-ink-muted)"
          >
            {t}
          </text>
        </g>
      ))}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r="2.6"
          fill={d.c}
          opacity="0.78"
          className="hex-dot"
          style={{ animationDelay: `${d.d}s` }}
        />
      ))}
      {[0, 10, 20, 30, 40, 50].map((v, i) => (
        <text
          key={v}
          x={padL + (i / 5) * innerW}
          y={h - 6}
          fontSize="9"
          textAnchor="middle"
          fill="var(--hex-ink-muted)"
        >
          {v}
        </text>
      ))}
    </svg>
  );
};

const STACK_ROWS = [
  { label: "Onboarding flow", parts: [42, 18, 24, 16] },
  { label: "Pricing page", parts: [38, 22, 22, 18] },
  { label: "Churn survey", parts: [30, 26, 28, 16] },
  { label: "Dark mode poll", parts: [22, 28, 30, 20] },
];
const STACK_COLORS = ["var(--c-red)", "var(--c-yellow)", "var(--c-teal)", "var(--c-purple)"];

const StackedBars = () => (
  <div className="space-y-2.5">
    {STACK_ROWS.map((r, ri) => {
      const total = r.parts.reduce((a, b) => a + b, 0);
      return (
        <div
          key={r.label}
          className="grid grid-cols-[76px_1fr] items-center gap-2 sm:grid-cols-[120px_1fr] sm:gap-3"
        >
          <div
            className="truncate text-[10px] text-right sm:text-[11px]"
            style={{ color: "var(--hex-ink-soft)" }}
          >
            {r.label}
          </div>
          <div
            className="flex h-5 rounded-sm overflow-hidden"
            style={{ border: "1px solid var(--hex-line)" }}
          >
            {r.parts.map((p, i) => (
              <div
                key={i}
                className="hex-bar-x"
                style={{
                  width: `${(p / total) * 100}%`,
                  background: STACK_COLORS[i],
                  animationDelay: `${ri * 0.08 + i * 0.05}s`,
                }}
              />
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

export const DashboardMock = () => {
  const [tab, setTab] = useState("Summary");
  const tabs = ["Summary", "Responses", "Drop-off", "Segments"];
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div ref={ref} className="hex-card overflow-hidden w-full">
      <div
        className="flex items-center justify-between gap-2 border-b hex-line-soft px-3 py-2.5 sm:px-4"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[12px] font-medium">CanvasFlow · Onboarding Survey</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="hidden rounded border hex-line-soft px-2.5 py-1 text-[11px] sm:block"
            style={{ borderWidth: 1 }}
          >
            Edit
          </button>
          <button
            className="rounded px-2.5 py-1 text-[11px] text-white"
            style={{ background: "var(--hex-ink)" }}
          >
            Share
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <h3 className="text-[16px] font-semibold tracking-tight sm:text-[20px]">
          Onboarding Survey · Q3 Overview
        </h3>
        <p className="text-[12px] mt-1" style={{ color: "var(--hex-ink-soft)" }}>
          Live breakdown of responses across product areas, segments, and time.
        </p>

        {/* Tabs scroll rather than wrap. Wrapping a tab strip onto a second
            line reads as broken chrome; sliding it is what real UI does. */}
        <div
          className="custom-scrollbar mt-4 flex items-center gap-5 overflow-x-auto border-b hex-line-soft sm:gap-6"
          style={{ borderBottomWidth: 1 }}
        >
          {tabs.map((t) => (
            <div
              key={t}
              className={`hex-tab shrink-0 ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 sm:gap-3">
          {[
            { v: "1,284", l: "Total responses", sub: "↑ 9.7% vs last week" },
            { v: "87%", l: "Completion rate", sub: "↑ 4.1% vs last week" },
            { v: "2:14", l: "Avg. time", sub: "↓ 0:18 vs last week" },
          ].map((k) => (
            <div key={k.l} className="hex-kpi px-2 py-2.5 sm:px-3.5 sm:py-3">
              <div className="text-[15px] font-semibold leading-none sm:text-[20px]">{k.v}</div>
              <div
                className="mt-1.5 text-[10px] sm:text-[11px]"
                style={{ color: "var(--hex-ink-soft)" }}
              >
                {k.l}
              </div>
              {/* The delta is the first thing to go: three of these side by
                  side at phone width leaves no room for a second line of
                  supporting text under each figure. */}
              <div
                className="hex-mono mt-1 hidden text-[9px] sm:block"
                style={{ color: "var(--c-teal)" }}
              >
                {k.sub}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4 sm:grid-cols-4 sm:gap-3">
          {[
            { l: "Form", v: "All" },
            { l: "Segment", v: "All" },
            { l: "Source", v: "All" },
            { l: "Quarter", v: "Q3" },
          ].map((f) => (
            <div key={f.l}>
              <div className="hex-select-label">{f.l}</div>
              <div className="hex-select">
                <span>{f.v}</span>
                <span style={{ color: "var(--hex-ink-muted)" }}>▾</span>
              </div>
            </div>
          ))}
        </div>

        {/* Two charts side by side gives each about 150px on a phone, which
            is narrower than their own axis labels. They stack instead. */}
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <div className="text-[12px] font-medium mb-1">Responses by form · Q1–Q3</div>
            <MultiLineChart key={isInView ? "visible" : "hidden"} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {SERIES.map((s) => (
                <span
                  key={s.name}
                  className="text-[10px] flex items-center gap-1.5"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[12px] font-medium mb-1">Completion vs time-to-finish</div>
            <ScatterChart key={isInView ? "visible" : "hidden"} />
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {["Mobile", "Desktop", "Embed"].map((g, i) => (
                <span
                  key={g}
                  className="text-[10px] flex items-center gap-1.5"
                  style={{ color: "var(--hex-ink-soft)" }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: ["var(--c-purple)", "var(--c-teal)", "var(--c-yellow)"][i],
                    }}
                  />
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[12px] font-medium mb-2">Answers by question</div>
          <StackedBars key={isInView ? "visible" : "hidden"} />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {["Loved it", "Neutral", "Friction", "Confused"].map((g, i) => (
              <span
                key={g}
                className="text-[10px] flex items-center gap-1.5"
                style={{ color: "var(--hex-ink-soft)" }}
              >
                <span className="w-2 h-2 rounded-sm" style={{ background: STACK_COLORS[i] }} />
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const FormBuilderMock = () => {
  const [active, setActive] = useState(0);
  return (
    <div className="hex-card flex w-full max-w-140 flex-col overflow-hidden sm:min-h-120">
      <div
        className="flex items-center justify-between gap-2 border-b hex-line-soft bg-[#fafaf7] px-3 py-2.5 sm:px-4"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex gap-1.5 mr-1 sm:mr-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f56" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ffbd2e" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#27c93f" }} />
          </div>
          <span
            className="hex-mono truncate text-[10px] opacity-60 sm:text-[11px]"
            style={{ color: "var(--hex-ink-muted)" }}
          >
            canvasflow.app/builder
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hex-mono text-[10px] opacity-40">Draft</span>
          {/* Redundant next to "Draft" once space is tight. */}
          <span
            className="hex-mono hidden text-[10px] sm:inline"
            style={{ color: "var(--hex-ink-muted)" }}
          >
            autosaved · 2s ago
          </span>
        </div>
      </div>
      {/* The block palette is a 160px fixed column. Below sm it becomes a
          horizontal strip above the canvas, so the canvas keeps the full
          width for the questions that are the point of the mock. */}
      <div className="grid grow grid-cols-1 sm:grid-cols-[160px_1fr]">
        <aside
          className="custom-scrollbar flex gap-1 overflow-x-auto border-b hex-line-soft p-3 text-[11px] sm:block sm:space-y-1 sm:overflow-visible sm:border-r sm:border-b-0 sm:p-4"
          style={{ color: "var(--hex-ink-soft)", background: "#fafaf7" }}
        >
          <div className="hex-mono mb-3 hidden text-[9px] font-bold tracking-wider uppercase opacity-40 sm:block">
            Content Blocks
          </div>
          {[
            "Short text",
            "Long text",
            "Email",
            "Phone",
            "Number",
            "Dropdown",
            "Checkboxes",
            "Rating",
          ].map((b, i) => (
            <div
              key={i}
              onMouseEnter={() => setActive(i)}
              className={`flex shrink-0 cursor-pointer items-center gap-2.5 rounded px-2.5 py-2 whitespace-nowrap transition-all ${active === i ? "bg-black/5 text-black" : "opacity-60"}`}
            >
              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border hex-line-strong bg-white">
                <div className="w-1.5 h-1.5 bg-black/10 rounded-full" />
              </div>
              {b}
            </div>
          ))}
          <div className="hidden pt-6 sm:block">
            <div className="text-[9px] uppercase tracking-wider opacity-40 mb-3 hex-mono font-bold">
              More
            </div>
            <div className="px-2.5 py-2 rounded flex items-center gap-2.5 opacity-60 italic">
              Toggle · Date · Time
            </div>
          </div>
        </aside>
        <div className="grow space-y-6 p-4 sm:space-y-8 sm:p-8" style={{ background: "#fcfbf7" }}>
          <div className="group/q relative">
            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover/q:opacity-100 transition-opacity" />
            <div className="text-[10px] hex-mono opacity-50 mb-1.5">Q1 · Short text</div>
            <div className="text-[15px] font-semibold leading-tight tracking-tight sm:text-[17px]">
              What&rsquo;s the biggest pain in your current workflow?
            </div>
            <div
              className="border hex-line-soft rounded-md px-4 py-3 mt-3 text-[13px] shadow-sm"
              style={{ borderWidth: 1, color: "var(--hex-ink-muted)", background: "#fff" }}
            >
              Type your answer…
            </div>
          </div>

          <div className="hex-divider opacity-30" />

          <div className="group/q relative">
            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover/q:opacity-100 transition-opacity" />
            <div className="text-[10px] hex-mono opacity-50 mb-1.5">Q2 · Multiple choice</div>
            <div className="text-[15px] font-semibold leading-tight tracking-tight sm:text-[17px]">
              How often does this friction occur?
            </div>
            <div className="grid grid-cols-1 gap-2 mt-4">
              {["Every single day", "A few times per week", "Only during month-end"].map(
                (opt, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 border hex-line-soft rounded-lg px-4 py-2.5 text-[13px] transition-colors ${i === 0 ? "bg-indigo-50/50 border-indigo-200/50" : "bg-white"}`}
                    style={{ borderWidth: 1 }}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${i === 0 ? "border-indigo-500 bg-indigo-500" : "border-slate-200"}`}
                    >
                      {i === 0 && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <span className={i === 0 ? "font-medium text-indigo-900" : ""}>{opt}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Live responses feed ───────────────────────────────────────────── */

const FEED_ROWS = [
  { name: "Aman R.", ago: "just now", tag: "Daily", c: "var(--c-red)" },
  { name: "Priya M.", ago: "12s ago", tag: "Weekly", c: "var(--c-yellow)" },
  { name: "Jordan K.", ago: "48s ago", tag: "Daily", c: "var(--c-red)" },
  { name: "Sara L.", ago: "1m ago", tag: "Rarely", c: "var(--c-teal)" },
  { name: "Marc T.", ago: "2m ago", tag: "Weekly", c: "var(--c-yellow)" },
];

export const ResponseFeedMock = () => (
  <div className="hex-card w-full max-w-105 overflow-hidden">
    <div
      className="flex items-center justify-between border-b hex-line-soft px-4 py-3"
      style={{ borderBottomWidth: 1, background: "var(--hex-surface)" }}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] font-medium">Live responses</span>
        <span className="hex-mono text-[10px]" style={{ color: "var(--hex-ink-muted)" }}>
          1,284
        </span>
      </div>
      <div
        className="hex-mono flex items-center gap-1.5 text-[10px]"
        style={{ color: "var(--hex-ink-muted)" }}
      >
        {/* Two stacked spans: the outer one pulses as a halo while the
            inner dot stays solid, so the indicator reads as a signal
            rather than the whole dot fading in and out. */}
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: "var(--c-teal)" }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--c-teal)" }}
          />
        </span>
        streaming
      </div>
    </div>

    <div className="divide-y hex-line-soft">
      {FEED_ROWS.map((r, i) => (
        <div
          key={r.name}
          className="hex-row-hover relative flex items-center justify-between px-4 py-2.5 text-[12px]"
          {...(i === 0
            ? // Newest row: faint tint plus a coloured edge, so the eye lands
              // on the top of the feed where a live stream actually changes.
              { style: { background: "rgba(58, 167, 147, 0.05)" } }
            : {})}
        >
          {i === 0 && (
            <span
              className="absolute inset-y-0 left-0 w-0.5"
              style={{ background: "var(--c-teal)" }}
              aria-hidden
            />
          )}
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"
              style={{
                background: "#efeee8",
                color: "var(--hex-ink-soft)",
                boxShadow: "inset 0 0 0 1px var(--hex-line)",
              }}
            >
              {r.name[0]}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium">{r.name}</div>
              <div className="hex-mono text-[10px]" style={{ color: "var(--hex-ink-muted)" }}>
                {r.ago}
              </div>
            </div>
          </div>
          {/* Tinted pill rather than a solid fill. A saturated block of
              colour with white type fights the muted paper palette; a wash
              of the same hue keeps the category legible and calm. */}
          <span
            className="hex-mono shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: `color-mix(in srgb, ${r.c} 14%, #fff)`,
              color: `color-mix(in srgb, ${r.c} 72%, var(--hex-ink))`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${r.c} 28%, #fff)`,
            }}
          >
            {r.tag}
          </span>
        </div>
      ))}
    </div>

    <div
      className="hex-mono flex items-center justify-between border-t hex-line-soft px-4 py-2 text-[10px]"
      style={{
        color: "var(--hex-ink-muted)",
        background: "var(--hex-surface)",
        borderTopWidth: 1,
      }}
    >
      <span>5 of 1,284</span>
      <span>response_id #f8a2…</span>
    </div>
  </div>
);

export const AnalyticsMock = DashboardMock;

export const CanvasEditorMock = () => {
  const [tab, setTab] = useState("Build");
  const tabs = ["Build", "Fields", "Share", "Settings"];
  return (
    <div className="hex-card overflow-hidden w-full max-w-295 mx-auto min-w-0 group/canvas shadow-[0_32px_64px_-16px_rgba(26,29,41,0.1)] transition-all duration-500 hover:shadow-[0_32px_64px_-16px_rgba(26,29,41,0.2)]">
      <div
        className="flex items-center justify-between gap-2 border-b hex-line-soft px-3 py-2.5 sm:px-4"
        style={{ borderBottomWidth: 1 }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[12px] font-medium">
            CanvasFlow · Customer Feedback Form
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="hidden cursor-pointer rounded border hex-line-soft px-2.5 py-1 text-[11px] transition-colors hover:bg-slate-50 sm:block"
            style={{ borderWidth: 1 }}
          >
            Preview
          </button>
          <button
            className="cursor-pointer rounded px-2.5 py-1 text-[11px] text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--hex-ink)" }}
          >
            Publish
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <h3 className="text-[16px] font-semibold tracking-tight sm:text-[20px]">
          Form Builder · Interactive Canvas
        </h3>
        <p className="text-[12px] mt-1" style={{ color: "var(--hex-ink-soft)" }}>
          Drop in fields, drag to reorder, mark what&rsquo;s required, then publish.
        </p>

        <div
          className="custom-scrollbar mt-4 flex items-center gap-5 overflow-x-auto border-b hex-line-soft sm:gap-6"
          style={{ borderBottomWidth: 1 }}
        >
          {tabs.map((t) => (
            <div
              key={t}
              className={`hex-tab shrink-0 cursor-pointer ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 sm:gap-3">
          {[
            { v: "12", l: "Fields", sub: "Drag to reorder" },
            { v: "4", l: "Required", sub: "Validated on submit" },
            { v: "2m", l: "Est. Time", sub: "Average completion" },
          ].map((k) => (
            <div key={k.l} className="hex-kpi px-2 py-2.5 sm:px-3.5 sm:py-3">
              <div className="text-[15px] font-semibold leading-none sm:text-[20px]">{k.v}</div>
              <div
                className="mt-1.5 text-[10px] sm:text-[11px]"
                style={{ color: "var(--hex-ink-soft)" }}
              >
                {k.l}
              </div>
              <div
                className="hex-mono mt-1 hidden text-[9px] sm:block"
                style={{ color: "var(--c-purple)" }}
              >
                {k.sub}
              </div>
            </div>
          ))}
        </div>

        {/* The stage is a fixed 420px tall on desktop. On a phone the tool
            rail and inspector are gone, so the canvas alone needs less
            height and a shorter box avoids a tall band of empty grid. */}
        <div className="relative mt-5 flex h-80 min-h-0 overflow-hidden rounded-lg border hex-line-soft bg-[#fcfbf7] shadow-sm sm:h-105">
          <div
            className="absolute inset-0 opacity-[0.03] hex-grid-fine pointer-events-none"
            style={{ backgroundSize: "24px 24px" }}
          />

          {/* Tool rail: 56px of icons with no labels. Dropping it below sm
              gives the canvas the room, and nothing it conveys is lost. */}
          <div className="z-10 hidden w-14 shrink-0 flex-col items-center gap-3 border-r hex-line-soft bg-[#fafaf7] py-4 sm:flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded border hex-line-soft shadow-sm flex items-center justify-center hover:bg-black hover:text-white transition-all duration-300 cursor-pointer ${i === 2 ? "bg-black text-white shadow-lg" : "bg-white opacity-60 hover:opacity-100"}`}
              >
                {i === 1 && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
                {i === 2 && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                  </svg>
                )}
                {i === 3 && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                )}
                {i === 4 && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                )}
                {i === 5 && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 19l7-7 3 3-7 7-3-3z" />
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                    <path d="M2 2l7.5 1.5" />
                    <path d="M14 11l7 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-0 relative flex flex-col min-h-0">
            <div className="custom-scrollbar flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 sm:pt-7">
              <div className="mx-auto w-full max-w-140 space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-xl border hex-line-soft bg-white/90 shadow-sm relative group/block backdrop-blur-sm cursor-pointer hover:border-indigo-200 transition-colors"
                >
                  <div className="absolute -left-2.5 top-5 w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center text-white text-[9px] font-bold hex-mono shadow-md">
                    01
                  </div>
                  <div className="text-[11px] font-bold opacity-30 hex-mono mb-1.5 uppercase tracking-widest">
                    Rating · required
                  </div>
                  <div className="text-[13px] font-semibold mb-3 text-slate-800">
                    How likely are you to recommend CanvasFlow?
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div
                        key={n}
                        className="grow h-8 rounded border hex-line-soft flex items-center justify-center text-[10px] font-medium opacity-60 hover:opacity-100 hover:bg-indigo-50 transition-all cursor-pointer"
                      >
                        {n}
                      </div>
                    ))}
                  </div>
                </motion.div>

                <div className="h-6 ml-5 w-[1.5px] bg-indigo-500/20 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-5 rounded-xl border-2 border-indigo-500 bg-white shadow-md relative z-10 cursor-pointer"
                >
                  <div className="absolute -left-2.5 top-5 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[9px] font-bold hex-mono shadow-md">
                    02
                  </div>
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="text-[11px] font-bold text-indigo-600 hex-mono uppercase tracking-widest">
                      Long text · optional
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  </div>
                  <div className="text-[13px] font-semibold mb-3 text-slate-900">
                    What is the primary reason for your score?
                  </div>
                  <div className="h-16 rounded border hex-line-soft bg-slate-50/50 p-2 text-[11px] text-slate-400 font-medium">
                    Type your reason here...
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Properties panel: 272px fixed. Kept off until md — at sm the
              rail and this panel together would leave the canvas narrower
              than the field cards it is meant to be showing. */}
          <div className="z-10 hidden w-68 shrink-0 transform flex-col border-l hex-line-soft bg-white/95 shadow-[-10px_0_20px_rgba(0,0,0,0.02)] backdrop-blur-sm transition-transform duration-500 min-h-0 min-w-0 md:flex">
            <div className="p-3.5 shrink-0 border-b hex-line-soft bg-[#fafaf7] flex items-center justify-between">
              <div className="text-[9px] font-bold uppercase tracking-widest opacity-40 hex-mono">
                Properties
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
            </div>
            <div className="p-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-5">
              <div className="space-y-1.5">
                <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 hex-mono">
                  Component ID
                </div>
                <div className="h-8 rounded border hex-line-soft flex items-center px-2.5 text-[10px] font-mono bg-white shadow-sm">
                  q_reason_text
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 hex-mono">
                  Field settings
                </div>
                <div className="space-y-1.5">
                  {[
                    { k: "Type", v: "Long text" },
                    { k: "Required", v: "Off" },
                    { k: "Placeholder", v: "Type your reason…" },
                  ].map((row) => (
                    <div
                      key={row.k}
                      className="p-2.5 rounded bg-indigo-50/40 border border-indigo-100/50 text-[10px] leading-snug flex items-center justify-between gap-2"
                    >
                      <span className="opacity-50 font-bold">{row.k}</span>
                      <span className="font-bold text-indigo-900 truncate">{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 shrink-0 border-t hex-line-soft bg-[#fafaf7]">
              <button className="w-full py-2 rounded bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest shadow-md hover:bg-black transition-colors cursor-pointer">
                Save field
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
