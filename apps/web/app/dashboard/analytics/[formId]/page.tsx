"use client";

import React, { Suspense, useMemo } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ChevronLeft,
  Clock,
  Layers,
  Minus,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { useGetFormById } from "~/hooks/api/form";
import { useGetProAnalytics, useGetFormAnalytics } from "~/hooks/api/analytics";
import { useGetMe } from "~/hooks/api/user";

// Lazy-load the chart-heavy widgets. They all pull in `recharts`
// (~140kb gzipped) which we don't want in the initial route bundle when
// the user might be a Free-tier viewer redirected straight to the upgrade
// modal. Loading them on the client also keeps SSR fast.
const DowBreakdown = dynamic(
  () => import("~/components/analytics/DowBreakdown").then((m) => m.DowBreakdown),
  { ssr: false, loading: () => <ChartSkeleton title="Day of week" /> },
);
const QuestionDistribution = dynamic(
  () => import("~/components/analytics/QuestionDistribution").then((m) => m.QuestionDistribution),
  { ssr: false, loading: () => <ChartSkeleton title="Question breakdown" /> },
);
const ResponseTimeline = dynamic(
  () => import("~/components/analytics/ResponseTimeline").then((m) => m.ResponseTimeline),
  {
    ssr: false,
    loading: () => <ChartSkeleton title="Response timeline" className="lg:col-span-2" />,
  },
);
const DeviceBreakdown = dynamic(
  () => import("~/components/analytics/DeviceBreakdown").then((m) => m.DeviceBreakdown),
  { ssr: false, loading: () => <ChartSkeleton title="Device breakdown" /> },
);
const FieldCompletionRates = dynamic(
  () => import("~/components/analytics/FieldCompletionRates").then((m) => m.FieldCompletionRates),
  { ssr: false, loading: () => <ChartSkeleton title="Field completion" /> },
);
const TrafficSources = dynamic(
  () => import("~/components/analytics/TrafficSources").then((m) => m.TrafficSources),
  { ssr: false, loading: () => <ChartSkeleton title="Traffic sources" /> },
);
// UpgradeModal is only shown on Free-tier access — load it on demand.
const UpgradeModal = dynamic(
  () => import("~/components/analytics/UpgradeModal").then((m) => m.UpgradeModal),
  { ssr: false },
);

function ChartSkeleton({ title, className }: { title: string; className?: string }) {
  return (
    <div
      className={`bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5 min-h-[260px] flex flex-col ${className ?? ""}`}
    >
      <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">{title}</p>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[color:var(--cf-line-strong)] border-t-[color:var(--cf-orange)] rounded-full animate-spin" />
      </div>
    </div>
  );
}

/* ─── shared mini-cards ──────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div
      className={`bg-[color:var(--cf-cream-2)] rounded-xl ring-1 transition-shadow p-5 ${
        accent
          ? "ring-[color:var(--cf-orange)]/40 hover:ring-[color:var(--cf-orange)]/60"
          : "ring-[color:var(--cf-line)] hover:ring-[color:var(--cf-line-strong)]"
      }`}
    >
      <div className="flex items-start justify-between">
        <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">{label}</p>
        {Icon && <Icon className="size-4 text-[color:var(--cf-orange)]" />}
      </div>
      <p className="mt-5 cf-display text-[30px] leading-none tabular-nums">{value}</p>
      {sub && (
        <p className="mt-2 text-[11px] text-[color:var(--cf-ink-soft)] leading-relaxed">{sub}</p>
      )}
    </div>
  );
}

function PeriodCard({
  label,
  count,
  prior,
  isCurrent,
}: {
  label: string;
  count: number;
  prior?: number;
  isCurrent?: boolean;
}) {
  // delta vs the prior (older) period — positive means growth
  const delta = prior !== undefined ? count - prior : 0;
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor =
    delta > 0
      ? "text-[color:var(--cf-orange)]"
      : delta < 0
        ? "text-[#c1281d]"
        : "text-[color:var(--cf-ink-soft)]";
  return (
    <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5">
      <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">{label}</p>
      <p className="mt-4 cf-display text-[28px] leading-none tabular-nums">{count}</p>
      <p className="mt-1 text-[11px] text-[color:var(--cf-ink-soft)]">
        response{count !== 1 ? "s" : ""}
      </p>
      {isCurrent ? (
        <div className="mt-2 flex items-center gap-1 text-[11px] font-mono text-[color:var(--cf-orange)]">
          <TrendingUp className="size-3" />
          <span>current window</span>
        </div>
      ) : prior !== undefined ? (
        <div className={`mt-2 flex items-center gap-1 text-[11px] font-mono ${trendColor}`}>
          <TrendIcon className="size-3" />
          <span className="tabular-nums">
            {delta > 0 ? "+" : ""}
            {delta} vs prior
          </span>
        </div>
      ) : null}
    </div>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

/* ─── page ──────────────────────────────────────────────────────────── */

function ProAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.formId as string;

  const { hasDetailedAnalytics, isLoading: meLoading } = useGetMe();
  const { form, isLoading: formLoading } = useGetFormById(formId);
  const { proAnalytics, isLoading: proLoading } = useGetProAnalytics(formId);
  const { analytics, isLoading: analyticsLoading } = useGetFormAnalytics(formId);

  const deviceData = useMemo(() => {
    const dv = analytics?.deviceViews ?? [];
    return [
      {
        name: "Desktop",
        value: dv.find((d) => d.device === "desktop")?.count ?? 0,
        color: "#f66f00",
      },
      {
        name: "Mobile",
        value: dv.find((d) => d.device === "mobile")?.count ?? 0,
        color: "#56504a",
      },
      {
        name: "Tablet",
        value: dv.find((d) => d.device === "tablet")?.count ?? 0,
        color: "#d9762a",
      },
    ];
  }, [analytics]);

  if (meLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[color:var(--cf-line-strong)] border-t-[color:var(--cf-orange)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasDetailedAnalytics) {
    return (
      <div className="min-h-[60vh]">
        <UpgradeModal onClose={() => router.push(`/dashboard/analytics?form=${formId}`)} />
      </div>
    );
  }

  if (proLoading || formLoading || analyticsLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[color:var(--cf-line-strong)] border-t-[color:var(--cf-orange)] rounded-full animate-spin" />
          <span className="cf-eyebrow text-[color:var(--cf-ink-soft)]">
            Loading detailed analytics...
          </span>
        </div>
      </div>
    );
  }

  if (!proAnalytics || !form) return null;

  const {
    dowBreakdown,
    trend30d,
    trend60d,
    trend90d,
    velocityFirst24h,
    questionDistribution,
    medianResponseTime,
    returningRate,
    peakDay,
    fieldCompletionRates,
    avgTimeSpentMs,
    topReferrers,
    utmSources,
  } = proAnalytics;

  const new31_60 = trend60d - trend30d;
  const new61_90 = trend90d - trend60d;

  const totalResponses = analytics?.totalResponses ?? trend30d;
  const totalViews = analytics?.totalViews ?? 0;
  const completionRate =
    analytics?.completionRate != null ? analytics.completionRate.toFixed(1) + "%" : "—";
  const avgPerDay = analytics?.avgSubmissionsPerDay ?? 0;
  const dailyTrends = analytics?.dailyTrends ?? [];

  return (
    <div className="space-y-8">
      {/* back nav */}
      <Link
        href={`/dashboard/analytics?form=${formId}`}
        className="inline-flex items-center gap-1.5 text-[12px] font-mono text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-ink)] transition-colors"
      >
        <ChevronLeft className="size-3.5" />
        Back to overview
      </Link>

      {/* header */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-[color:var(--cf-orange)]">
          <Sparkles className="size-4 fill-current" />
          <p className="cf-eyebrow">Pro+ analytics</p>
        </div>
        <h1 className="cf-display text-[36px] sm:text-[44px] leading-[0.95]">{form.title}</h1>
        <p className="mt-3 text-[13px] font-mono text-[color:var(--cf-ink-soft)]">
          {form.isPublished ? "Published" : "Draft"} ·{" "}
          <span className="text-[color:var(--cf-ink)] tabular-nums">{totalResponses}</span> total
          response{totalResponses !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Row 1 — core metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total responses" value={totalResponses} icon={Layers} />
        <StatCard label="Completion rate" value={completionRate} icon={TrendingUp} />
        <StatCard label="Total views" value={totalViews} icon={Clock} />
        <StatCard label="Avg / day" value={avgPerDay.toFixed(1)} icon={Activity} />
        <StatCard
          label="Avg time spent"
          value={formatDuration(avgTimeSpentMs)}
          sub="from open to submit"
          icon={Timer}
          accent
        />
        <StatCard
          label="Returning"
          value={`${returningRate}%`}
          sub="repeat respondents (est.)"
          icon={Users}
          accent
        />
      </div>

      {/* Row 2 — period comparison + velocity + peak day */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <PeriodCard label="Last 30 days" count={trend30d} prior={new31_60} isCurrent />
        <PeriodCard label="Days 31–60" count={new31_60} prior={new61_90} />
        <PeriodCard label="Days 61–90" count={new61_90} />

        <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5">
          <div className="flex items-start justify-between">
            <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Launch velocity</p>
            <Zap className="size-4 text-[color:var(--cf-orange)]" />
          </div>
          <p className="mt-4 cf-display text-[28px] leading-none tabular-nums">
            {velocityFirst24h}
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--cf-ink-soft)]">responses in first 24h</p>
        </div>

        <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5">
          <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Peak day</p>
          <p className="mt-4 cf-display text-[24px] leading-tight">{peakDay ?? "—"}</p>
          <p className="mt-1 text-[11px] text-[color:var(--cf-ink-soft)] leading-relaxed">
            {medianResponseTime != null
              ? `Median: ${
                  medianResponseTime < 60
                    ? `${medianResponseTime} min`
                    : `${(medianResponseTime / 60).toFixed(1)} hr`
                } after publish`
              : "No publish date"}
          </p>
        </div>
      </div>

      {/* Row 3 — timeline + device */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ResponseTimeline totalResponses={totalResponses} trends={dailyTrends} />
        <DeviceBreakdown totalViews={totalViews} deviceData={deviceData} />
      </div>

      {/* Row 4 — day of week + field completion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DowBreakdown dowBreakdown={dowBreakdown} />
        <FieldCompletionRates fieldCompletionRates={fieldCompletionRates} />
      </div>

      {/* Row 5 — traffic sources */}
      <TrafficSources topReferrers={topReferrers} utmSources={utmSources} />

      {/* Row 6 — question distribution */}
      <QuestionDistribution questionDistribution={questionDistribution} />
    </div>
  );
}

export default function ProAnalyticsPageWrapper() {
  return (
    <Suspense>
      <ProAnalyticsPage />
    </Suspense>
  );
}
