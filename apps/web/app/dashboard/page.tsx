"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  DraftingCompass,
  FileText,
  Inbox,
  Layers,
  PencilRuler,
  Plus,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useDashboard } from "~/providers/dashboard-provider";
import { useGetDashboardStats } from "~/hooks/api/form";
import { useCreatePresentation } from "~/hooks/api/menti/useCreatePresentation";

export default function DashboardPage() {
  const { openCreateFormModal, openCreateMentiModal } = useDashboard();
  const { stats, isLoading } = useGetDashboardStats();
  const { createPresentation } = useCreatePresentation();

  type TrendRange = "7d" | "30d" | "3m";
  const [trendRange, setTrendRange] = useState<TrendRange>("30d");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const RANGE_TABS: Array<{ id: TrendRange; label: string; days: number; subtitle: string }> = [
    { id: "3m", label: "3 months", days: 90, subtitle: "Submissions over the past 90 days" },
    { id: "30d", label: "30 days", days: 30, subtitle: "Submissions over the past 30 days" },
    { id: "7d", label: "7 days", days: 7, subtitle: "Submissions over the past 7 days" },
  ];
  const activeRange = RANGE_TABS.find((r) => r.id === trendRange) ?? RANGE_TABS[1]!;

  const trendData = useMemo(() => {
    const all = stats?.trends ?? [];
    return all.slice(-activeRange.days);
  }, [stats?.trends, activeRange.days]);

  // ── chart summary stats (for the strip above the chart) ──────────────
  const trendSummary = useMemo(() => {
    if (trendData.length === 0) return { total: 0, avgPerDay: 0, peakLabel: "—", peakCount: 0 };
    const total = trendData.reduce((sum, d) => sum + d.count, 0);
    const peak = trendData.reduce((best, d) => (d.count > best.count ? d : best), trendData[0]!);
    return {
      total,
      avgPerDay: total / trendData.length,
      peakLabel: peak.count > 0 ? peak.date : "—",
      peakCount: peak.count,
    };
  }, [trendData]);

  // tick density per range: 7d shows all, 30d every 4th, 3m every ~8th
  const xTickInterval = activeRange.id === "7d" ? 0 : activeRange.id === "30d" ? 3 : 7;

  const totalSketches = stats?.totalSketches ?? 0;
  const publishedSketches = stats?.publishedSketches ?? 0;
  const totalResponses = stats?.totalResponses ?? 0;
  const responsesThisMonth = stats?.responsesThisMonth ?? 0;
  const activePercent =
    totalSketches > 0 ? Math.round((publishedSketches / totalSketches) * 100) : 0;

  const STATS = [
    {
      title: "Total forms",
      val: isLoading ? "—" : String(totalSketches),
      sub: `${publishedSketches} published`,
      icon: DraftingCompass,
    },
    {
      title: "Active forms",
      val: isLoading ? "—" : String(publishedSketches),
      sub: `${activePercent}% of all forms`,
      icon: PencilRuler,
    },
    {
      title: "Total responses",
      val: isLoading ? "—" : String(totalResponses),
      sub: "Across all forms",
      icon: Layers,
    },
    {
      title: "This month",
      val: isLoading ? "—" : String(responsesThisMonth),
      sub: "Submissions collected",
      icon: TrendingUp,
    },
  ];

  const hasTrendData = trendData.length > 0 && trendData.some((t) => t.count > 0);

  return (
    <div className="space-y-10">
      {/* ───── hero ───── */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          {/* Set uppercase and tight, with the accent period as the one spot
              of colour — the same mark the auth headings carry. */}
          <h1 className="cf-display text-[32px] leading-[0.95] uppercase sm:text-[42px] md:text-[52px]">
            Overview
            <span style={{ color: "var(--cf-orange)" }}>.</span>
          </h1>
          <p className="mt-3 max-w-sm font-mono text-[13px] leading-relaxed text-(--cf-ink-soft)">
            Design, publish, and read your forms in one place.
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="cf-btn cf-raised cf-press h-11 self-start px-5 text-[13.5px] md:self-auto flex items-center gap-2"
          >
            <Plus className="size-4" />
            New
          </button>
          
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-(--cf-line-strong) z-50 cf-raised flex flex-col">
               <button 
                  onClick={() => { setIsDropdownOpen(false); openCreateFormModal(); }}
                  className="w-full text-left px-4 py-3 hover:bg-(--cf-cream-2) text-[13px] border-b border-(--cf-line) font-medium text-(--cf-ink) transition-colors"
               >
                  Form
               </button>
               <button 
                  onClick={() => {
                     setIsDropdownOpen(false);
                     openCreateMentiModal();
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-(--cf-cream-2) text-[13px] font-medium text-(--cf-ink) transition-colors"
               >
                  Menti
               </button>
            </div>
          )}
        </div>
      </div>

      {/* ───── stats grid ───── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="cf-panel cf-raised p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="cf-meta">{stat.title}</p>
                <Icon className="size-4 shrink-0" style={{ color: "var(--cf-orange)" }} />
              </div>
              <p className="cf-display mt-4 text-[28px] leading-none tabular-nums sm:mt-5 sm:text-[40px]">
                {stat.val}
              </p>
              <p className="mt-2 text-[12px] text-(--cf-ink-soft)">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ───── trends & recent grid ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        {/* Left: Response trends */}
        <div className="cf-panel cf-raised overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-(--cf-line) p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
            <div>
              <p className="cf-meta">Responses</p>
              <h3 className="cf-display mt-2 text-[22px] leading-tight sm:text-[28px]">
                Response trends
              </h3>
              <p className="mt-1 text-[13px] text-(--cf-ink-soft)">{activeRange.subtitle}</p>
            </div>

            {/* Segmented control, squared and hairlined to match the chrome. */}
            <div
              className="inline-flex shrink-0 self-start border border-(--cf-line-strong) text-[12px] font-medium select-none sm:self-auto"
              role="tablist"
              aria-label="Trend range"
            >
              {RANGE_TABS.map((tab) => {
                const isActive = tab.id === trendRange;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setTrendRange(tab.id)}
                    className="cursor-pointer px-3 py-1.5 transition-colors sm:px-3.5"
                    style={
                      isActive
                        ? { background: "var(--cf-ink)", color: "var(--cf-cream)" }
                        : { color: "var(--cf-ink-soft)" }
                    }
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* mini summary row */}
          <div className="grid grid-cols-3 gap-4 border-b border-(--cf-line) px-4 py-4 sm:gap-8 sm:px-6">
            <SummaryMetric label="Total in range" value={trendSummary.total.toLocaleString()} />
            <SummaryMetric label="Avg / day" value={trendSummary.avgPerDay.toFixed(1)} />
            <SummaryMetric
              label="Peak day"
              value={trendSummary.peakLabel}
              sub={
                trendSummary.peakCount > 0
                  ? `${trendSummary.peakCount} response${trendSummary.peakCount === 1 ? "" : "s"}`
                  : undefined
              }
            />
          </div>

          <div className="relative h-80 sm:h-96 w-full px-2 pt-3 pb-4 sm:px-3">
            {!hasTrendData ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center max-w-sm px-6">
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center border border-(--cf-line-strong) bg-(--cf-cream)">
                    <Inbox className="size-5" style={{ color: "var(--cf-orange)" }} />
                  </div>
                  <p className="cf-meta">Awaiting data</p>
                  <p className="mt-3 text-[13.5px] text-(--cf-ink-soft) leading-relaxed">
                    Publish your first form to start collecting responses and watch trends light up
                    here.
                  </p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 24, right: 24, left: 4, bottom: 12 }}>
                  <defs>
                    <linearGradient id="cf-trend-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--cf-orange)" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="var(--cf-orange)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(26,29,41,0.10)"
                    strokeDasharray="2 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="var(--cf-ink-soft)"
                    opacity={0.55}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={xTickInterval}
                    minTickGap={16}
                  />
                  <YAxis
                    stroke="var(--cf-ink-soft)"
                    opacity={0.55}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    cursor={{
                      stroke: "var(--cf-orange)",
                      strokeOpacity: 0.35,
                      strokeWidth: 1,
                      strokeDasharray: "4 3",
                    }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const count = Number(payload[0]?.value ?? 0);
                      return (
                        <div className="cf-raised border border-(--cf-line-strong) bg-(--cf-cream) px-3 py-2">
                          <p className="cf-meta">{label}</p>
                          <p className="mt-1 text-[13px] font-medium text-(--cf-ink) tabular-nums">
                            <span className="text-(--cf-orange)">{count}</span> response
                            {count === 1 ? "" : "s"}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--cf-orange)"
                    strokeWidth={2.5}
                    fill="url(#cf-trend-gradient)"
                    activeDot={{
                      r: 4,
                      stroke: "var(--cf-orange)",
                      strokeWidth: 2,
                      fill: "var(--cf-cream)",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right: Recent forms */}
        <div className="cf-panel cf-raised p-5 flex flex-col justify-between self-stretch">
          <div className="space-y-4">
            <div className="border-b border-(--cf-line-strong) pb-2.5">
              <p className="cf-meta text-[9px] font-mono font-bold uppercase tracking-wider text-(--cf-ink-soft)">
                Recent
              </p>
              <h3 className="cf-display mt-1 text-[20px] font-bold">
                Forms<span style={{ color: "var(--cf-orange)" }}>.</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {isLoading ? (
                <div className="cf-meta py-8 text-center">Loading</div>
              ) : !stats || stats.recentForms.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <p className="cf-display text-[18px]">No forms yet.</p>
                </div>
              ) : (
                stats.recentForms.map((item) => (
                  <Link
                    key={item.id}
                    href={`/dashboard/sketches/${item.id}`}
                    className="cf-panel cf-raised cf-press group relative flex items-center justify-between gap-4 p-3 bg-white"
                  >
                    <span
                      aria-hidden
                      className="absolute top-0 right-0 h-2.5 w-2.5 border-b border-l border-(--cf-line-strong)"
                      style={{
                        background: item.isPublished ? "var(--cf-orange)" : "var(--cf-ink-soft)",
                      }}
                    />
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center border border-(--cf-line-strong) bg-(--cf-cream)">
                        <FileText className="size-3.5" style={{ color: "var(--cf-orange)" }} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="cf-display truncate text-[14px] leading-tight">
                          {item.title}
                        </h4>
                        <p className="mt-0.5 text-[10px] text-(--cf-ink-soft)">
                          {item.isPublished ? "Published" : "Draft"}
                          <span className="mx-1">·</span>
                          {new Date(item.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pr-1 font-mono text-[11px] text-(--cf-ink-soft)">
                      <span className="tabular-nums text-(--cf-ink) font-bold">
                        {item.submissionsCount}
                      </span>
                      <span>resp.</span>
                    </div>
                  </Link>
                ))
              )}

              <button
                onClick={openCreateFormModal}
                className="group flex h-12 cursor-pointer items-center justify-center border border-dashed border-(--cf-line-strong) bg-(--cf-cream-2) transition-colors hover:bg-white"
              >
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-(--cf-ink-soft) transition-colors group-hover:text-(--cf-ink)">
                  <Plus className="size-3.5" />
                  Start a new form
                </span>
              </button>
            </div>
          </div>

          <Link
            href="/dashboard/sketches"
            className="w-full py-2 border border-(--cf-line-strong) font-mono text-[10px] font-bold uppercase tracking-wider hover:bg-(--cf-cream-2) transition-colors text-center mt-4 block bg-white"
          >
            View all forms
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── chart summary metric ──────────────────────────────────────────── */

function SummaryMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="cf-meta">{label}</p>
      <p className="mt-1.5 cf-display text-[22px] sm:text-[24px] leading-none tabular-nums truncate">
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] font-mono text-(--cf-ink-soft) truncate">{sub}</p>}
    </div>
  );
}
