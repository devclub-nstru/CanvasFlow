"use client";

import { useState } from "react";
import {
  AlignLeft,
  Check,
  CheckSquare,
  Download,
  DraftingCompass,
  Eye,
  FileText,
  Layers,
  LayoutGrid,
  ListOrdered,
  Lock,
  Mail,
  PencilRuler,
  Plus,
  Save,
  Search,
  Share2,
  TrendingUp,
  Type,
} from "lucide-react";

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

export const DashboardMock = () => {
  const [trendRange, setTrendRange] = useState("30d");

  const STATS = [
    { title: "Total forms", val: "12", sub: "9 published", icon: DraftingCompass },
    { title: "Active forms", val: "9", sub: "75% of all forms", icon: PencilRuler },
    { title: "Total responses", val: "1,284", sub: "Across all forms", icon: Layers },
    { title: "This month", val: "412", sub: "Submissions collected", icon: TrendingUp },
  ];

  const recentForms = [
    { title: "Customer Feedback Form", isPublished: true, responses: 642, date: "Oct 12, 2026" },
    { title: "Onboarding Survey", isPublished: true, responses: 412, date: "Oct 12, 2026" },
    { title: "Newsletter Signup", isPublished: false, responses: 0, date: "Oct 10, 2026" },
  ];

  return (
    <div className="border border-(--cf-line-strong) bg-(--cf-cream) w-full max-w-295 mx-auto overflow-hidden shadow-[5px_5px_0_0_var(--cf-ink)] font-sans text-[11px] select-none text-(--cf-ink) flex flex-col">
      {/* Top Navbar */}
      <div className="flex items-center justify-between border-b border-(--cf-line-strong) px-5 py-3 bg-white">
        <div className="flex items-center gap-6">
          <span className="cf-display text-[15px] font-bold tracking-tight">CanvasFlow</span>
          <nav className="hidden sm:flex items-center gap-4 font-mono text-[9px] font-bold uppercase tracking-wider text-(--cf-ink-soft)">
            <span className="text-(--cf-ink)">Dashboard</span>
            <span className="opacity-60 cursor-default">Forms</span>
            <span className="opacity-60 cursor-default">Team</span>
            <span className="opacity-60 cursor-default">Settings</span>
          </nav>
        </div>
        <div className="size-6 border border-(--cf-line-strong) bg-(--cf-cream) flex items-center justify-center font-bold text-[10px]">
          D
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Title area */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="cf-display text-[26px] font-bold uppercase tracking-tight sm:text-[32px] md:text-[38px] leading-none">
              Overview
              <span className="text-(--cf-orange)">.</span>
            </h1>
            <p className="mt-2 font-mono text-[11px] text-(--cf-ink-soft)">
              Design, publish, and read your forms in one place.
            </p>
          </div>
          <button className="cf-btn cf-raised cf-press h-9 px-4 text-[12px] font-bold flex items-center gap-1.5 cursor-default text-white">
            <Plus className="size-3.5" />
            New form
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.title}
                className="cf-panel border border-(--cf-line-strong) bg-white p-4 shadow-[3px_3px_0_0_var(--cf-ink)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="cf-meta text-[9px] font-mono font-bold uppercase tracking-wider text-(--cf-ink-soft)">
                    {stat.title}
                  </p>
                  <Icon className="size-3.5" style={{ color: "var(--cf-orange)" }} />
                </div>
                <p className="cf-display mt-3 text-[22px] font-bold leading-none sm:text-[28px]">
                  {stat.val}
                </p>
                <p className="mt-1.5 text-[10px] text-(--cf-ink-soft)">{stat.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Trends & Recent Forms Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
          {/* Response Trends Card */}
          <div className="cf-panel border border-(--cf-line-strong) bg-white shadow-[4px_4px_0_0_var(--cf-ink)] flex flex-col">
            <div className="flex flex-col gap-3 border-b border-(--cf-line) p-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="cf-meta text-[9px] font-mono font-bold uppercase tracking-wider text-(--cf-ink-soft)">
                  Responses
                </p>
                <h3 className="cf-display mt-1 text-[16px] font-bold">Response trends</h3>
                <p className="text-[10px] text-(--cf-ink-soft) font-mono">
                  Submissions over the past{" "}
                  {trendRange === "30d" ? "30" : trendRange === "7d" ? "7" : "90"} days
                </p>
              </div>

              {/* Range Toggle */}
              <div className="inline-flex border border-(--cf-line-strong) text-[9px] font-mono font-bold uppercase tracking-wider select-none">
                {["7d", "30d", "3m"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTrendRange(range)}
                    className={`px-2.5 py-1 transition-colors cursor-default ${trendRange === range ? "bg-(--cf-ink) text-white" : "text-(--cf-ink-soft)"}`}
                  >
                    {range === "7d" ? "7 days" : range === "30d" ? "30 days" : "3 months"}
                  </button>
                ))}
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-3 gap-4 border-b border-(--cf-line) px-4 py-3.5 font-mono text-[9px] uppercase tracking-wider text-(--cf-ink-soft)">
              <div>
                <span className="block opacity-65 text-[8px] font-bold">Total in range</span>
                <span className="cf-display text-[14px] font-bold text-(--cf-ink) leading-none mt-1 block">
                  1,284
                </span>
              </div>
              <div>
                <span className="block opacity-65 text-[8px] font-bold">Avg / day</span>
                <span className="cf-display text-[14px] font-bold text-(--cf-ink) leading-none mt-1 block">
                  42.8
                </span>
              </div>
              <div>
                <span className="block opacity-65 text-[8px] font-bold">Peak day</span>
                <span className="cf-display text-[14px] font-bold text-(--cf-ink) leading-none mt-1 block">
                  Oct 12
                </span>
              </div>
            </div>

            {/* SVG Area Chart */}
            <div className="p-4 h-48 w-full relative">
              <svg className="w-full h-full" viewBox="0 0 400 150">
                <defs>
                  <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cf-orange)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--cf-orange)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* grid lines */}
                <line
                  x1="10"
                  y1="20"
                  x2="390"
                  y2="20"
                  stroke="rgba(26,29,41,0.06)"
                  strokeDasharray="3 3"
                />
                <line
                  x1="10"
                  y1="60"
                  x2="390"
                  y2="60"
                  stroke="rgba(26,29,41,0.06)"
                  strokeDasharray="3 3"
                />
                <line
                  x1="10"
                  y1="100"
                  x2="390"
                  y2="100"
                  stroke="rgba(26,29,41,0.06)"
                  strokeDasharray="3 3"
                />

                {/* chart area path */}
                <path
                  d="M 10 130 C 50 120, 80 80, 110 90 C 140 100, 170 50, 200 40 C 230 30, 260 90, 290 80 C 320 70, 350 30, 390 20 L 390 140 L 10 140 Z"
                  fill="url(#trend-grad)"
                />

                {/* chart line path */}
                <path
                  d="M 10 130 C 50 120, 80 80, 110 90 C 140 100, 170 50, 200 40 C 230 30, 260 90, 290 80 C 320 70, 350 30, 390 20"
                  fill="none"
                  stroke="var(--cf-orange)"
                  strokeWidth="2"
                />

                {/* dot markers */}
                <circle
                  cx="200"
                  cy="40"
                  r="3.5"
                  fill="white"
                  stroke="var(--cf-orange)"
                  strokeWidth="2.5"
                />
                <circle cx="390" cy="20" r="3" fill="var(--cf-orange)" />

                {/* x axis labels */}
                <text
                  x="10"
                  y="148"
                  fill="var(--cf-ink-soft)"
                  fontSize="8"
                  fontFamily="monospace"
                  opacity="0.6"
                >
                  Oct 1
                </text>
                <text
                  x="200"
                  y="148"
                  fill="var(--cf-ink-soft)"
                  fontSize="8"
                  fontFamily="monospace"
                  opacity="0.6"
                  textAnchor="middle"
                >
                  Oct 15
                </text>
                <text
                  x="390"
                  y="148"
                  fill="var(--cf-ink-soft)"
                  fontSize="8"
                  fontFamily="monospace"
                  opacity="0.6"
                  textAnchor="end"
                >
                  Oct 30
                </text>
              </svg>
            </div>
          </div>

          {/* Recent Forms Card */}
          <div className="cf-panel border border-(--cf-line-strong) bg-white shadow-[4px_4px_0_0_var(--cf-ink)] p-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-(--cf-line-strong) pb-2.5">
                <p className="cf-meta text-[9px] font-mono font-bold uppercase tracking-wider text-(--cf-ink-soft)">
                  Recent
                </p>
                <h3 className="cf-display mt-1 text-[16px] font-bold">
                  Forms<span className="text-(--cf-orange)">.</span>
                </h3>
              </div>

              {/* Forms list grid */}
              <div className="grid grid-cols-1 gap-2.5">
                {recentForms.map((form) => (
                  <div
                    key={form.title}
                    className="cf-panel cf-raised cf-press relative flex items-center justify-between gap-3 p-3 bg-(--cf-cream-2) cursor-default"
                  >
                    <span
                      className="absolute top-0 right-0 h-2.5 w-2.5 border-b border-l border-(--cf-line-strong)"
                      style={{
                        background: form.isPublished ? "var(--cf-orange)" : "var(--cf-ink-soft)",
                      }}
                    />
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-7.5 shrink-0 items-center justify-center border border-(--cf-line-strong) bg-white">
                        <FileText className="size-3.5" style={{ color: "var(--cf-orange)" }} />
                      </div>
                      <div className="min-w-0 font-sans">
                        <h4 className="font-bold truncate text-[11.5px] leading-tight text-(--cf-ink)">
                          {form.title}
                        </h4>
                        <p className="mt-0.5 text-[9px] text-(--cf-ink-soft) font-mono">
                          {form.isPublished ? "Published" : "Draft"}
                          <span className="mx-1">·</span>
                          {form.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 font-mono text-[9.5px] text-(--cf-ink-soft) pr-1">
                      <span className="font-bold text-(--cf-ink)">{form.responses}</span>
                      <span>resp.</span>
                    </div>
                  </div>
                ))}

                {/* start new form dashed button */}
                <div className="flex h-12 border border-dashed border-(--cf-line-strong) bg-(--cf-cream-2) items-center justify-center cursor-default hover:bg-(--cf-cream) transition-colors">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-(--cf-ink-soft)">
                    <Plus className="size-3.5" />
                    Start a new form
                  </span>
                </div>
              </div>
            </div>

            <button className="w-full py-2 border border-(--cf-line-strong) font-mono text-[9px] font-bold uppercase tracking-wider hover:bg-(--cf-cream) transition-colors cursor-default mt-4 bg-white">
              View all forms
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FormBuilderMock = () => {
  const [active, setActive] = useState(2); // Email selected

  return (
    <div className="border border-(--cf-line-strong) bg-(--cf-cream) flex w-full max-w-160 flex-col overflow-hidden sm:min-h-120 shadow-[4px_4px_0_0_var(--cf-ink)] font-sans text-(--cf-ink)">
      {/* header */}
      <div className="flex items-center justify-between gap-2 border-b border-(--cf-line-strong) bg-(--cf-cream-2) px-3 py-2 sm:px-4 text-[11px] select-none font-mono">
        {/* left */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-(--cf-ink-soft)">
            &lt; Forms
          </span>
          <div className="h-3 w-px bg-(--cf-line-strong)" />
          <span className="cf-display truncate font-bold text-[13px]">aweadwad</span>
          <span className="inline-flex shrink-0 items-center gap-1 border border-(--cf-orange) px-1.5 py-0.5 text-[9px] text-(--cf-orange) uppercase font-bold tracking-wider">
            <span className="size-1.5 rounded-full bg-(--cf-orange)" />
            Live
          </span>
        </div>

        {/* center */}
        <div className="hidden border border-(--cf-line-strong) md:inline-flex shrink-0">
          <button className="bg-(--cf-ink) text-(--cf-cream) px-2.5 py-1 text-[9px] font-mono flex items-center gap-1.5 uppercase font-bold cursor-default">
            <LayoutGrid className="size-3.5" />
            Canvas
          </button>
          <button className="text-(--cf-ink-soft) px-2.5 py-1 text-[9px] font-mono flex items-center gap-1.5 uppercase font-bold cursor-default">
            <ListOrdered className="size-3.5" />
            Outline
          </button>
        </div>

        {/* right */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button className="cf-btn-outline h-7 px-2 text-[10px] flex items-center gap-1 cursor-default opacity-40">
            <Save className="size-3" />
            <span className="hidden lg:inline">Save</span>
          </button>
          <button className="cf-btn-outline h-7 px-2 text-[10px] flex items-center gap-1 cursor-default">
            <Eye className="size-3" />
            <span className="hidden lg:inline">Preview</span>
          </button>
          <button className="cf-btn-outline h-7 px-2 text-[10px] flex items-center gap-1 cursor-default">
            <Share2 className="size-3" />
            <span className="hidden lg:inline">Share</span>
          </button>
          <button className="cf-btn h-7 px-3 text-[10px] text-white font-bold flex items-center gap-1 cursor-default bg-(--cf-ink)">
            Published
          </button>
        </div>
      </div>

      <div className="grid grow grid-cols-1 sm:grid-cols-[180px_1fr]">
        {/* sidebar */}
        <aside className="flex flex-col border-b border-(--cf-line-strong) sm:border-r sm:border-b-0 bg-(--cf-cream-2) select-none">
          {/* Pane bar */}
          <div className="border-b border-(--cf-line-strong) px-3 py-2 flex items-center justify-between bg-(--cf-cream-2)">
            <p className="cf-meta text-[10px] font-bold uppercase tracking-wider opacity-60">
              Fields
            </p>
            <span className="font-mono text-[9px] tracking-wider text-(--cf-ink-soft) opacity-60">
              4 of 13
            </span>
          </div>

          {/* Search bar */}
          <div className="border-b border-(--cf-line-strong) px-3 py-2 bg-(--cf-cream-2)">
            <div className="relative">
              <Search className="absolute top-1/2 left-2 size-3 -translate-y-1/2 text-(--cf-ink-soft)" />
              <input
                type="text"
                disabled
                placeholder="Search fields..."
                className="w-full bg-white border border-(--cf-line-strong) h-7 pl-6 pr-2 text-[10px] focus:outline-none placeholder:text-(--cf-ink-soft)/60"
              />
            </div>
          </div>

          {/* Fields list */}
          <div className="p-3 space-y-4 overflow-y-auto max-h-48 sm:max-h-none">
            {/* Text Category */}
            <div>
              <p className="cf-meta text-[9px] font-bold uppercase tracking-wider text-(--cf-ink-soft) mb-2 px-1">
                Text
              </p>
              <div className="space-y-1">
                {/* Short Text */}
                <div
                  onMouseEnter={() => setActive(0)}
                  className={`group flex w-full items-center gap-2 border px-2 py-1.5 text-left transition-colors select-none ${active === 0 ? "border-(--cf-line-strong) bg-white shadow-[2px_2px_0_0_var(--cf-ink)]" : "border-(--cf-line) bg-(--cf-cream) hover:border-(--cf-line-strong) hover:bg-white"}`}
                >
                  <div
                    className={`flex size-6 shrink-0 items-center justify-center border bg-(--cf-cream) transition-colors ${active === 0 ? "border-(--cf-orange)" : "border-(--cf-line)"}`}
                  >
                    <Type className="size-3 text-(--cf-orange)" />
                  </div>
                  <div className="min-w-0 font-mono">
                    <p className="text-[11px] font-bold leading-none text-(--cf-ink)">Short text</p>
                    <p className="text-[9px] text-(--cf-ink-soft) truncate mt-0.5">
                      Single line input
                    </p>
                  </div>
                </div>

                {/* Long Text */}
                <div
                  onMouseEnter={() => setActive(1)}
                  className={`group flex w-full items-center gap-2 border px-2 py-1.5 text-left transition-colors select-none ${active === 1 ? "border-(--cf-line-strong) bg-white shadow-[2px_2px_0_0_var(--cf-ink)]" : "border-(--cf-line) bg-(--cf-cream) hover:border-(--cf-line-strong) hover:bg-white"}`}
                >
                  <div
                    className={`flex size-6 shrink-0 items-center justify-center border bg-(--cf-cream) transition-colors ${active === 1 ? "border-(--cf-orange)" : "border-(--cf-line)"}`}
                  >
                    <AlignLeft className="size-3 text-(--cf-orange)" />
                  </div>
                  <div className="min-w-0 font-mono">
                    <p className="text-[11px] font-bold leading-none text-(--cf-ink)">Long text</p>
                    <p className="text-[9px] text-(--cf-ink-soft) truncate mt-0.5">
                      Multi-line input
                    </p>
                  </div>
                </div>

                {/* Email */}
                <div
                  onMouseEnter={() => setActive(2)}
                  className={`group flex w-full items-center gap-2 border px-2 py-1.5 text-left transition-colors select-none ${active === 2 ? "border-(--cf-line-strong) bg-white shadow-[2px_2px_0_0_var(--cf-ink)]" : "border-(--cf-line) bg-(--cf-cream) hover:border-(--cf-line-strong) hover:bg-white"}`}
                >
                  <div
                    className={`flex size-6 shrink-0 items-center justify-center border bg-(--cf-cream) transition-colors ${active === 2 ? "border-(--cf-orange)" : "border-(--cf-line)"}`}
                  >
                    <Mail className="size-3 text-(--cf-orange)" />
                  </div>
                  <div className="min-w-0 font-mono">
                    <p className="text-[11px] font-bold leading-none text-(--cf-ink)">Email</p>
                    <p className="text-[9px] text-(--cf-ink-soft) truncate mt-0.5">
                      Email address input
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Choice Category */}
            <div>
              <p className="cf-meta text-[9px] font-bold uppercase tracking-wider text-(--cf-ink-soft) mb-2 px-1">
                Choice
              </p>
              <div className="space-y-1">
                {/* Checkbox */}
                <div
                  onMouseEnter={() => setActive(3)}
                  className={`group flex w-full items-center gap-2 border px-2 py-1.5 text-left transition-colors select-none ${active === 3 ? "border-(--cf-line-strong) bg-white shadow-[2px_2px_0_0_var(--cf-ink)]" : "border-(--cf-line) bg-(--cf-cream) hover:border-(--cf-line-strong) hover:bg-white"}`}
                >
                  <div
                    className={`flex size-6 shrink-0 items-center justify-center border bg-(--cf-cream) transition-colors ${active === 3 ? "border-(--cf-orange)" : "border-(--cf-line)"}`}
                  >
                    <CheckSquare className="size-3 text-(--cf-orange)" />
                  </div>
                  <div className="min-w-0 font-mono">
                    <p className="text-[11px] font-bold leading-none text-(--cf-ink)">Checkbox</p>
                    <p className="text-[9px] text-(--cf-ink-soft) truncate mt-0.5">
                      Multiple checkboxes
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* canvas */}
        <div
          className="grow p-8 flex items-center justify-center bg-(--cf-cream) relative min-h-72 sm:min-h-0 select-none"
          style={{
            backgroundImage: "radial-gradient(var(--cf-line-strong) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            backgroundPosition: "center",
          }}
        >
          {/* Canvas header details */}
          <div className="absolute top-3 left-3 text-[10px] font-mono text-(--cf-ink-soft) font-bold uppercase tracking-wider">
            Canvas <span className="opacity-50">1 field</span>
          </div>

          <div className="absolute top-3 right-3 border border-(--cf-line-strong) bg-(--cf-cream) px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider font-mono flex items-center gap-1 text-(--cf-ink-soft)">
            <Lock className="size-2.5 text-(--cf-ink-soft)" />
            Unlocked
          </div>

          {/* selected card node */}
          <div className="w-72 border-2 border-(--cf-orange) bg-white shadow-[5px_5px_0_0_var(--cf-orange)] relative flex flex-col">
            {/* node handles */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full border-2 border-(--cf-line-strong) bg-(--cf-orange)" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 size-2 rounded-full border-2 border-(--cf-line-strong) bg-(--cf-orange)" />

            {/* card header */}
            <div
              className="flex items-center justify-between border-b px-4 py-2"
              style={{ borderBottomColor: "var(--cf-line)", background: "var(--cf-cream)" }}
            >
              <div className="cf-meta inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-(--cf-ink-soft) font-mono">
                <Type className="size-3 text-(--cf-orange)" />
                <span>Text</span>
              </div>
              <span className="inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] tracking-wider uppercase border-(--cf-orange) text-(--cf-orange) font-bold">
                Req
              </span>
            </div>

            {/* card content */}
            <div className="space-y-3 p-4">
              <div className="space-y-1.5">
                <h4 className="cf-display text-[15px] leading-snug text-(--cf-ink) font-bold uppercase">
                  What&rsquo;s the biggest pain in your current workflow?
                </h4>
              </div>
              <div className="pt-1">
                <div className="w-full bg-white border border-(--cf-line-strong) h-9 px-3 flex items-center text-[12px] text-(--cf-ink-soft)/60 font-mono">
                  Answer here...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ResponseFeedMock = () => {
  const chartData = [
    { label: "Slow loading", count: 642, pct: "80%", color: "var(--cf-orange)" },
    { label: "Bad UI/UX", count: 412, pct: "51%", color: "var(--cf-ink)" },
    { label: "No integrations", count: 230, pct: "29%", color: "var(--cf-ink-soft)" },
  ];

  return (
    <div className="border border-(--cf-line-strong) bg-(--cf-cream) w-full max-w-115 overflow-hidden shadow-[5px_5px_0_0_var(--cf-ink)] font-sans text-[11px] select-none text-(--cf-ink) flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between border-b border-(--cf-line-strong) px-4 py-2.5 bg-(--cf-cream-2) font-mono">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-(--cf-ink-soft)">
            &lt; Forms
          </span>
          <div className="h-3 w-px bg-(--cf-line-strong)" />
          <span className="cf-display truncate font-bold text-[13px]">aweadwad</span>
          <span className="inline-flex shrink-0 items-center gap-1 border border-(--cf-orange) px-1.5 py-0.5 text-[9px] text-(--cf-orange) uppercase font-bold tracking-wider">
            <span className="size-1.5 rounded-full bg-(--cf-orange)" />
            Live
          </span>
        </div>
        <button className="cf-btn-outline h-7 px-2.5 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 cursor-default">
          <Download className="size-3" />
          CSV Export
        </button>
      </div>

      {/* sub-tabs nav */}
      <div className="flex gap-5 border-b border-(--cf-line-strong) bg-white px-4 pt-2.5 text-[10px] font-mono font-bold uppercase tracking-wider">
        <span className="border-b-2 border-(--cf-ink) pb-2 text-(--cf-ink)">Summary</span>
        <span className="text-(--cf-ink-soft)/60 pb-2 cursor-default">Question</span>
        <span className="text-(--cf-ink-soft)/60 pb-2 cursor-default">Individual</span>
      </div>

      {/* content container */}
      <div className="p-4 space-y-4">
        {/* Metric Cards grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-(--cf-line-strong) p-3 shadow-[2px_2px_0_0_var(--cf-ink)] flex flex-col justify-between">
            <span className="cf-display text-[20px] font-bold block leading-none">1,284</span>
            <p className="text-[9px] text-(--cf-ink-soft) font-mono uppercase font-bold tracking-wider mt-1 opacity-70">
              Responses
            </p>
          </div>
          <div className="bg-white border border-(--cf-line-strong) p-3 shadow-[2px_2px_0_0_var(--cf-ink)] flex flex-col justify-between">
            <span className="cf-display text-[20px] font-bold block leading-none">92.4%</span>
            <p className="text-[9px] text-(--cf-ink-soft) font-mono uppercase font-bold tracking-wider mt-1 opacity-70">
              Rate
            </p>
          </div>
          <div className="bg-white border border-(--cf-line-strong) p-3 shadow-[2px_2px_0_0_var(--cf-ink)] flex flex-col justify-between">
            <span className="cf-display text-[20px] font-bold block leading-none">1:15</span>
            <p className="text-[9px] text-(--cf-ink-soft) font-mono uppercase font-bold tracking-wider mt-1 opacity-70">
              Avg Time
            </p>
          </div>
        </div>

        {/* Question Chart Card */}
        <div className="bg-white border border-(--cf-line-strong) p-4 shadow-[3px_3px_0_0_var(--cf-ink)] space-y-3">
          <div>
            <h3 className="cf-display text-[13.5px] font-bold text-(--cf-ink) uppercase">
              What&rsquo;s the biggest pain in your current workflow?
            </h3>
            <p className="text-[10px] text-(--cf-ink-soft) mt-1 font-mono">1,284 responses</p>
          </div>

          {/* brutalist horizontal bar chart */}
          <div className="border-t border-(--cf-line) pt-3 space-y-2">
            {chartData.map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                  <span>{row.label}</span>
                  <span className="text-(--cf-ink-soft)">
                    {row.count} ({row.pct})
                  </span>
                </div>
                <div className="h-6 w-full border border-(--cf-line-strong) bg-(--cf-cream) relative overflow-hidden">
                  <div
                    className="h-full border-r border-(--cf-line-strong)"
                    style={{
                      width: row.pct,
                      backgroundColor: row.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AnalyticsMock = DashboardMock;

export const CanvasEditorMock = () => {
  const [activeSide, setActiveSide] = useState(0);

  return (
    <div className="border border-(--cf-line-strong) bg-(--cf-cream) flex w-full max-w-295 mx-auto flex-col overflow-hidden shadow-[5px_5px_0_0_var(--cf-ink)] font-sans text-(--cf-ink)">
      {/* top header */}
      <div className="flex items-center justify-between gap-2 border-b border-(--cf-line-strong) bg-(--cf-cream-2) px-3 py-2 sm:px-4 text-[11px] select-none font-mono">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-(--cf-ink-soft)">
            &lt; Forms
          </span>
          <div className="h-3 w-px bg-(--cf-line-strong)" />
          <span className="cf-display truncate font-bold text-[13px]">Customer Feedback</span>
          <span className="inline-flex shrink-0 items-center gap-1 border border-(--cf-orange) px-1.5 py-0.5 text-[9px] text-(--cf-orange) uppercase font-bold tracking-wider">
            <span className="size-1.5 rounded-full bg-(--cf-orange)" />
            Live
          </span>
        </div>

        {/* center */}
        <div className="hidden border border-(--cf-line-strong) sm:inline-flex shrink-0">
          <button className="bg-(--cf-ink) text-(--cf-cream) px-2.5 py-1 text-[9px] font-mono flex items-center gap-1.5 uppercase font-bold cursor-default">
            <LayoutGrid className="size-3.5" />
            Canvas
          </button>
          <button className="text-(--cf-ink-soft) px-2.5 py-1 text-[9px] font-mono flex items-center gap-1.5 uppercase font-bold cursor-default">
            <ListOrdered className="size-3.5" />
            Outline
          </button>
        </div>

        {/* right */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button className="cf-btn-outline h-7 px-2 text-[10px] flex items-center gap-1 cursor-default opacity-40">
            <Save className="size-3" />
            <span className="hidden lg:inline">Save</span>
          </button>
          <button className="cf-btn-outline h-7 px-2 text-[10px] flex items-center gap-1 cursor-default">
            <Eye className="size-3" />
            <span className="hidden lg:inline">Preview</span>
          </button>
          <button className="cf-btn-outline h-7 px-2 text-[10px] flex items-center gap-1 cursor-default">
            <Share2 className="size-3" />
            <span className="hidden lg:inline">Share</span>
          </button>
          <button className="cf-btn h-7 px-3 text-[10px] text-white font-bold flex items-center gap-1 cursor-default bg-(--cf-ink)">
            Published
          </button>
        </div>
      </div>

      {/* main grid */}
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_200px] divide-y sm:divide-y-0 sm:divide-x divide-(--cf-line-strong) min-h-[380px]">
        {/* left: sidebar */}
        <aside className="flex flex-col bg-(--cf-cream-2) select-none">
          <div className="border-b border-(--cf-line-strong) px-3 py-2 flex items-center justify-between">
            <p className="cf-meta text-[10px] font-bold uppercase tracking-wider opacity-60">
              Fields
            </p>
            <span className="font-mono text-[9px] tracking-wider text-(--cf-ink-soft) opacity-60">
              3 of 13
            </span>
          </div>

          <div className="border-b border-(--cf-line-strong) px-3 py-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-2 size-3 -translate-y-1/2 text-(--cf-ink-soft)" />
              <input
                type="text"
                disabled
                placeholder="Search fields..."
                className="w-full bg-white border border-(--cf-line-strong) h-7 pl-6 pr-2 text-[10px] focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 space-y-3 overflow-y-auto">
            <div>
              <p className="cf-meta text-[9px] font-bold uppercase tracking-wider text-(--cf-ink-soft) mb-1.5 px-1">
                Text
              </p>
              <div className="space-y-1">
                {/* Short text */}
                <div
                  onMouseEnter={() => setActiveSide(0)}
                  className={`flex w-full items-center gap-2 border px-2 py-1 text-left select-none ${activeSide === 0 ? "border-(--cf-line-strong) bg-white shadow-[1px_1px_0_0_var(--cf-ink)]" : "border-(--cf-line) bg-(--cf-cream)"}`}
                >
                  <div className="flex size-5.5 shrink-0 items-center justify-center border border-(--cf-line) bg-(--cf-cream)">
                    <Type className="size-2.5 text-(--cf-orange)" />
                  </div>
                  <div className="min-w-0 font-mono">
                    <p className="text-[10px] font-bold leading-none">Short text</p>
                  </div>
                </div>

                {/* Long text */}
                <div
                  onMouseEnter={() => setActiveSide(1)}
                  className={`flex w-full items-center gap-2 border px-2 py-1 text-left select-none ${activeSide === 1 ? "border-(--cf-line-strong) bg-white shadow-[1px_1px_0_0_var(--cf-ink)]" : "border-(--cf-line) bg-(--cf-cream)"}`}
                >
                  <div className="flex size-5.5 shrink-0 items-center justify-center border border-(--cf-line) bg-(--cf-cream)">
                    <AlignLeft className="size-2.5 text-(--cf-orange)" />
                  </div>
                  <div className="min-w-0 font-mono">
                    <p className="text-[10px] font-bold leading-none">Long text</p>
                  </div>
                </div>

                {/* Email */}
                <div
                  onMouseEnter={() => setActiveSide(2)}
                  className={`flex w-full items-center gap-2 border px-2 py-1 text-left select-none ${activeSide === 2 ? "border-(--cf-line-strong) bg-white shadow-[1px_1px_0_0_var(--cf-ink)]" : "border-(--cf-line) bg-(--cf-cream)"}`}
                >
                  <div className="flex size-5.5 shrink-0 items-center justify-center border border-(--cf-line) bg-(--cf-cream)">
                    <Mail className="size-2.5 text-(--cf-orange)" />
                  </div>
                  <div className="min-w-0 font-mono">
                    <p className="text-[10px] font-bold leading-none">Email</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* center: canvas */}
        <div
          className="grow p-6 flex flex-col items-center justify-start bg-(--cf-cream) relative select-none min-h-[360px]"
          style={{
            backgroundImage: "radial-gradient(var(--cf-line-strong) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            backgroundPosition: "center",
          }}
        >
          {/* Canvas header details */}
          <div className="absolute top-2 left-3 text-[9px] font-mono text-(--cf-ink-soft) font-bold uppercase tracking-wider">
            Canvas <span className="opacity-50">2 fields</span>
          </div>

          <div className="absolute top-2 right-3 border border-(--cf-line-strong) bg-(--cf-cream) px-1.5 py-0.5 text-[8px] uppercase font-bold tracking-wider font-mono flex items-center gap-1 text-(--cf-ink-soft)">
            <Lock className="size-2.5 text-(--cf-ink-soft)" />
            Unlocked
          </div>

          {/* SVG edge connector */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <path
              d="M 230 160 C 230 195, 230 195, 230 230"
              stroke="var(--cf-orange)"
              strokeWidth="2"
              fill="none"
              strokeDasharray="4 3"
            />
          </svg>

          <div className="relative z-10 w-full flex flex-col items-center gap-12 mt-6">
            {/* Card 1: Selected Short Text */}
            <div className="w-64 border-2 border-(--cf-orange) bg-white shadow-[4px_4px_0_0_var(--cf-orange)] relative flex flex-col">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full border-2 border-(--cf-line-strong) bg-(--cf-orange)" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 size-2 rounded-full border-2 border-(--cf-line-strong) bg-(--cf-orange)" />

              <div className="flex items-center justify-between border-b border-(--cf-line) px-3 py-1.5 bg-(--cf-cream)">
                <div className="cf-meta inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-(--cf-ink-soft) font-mono">
                  <Type className="size-2.5 text-(--cf-orange)" />
                  <span>Text</span>
                </div>
                <span className="inline-flex items-center border px-1 py-0.5 font-mono text-[8px] tracking-wider uppercase border-(--cf-orange) text-(--cf-orange) font-bold leading-none">
                  Req
                </span>
              </div>

              <div className="p-3 space-y-2">
                <h4 className="cf-display text-[12px] leading-tight text-(--cf-ink) font-bold uppercase">
                  What is your name?
                </h4>
                <div className="w-full bg-white border border-(--cf-line-strong) h-7 px-2 flex items-center text-[10px] text-(--cf-ink-soft)/60 font-mono">
                  Answer here...
                </div>
              </div>
            </div>

            {/* Card 2: Unselected Email */}
            <div className="w-64 border border-(--cf-line-strong) bg-white shadow-[3px_3px_0_0_var(--cf-ink)] relative flex flex-col opacity-90">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full border-2 border-(--cf-line-strong) bg-(--cf-orange)" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 size-2 rounded-full border-2 border-(--cf-line-strong) bg-(--cf-orange)" />

              <div className="flex items-center justify-between border-b border-(--cf-line) px-3 py-1.5 bg-(--cf-cream)">
                <div className="cf-meta inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-(--cf-ink-soft) font-mono">
                  <Mail className="size-2.5 text-(--cf-orange)" />
                  <span>Email</span>
                </div>
                <span className="inline-flex items-center border px-1 py-0.5 font-mono text-[8px] tracking-wider uppercase border-(--cf-orange) text-(--cf-orange) font-bold leading-none">
                  Req
                </span>
              </div>

              <div className="p-3 space-y-2">
                <h4 className="cf-display text-[12px] leading-tight text-(--cf-ink) font-bold uppercase">
                  What is your email address?
                </h4>
                <div className="w-full bg-white border border-(--cf-line-strong) h-7 px-2 flex items-center text-[10px] text-(--cf-ink-soft)/60 font-mono">
                  Answer here...
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* right: inspector */}
        <aside className="flex flex-col bg-(--cf-cream-2) select-none">
          <div className="border-b border-(--cf-line-strong) px-3 py-2 flex items-center justify-between">
            <p className="cf-meta text-[10px] font-bold uppercase tracking-wider opacity-60">
              Inspector
            </p>
            <span className="size-1.5 rounded-full bg-(--cf-orange)" />
          </div>

          <div className="p-3 flex-1 space-y-3 font-mono text-[10px]">
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-wider opacity-60 font-bold block">
                Label
              </span>
              <input
                type="text"
                disabled
                value="What is your name?"
                className="w-full bg-white border border-(--cf-line-strong) h-7 px-2 text-[10px] font-sans font-semibold focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-wider opacity-60 font-bold block">
                Description
              </span>
              <input
                type="text"
                disabled
                placeholder="Optional help text"
                className="w-full bg-white border border-(--cf-line-strong) h-7 px-2 text-[10px] focus:outline-none placeholder:text-(--cf-ink-soft)/50"
              />
            </div>

            <div className="flex items-center justify-between border border-(--cf-line-strong) bg-white p-2 mt-1">
              <span className="font-bold uppercase tracking-wider">Required</span>
              <div className="size-3.5 border border-(--cf-line-strong) bg-(--cf-orange) flex items-center justify-center text-white">
                <Check className="size-2.5" />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-wider opacity-60 font-bold block">
                Placeholder
              </span>
              <input
                type="text"
                disabled
                value="Answer here..."
                className="w-full bg-white border border-(--cf-line-strong) h-7 px-2 text-[10px] focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 border-t border-(--cf-line-strong)">
            <button className="w-full h-8 text-white text-[10px] font-bold uppercase tracking-wider bg-(--cf-orange) border border-(--cf-orange) cursor-default">
              Delete Field
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
