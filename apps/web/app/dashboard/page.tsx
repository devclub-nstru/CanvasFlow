"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
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

export default function DashboardPage() {
  const { openCreateFormModal } = useDashboard();
  const { stats, isLoading } = useGetDashboardStats();

  // Time-range tabs for the "Response trends" chart. The server returns 90
  // days of daily counts; slicing here keeps tab switching instant.
  type TrendRange = "7d" | "30d" | "3m";
  const [trendRange, setTrendRange] = useState<TrendRange>("30d");

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
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
        <div>
          <h1 className="cf-display text-[36px] sm:text-[48px] md:text-[56px] leading-[0.95]">
            Good morning.
          </h1>
          <p className="mt-3 text-[14.5px] text-[color:var(--cf-ink-soft)] leading-relaxed max-w-md">
            Here&apos;s what&apos;s happening in your studio today.
          </p>
        </div>
        <button
          onClick={openCreateFormModal}
          className="group inline-flex items-center justify-center gap-1.5 h-[44px] px-5 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white rounded-full text-[13.5px] font-medium tracking-tight transition-colors self-start md:self-auto"
        >
          <Plus className="size-4" />
          New form
        </button>
      </div>

      {/* ───── stats grid ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] hover:ring-[color:var(--cf-line-strong)] transition-shadow p-5"
            >
              <div className="flex items-start justify-between">
                <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">{stat.title}</p>
                <Icon className="size-4 text-[color:var(--cf-orange)]" />
              </div>
              <p className="mt-5 cf-display text-[40px] leading-none">{stat.val}</p>
              <p className="mt-2 text-[12px] text-[color:var(--cf-ink-soft)]">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ───── response trends ───── */}
      <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[color:var(--cf-line)] flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
          <div>
            <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Analytics</p>
            <h3 className="mt-2 cf-display text-[24px] sm:text-[28px] leading-tight">
              Response trends
            </h3>
            <p className="mt-1 text-[13px] text-[color:var(--cf-ink-soft)]">
              {activeRange.subtitle}
            </p>
          </div>

          <div className="inline-flex bg-[color:var(--cf-cream)] p-1 rounded-full text-[12px] font-medium select-none shrink-0 self-start sm:self-auto ring-1 ring-[color:var(--cf-line)]">
            {RANGE_TABS.map((tab) => {
              const isActive = tab.id === trendRange;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTrendRange(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
                    isActive
                      ? "bg-[color:var(--cf-cream-2)] text-[color:var(--cf-ink)] ring-1 ring-[color:var(--cf-line-strong)]"
                      : "text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-ink)]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* mini summary row */}
        <div className="px-5 sm:px-6 py-4 border-b border-[color:var(--cf-line)] grid grid-cols-3 gap-4 sm:gap-8">
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
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[color:var(--cf-cream)] flex items-center justify-center ring-1 ring-[color:var(--cf-line)]">
                  <Inbox className="size-5 text-[color:var(--cf-orange)]" />
                </div>
                <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Awaiting data</p>
                <p className="mt-3 text-[13.5px] text-[color:var(--cf-ink-soft)] leading-relaxed">
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
                    <stop offset="0%" stopColor="#f66f00" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#f66f00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgba(22,19,17,0.06)"
                  strokeDasharray="2 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#56504a"
                  opacity={0.55}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={xTickInterval}
                  minTickGap={16}
                />
                <YAxis
                  stroke="#56504a"
                  opacity={0.55}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                />
                <ChartTooltip
                  cursor={{
                    stroke: "#f66f00",
                    strokeOpacity: 0.35,
                    strokeWidth: 1,
                    strokeDasharray: "4 3",
                  }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const count = Number(payload[0]?.value ?? 0);
                    return (
                      <div className="bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line-strong)] rounded-lg px-3 py-2 shadow-[0_10px_30px_-12px_rgba(22,19,17,0.18)]">
                        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)] text-[10px]">
                          {label}
                        </p>
                        <p className="mt-1 text-[13px] font-medium text-[color:var(--cf-ink)] tabular-nums">
                          <span className="text-[color:var(--cf-orange)]">{count}</span> response
                          {count === 1 ? "" : "s"}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#f66f00"
                  strokeWidth={2.5}
                  fill="url(#cf-trend-gradient)"
                  activeDot={{
                    r: 4,
                    stroke: "#f66f00",
                    strokeWidth: 2,
                    fill: "var(--cf-cream)",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ───── recent forms ───── */}
      <div className="space-y-4">
        <div className="flex justify-between items-end pb-3 border-b border-[color:var(--cf-line)]">
          <div>
            <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Recent</p>
            <h3 className="mt-2 cf-display text-[24px] sm:text-[28px] leading-tight">Forms</h3>
          </div>
          <Link
            href="/dashboard/sketches"
            className="group inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-orange)] transition-colors"
          >
            View all
            <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            <div className="py-8 text-center text-[13px] text-[color:var(--cf-ink-soft)] md:col-span-2">
              Loading...
            </div>
          ) : !stats || stats.recentForms.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[color:var(--cf-ink-soft)] md:col-span-2">
              No forms yet. Create your first one below.
            </div>
          ) : (
            stats.recentForms.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/sketches/${item.id}`}
                className="group bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] hover:ring-[color:var(--cf-line-strong)] p-4 flex items-center justify-between gap-4 transition-shadow"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-md bg-[color:var(--cf-cream)] flex items-center justify-center shrink-0 ring-1 ring-[color:var(--cf-line)]">
                    <FileText className="size-4 text-[color:var(--cf-orange)]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="cf-display text-[18px] leading-tight truncate">{item.title}</h4>
                    <p className="text-[12px] text-[color:var(--cf-ink-soft)] mt-0.5">
                      {item.isPublished ? "Published" : "Draft"}
                      <span className="mx-1.5">·</span>
                      {new Date(item.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[12px] font-mono text-[color:var(--cf-ink-soft)] shrink-0">
                  <span className="text-[color:var(--cf-ink)]">{item.submissionsCount}</span>
                  <span>resp.</span>
                  <ArrowUpRight className="size-3.5 text-[color:var(--cf-ink-soft)] group-hover:text-[color:var(--cf-orange)] transition-colors" />
                </div>
              </Link>
            ))
          )}

          {/* "start new form" placeholder card */}
          <button
            onClick={openCreateFormModal}
            className="group bg-[color:var(--cf-cream)]/40 rounded-xl ring-1 ring-dashed ring-[color:var(--cf-line-strong)] hover:ring-[color:var(--cf-orange)] p-5 flex items-center justify-center min-h-[88px] transition-all cursor-pointer"
          >
            <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[color:var(--cf-ink-soft)] group-hover:text-[color:var(--cf-orange)] transition-colors">
              <Plus className="size-4" />
              Start a new form
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── chart summary metric ──────────────────────────────────────────── */

function SummaryMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">{label}</p>
      <p className="mt-1.5 cf-display text-[22px] sm:text-[24px] leading-none tabular-nums truncate">
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] font-mono text-[color:var(--cf-ink-soft)] truncate">{sub}</p>
      )}
    </div>
  );
}
