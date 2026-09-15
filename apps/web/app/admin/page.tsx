"use client";

import React from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  FileText,
  HardDrive,
  Inbox,
  Layers,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";

import { usePlatformStats, type StatsRange } from "~/hooks/api/admin";

const RANGES: Array<{ id: StatsRange; label: string }> = [
  { id: 7, label: "7 days" },
  { id: 30, label: "30 days" },
  { id: 90, label: "90 days" },
];

/* Bytes are stored exactly; people read them in units. */
function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export default function AdminOverviewPage() {
  const [range, setRange] = React.useState<StatsRange>(30);
  const { stats, isLoading } = usePlatformStats(range);

  const num = (v: number | undefined) => (isLoading ? "—" : String(v ?? 0));

  const HEADLINE = [
    {
      label: "Total users",
      value: num(stats?.users.total),
      sub: `${stats?.users.verified ?? 0} verified`,
      icon: Users,
    },
    {
      label: "New this week",
      value: num(stats?.users.newThisWeek),
      sub: `${stats?.users.newThisMonth ?? 0} this month`,
      icon: UserPlus,
    },
    {
      label: "Total submissions",
      value: num(stats?.submissions.total),
      sub: `${stats?.submissions.today ?? 0} today`,
      icon: Layers,
    },
    {
      label: "Forms",
      value: num(stats?.forms.total),
      sub: `${stats?.forms.published ?? 0} published`,
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="cf-meta">Overview</p>
          <h1 className="cf-display mt-3 text-[32px] leading-none sm:text-[42px]">
            Platform
            <span style={{ color: "var(--cf-orange)" }}>.</span>
          </h1>
          <p className="mt-3 text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
            Every account and every form, not just your own.
          </p>
        </div>

        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className="cf-btn-outline h-8 px-3 text-[10px] font-bold tracking-[0.16em] uppercase"
              style={
                range === r.id ? { background: "var(--cf-ink)", color: "var(--cf-cream)" } : undefined
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── headline numbers ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {HEADLINE.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="cf-panel cf-raised p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="cf-meta">{s.label}</p>
                <Icon className="size-4 shrink-0" style={{ color: "var(--cf-orange)" }} />
              </div>
              <p className="cf-display mt-4 text-[28px] leading-none tabular-nums sm:text-[38px]">
                {s.value}
              </p>
              <p className="mt-2 text-[12px]" style={{ color: "var(--cf-ink-soft)" }}>
                {s.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── trends ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendPanel
          title="Submissions"
          subtitle={`Responses collected over the past ${range} days`}
          data={stats?.submissionTrend ?? []}
          isLoading={isLoading}
        />
        <TrendPanel
          title="Signups"
          subtitle={`New accounts over the past ${range} days`}
          data={stats?.signupTrend ?? []}
          isLoading={isLoading}
        />
      </div>

      {/* ── breakdowns ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="cf-panel cf-raised p-5">
          <p className="cf-meta">How people sign in</p>
          {/* Deliberately not a percentage of all users: one account can hold
              both a password and a Google login, so these overlap. */}
          <dl className="mt-4 space-y-3">
            <Row label="Password" value={num(stats?.providers.credential)} />
            <Row label="Google" value={num(stats?.providers.google)} />
            <Row label="GitHub" value={num(stats?.providers.github)} />
          </dl>
          <p className="mt-4 text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
            An account can have more than one, so these overlap.
          </p>
        </div>

        <div className="cf-panel cf-raised p-5">
          <p className="cf-meta">Forms &amp; storage</p>
          <dl className="mt-4 space-y-3">
            <Row label="Published" value={num(stats?.forms.published)} />
            <Row label="Archived" value={num(stats?.forms.archived)} />
            <Row label="Uploads" value={num(stats?.uploads.total)} />
            <Row
              label="Storage used"
              value={isLoading ? "—" : formatBytes(stats?.uploads.storageBytes ?? 0)}
              icon={HardDrive}
            />
            {!isLoading && (stats?.uploads.failed ?? 0) > 0 && (
              <Row
                label="Failed uploads"
                value={String(stats?.uploads.failed)}
                icon={TriangleAlert}
                warn
              />
            )}
          </dl>
        </div>

        <div className="cf-panel cf-raised p-5">
          <p className="cf-meta">Access &amp; reports</p>
          <dl className="mt-4 space-y-3">
            <Row label="Admins" value={num(stats?.users.admins)} icon={ShieldCheck} />
            <Row label="Open reports" value={num(stats?.feedback.open)} icon={Inbox} />
            <Row label="Reports all time" value={num(stats?.feedback.total)} />
          </dl>
          <Link
            href="/admin/reports"
            className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold underline underline-offset-2"
          >
            Go to reports
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  icon: Icon,
  warn,
}: {
  label: string;
  value: string;
  icon?: typeof Users;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
        {Icon && <Icon className="size-3.5" style={warn ? { color: "var(--cf-orange)" } : undefined} />}
        {label}
      </dt>
      <dd
        className="text-[15px] font-semibold tabular-nums"
        style={warn ? { color: "var(--cf-orange)" } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function TrendPanel({
  title,
  subtitle,
  data,
  isLoading,
}: {
  title: string;
  subtitle: string;
  data: Array<{ date: string; count: number }>;
  isLoading: boolean;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const hasData = data.some((d) => d.count > 0);

  /* Enough ticks to orient, not so many they collide. */
  const interval = data.length <= 7 ? 0 : data.length <= 30 ? 3 : 9;

  return (
    <div className="cf-panel cf-raised p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="cf-meta">{title}</p>
          <p className="mt-2 text-[12px]" style={{ color: "var(--cf-ink-soft)" }}>
            {subtitle}
          </p>
        </div>
        <p className="cf-display text-[24px] leading-none tabular-nums">
          {isLoading ? "—" : total}
        </p>
      </div>

      <div className="mt-5 h-44">
        {!hasData ? (
          <div className="flex h-full items-center justify-center">
            <p className="cf-meta" style={{ color: "var(--cf-ink-soft)" }}>
              {isLoading ? "Loading…" : "Awaiting data"}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id={`fill-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cf-orange)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--cf-orange)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--cf-line)" vertical={false} />
              <XAxis
                dataKey="date"
                interval={interval}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--cf-ink-soft)" }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={40}
                tick={{ fontSize: 10, fill: "var(--cf-ink-soft)" }}
              />
              <ChartTooltip
                cursor={{ stroke: "var(--cf-line-strong)", strokeWidth: 1 }}
                contentStyle={{
                  background: "#fff",
                  border: "1px solid var(--cf-line-strong)",
                  borderRadius: 0,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--cf-orange)"
                strokeWidth={2}
                fill={`url(#fill-${title})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
