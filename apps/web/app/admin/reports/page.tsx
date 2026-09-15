"use client";

import React from "react";
import { Bug, Check, Circle, Inbox, Lightbulb, MessageSquare, Play, User, X } from "lucide-react";
import { toast } from "sonner";

import { useGetLoggedInUserInfo } from "~/hooks/api/auth";
import {
  useFeedbackStats,
  useListFeedback,
  useUpdateFeedback,
  type FeedbackFilters,
  type FeedbackStatus,
  type FeedbackType,
} from "~/hooks/api/feedback";

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: "Open",
  triaged: "Triaged",
  in_progress: "Ongoing",
  resolved: "Fixed",
  closed: "Closed",
};

const TYPE_META: Record<FeedbackType, { label: string; icon: typeof Bug }> = {
  bug: { label: "Bug", icon: Bug },
  feedback: { label: "Feedback", icon: MessageSquare },
  complaint: { label: "Complaint", icon: X },
  feature_request: { label: "Feature", icon: Lightbulb },
};

const STATUS_TABS: Array<{ id: string; label: string; status?: FeedbackStatus }> = [
  { id: "all", label: "All" },
  { id: "open", label: "Open", status: "open" },
  { id: "in_progress", label: "Ongoing", status: "in_progress" },
  { id: "resolved", label: "Fixed", status: "resolved" },
  { id: "closed", label: "Closed", status: "closed" },
];

const TYPE_TABS: Array<{ id: string; label: string; type?: FeedbackType }> = [
  { id: "all", label: "All kinds" },
  { id: "bug", label: "Bugs", type: "bug" },
  { id: "feedback", label: "Feedback", type: "feedback" },
  { id: "complaint", label: "Complaints", type: "complaint" },
  { id: "feature_request", label: "Features", type: "feature_request" },
];

function timeAgo(value: unknown): string {
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function AdminFeedbackPage() {
  const { userInfo } = useGetLoggedInUserInfo();
  const meId = userInfo?.id;

  const [statusTab, setStatusTab] = React.useState("all");
  const [typeTab, setTypeTab] = React.useState("all");
  const [mineOnly, setMineOnly] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const filters: FeedbackFilters = {
    status: STATUS_TABS.find((t) => t.id === statusTab)?.status,
    type: TYPE_TABS.find((t) => t.id === typeTab)?.type,
    assignedToMe: mineOnly || undefined,
  };

  const { items, total, isLoading } = useListFeedback(filters);
  const { stats } = useFeedbackStats();
  const { updateFeedbackAsync, isPending: isUpdating } = useUpdateFeedback();

  const selected = items.find((i) => i.id === selectedId) ?? null;

  const apply = async (id: string, patch: Record<string, unknown>, done: string) => {
    try {
      await updateFeedbackAsync({ id, ...patch });
      toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update that report");
    }
  };

  const SUMMARY = [
    { label: "Open", value: stats?.open ?? 0 },
    { label: "Ongoing", value: stats?.inProgress ?? 0 },
    { label: "Fixed", value: stats?.resolved ?? 0 },
    { label: "Assigned to me", value: stats?.assignedToMe ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="cf-meta">Triage</p>
        <h1 className="cf-display mt-3 text-[32px] leading-none sm:text-[42px]">
          Reports
          <span style={{ color: "var(--cf-orange)" }}>.</span>
        </h1>
        <p className="mt-3 text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
          Bugs and feedback people have sent from inside the app.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SUMMARY.map((s) => (
          <div key={s.label} className="cf-panel cf-raised p-4">
            <p className="cf-meta">{s.label}</p>
            <p className="cf-display mt-3 text-[28px] leading-none tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setStatusTab(t.id)}
            className="cf-btn-outline h-8 px-3 text-[10px] font-bold tracking-[0.16em] uppercase"
            style={
              statusTab === t.id
                ? { background: "var(--cf-ink)", color: "var(--cf-cream)" }
                : undefined
            }
          >
            {t.label}
          </button>
        ))}

        <span className="mx-1 h-5 w-px" style={{ background: "var(--cf-line)" }} />

        {TYPE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTypeTab(t.id)}
            className="cf-btn-outline h-8 px-3 text-[10px] font-bold tracking-[0.16em] uppercase"
            style={
              typeTab === t.id
                ? { background: "var(--cf-ink)", color: "var(--cf-cream)" }
                : undefined
            }
          >
            {t.label}
          </button>
        ))}

        <span className="mx-1 h-5 w-px" style={{ background: "var(--cf-line)" }} />

        <button
          onClick={() => setMineOnly((v) => !v)}
          className="cf-btn-outline h-8 gap-1.5 px-3 text-[10px] font-bold tracking-[0.16em] uppercase"
          style={mineOnly ? { background: "var(--cf-ink)", color: "var(--cf-cream)" } : undefined}
        >
          <User className="size-3.5" />
          Mine
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── list ── */}
        <div className="cf-panel cf-raised">
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderBottomColor: "var(--cf-line)" }}
          >
            <p className="cf-meta">{isLoading ? "Loading…" : `${total} report${total === 1 ? "" : "s"}`}</p>
          </div>

          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <Inbox className="size-6" style={{ color: "var(--cf-ink-soft)" }} />
              <p className="text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
                Nothing matches these filters.
              </p>
            </div>
          )}

          <ul className="divide-y" style={{ borderColor: "var(--cf-line)" }}>
            {items.map((item) => {
              const meta = TYPE_META[item.type];
              const Icon = meta.icon;
              const active = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setSelectedId(item.id)}
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-(--cf-cream-2)"
                    style={active ? { background: "var(--cf-cream-2)" } : undefined}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className="mt-0.5 size-4 shrink-0"
                        style={{
                          color: item.type === "bug" ? "var(--cf-orange)" : "var(--cf-ink-soft)",
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{item.subject}</p>
                        <p
                          className="mt-1 truncate text-[11px]"
                          style={{ color: "var(--cf-ink-soft)" }}
                        >
                          {item.reporterEmail ?? "anonymous"} · {timeAgo(item.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusPill status={item.status} />
                        {item.assignedTo && (
                          <span className="cf-meta" style={{ color: "var(--cf-ink-soft)" }}>
                            {item.assignedTo === meId ? "me" : (item.assigneeName || "assigned")}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── detail ── */}
        <div className="cf-panel cf-raised p-5">
          {!selected ? (
            <div className="flex h-full min-h-60 flex-col items-center justify-center gap-3 text-center">
              <MessageSquare className="size-6" style={{ color: "var(--cf-ink-soft)" }} />
              <p className="text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
                Pick a report to read it.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="cf-meta">{TYPE_META[selected.type].label}</span>
                  <StatusPill status={selected.status} />
                </div>
                <h2 className="mt-3 text-[18px] leading-snug font-semibold">{selected.subject}</h2>
                <p className="mt-1 text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
                  {selected.reporterName || selected.reporterEmail || "anonymous"}
                  {selected.reporterEmail && selected.reporterName ? ` · ${selected.reporterEmail}` : ""}
                  {" · "}
                  {timeAgo(selected.createdAt)}
                </p>
              </div>

              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{selected.message}</p>

              {/* The two fields that turn "it's broken" into something
                  reproducible, so they are shown, not buried. */}
              <dl className="space-y-2 border-t pt-4" style={{ borderTopColor: "var(--cf-line)" }}>
                <Detail label="Page" value={selected.pageUrl} mono />
                <Detail label="Browser" value={selected.userAgent} mono />
                <Detail
                  label="Assignee"
                  value={
                    selected.assignedTo
                      ? selected.assignedTo === meId
                        ? "You"
                        : selected.assigneeName || selected.assigneeEmail
                      : "Nobody"
                  }
                />
              </dl>

              {/* ── actions ── */}
              <div
                className="flex flex-wrap gap-2 border-t pt-4"
                style={{ borderTopColor: "var(--cf-line)" }}
              >
                {selected.assignedTo === meId ? (
                  <button
                    disabled={isUpdating}
                    onClick={() => apply(selected.id, { claim: false }, "Handed back.")}
                    className="cf-btn-outline h-8 gap-1.5 px-3 text-[10px] font-bold tracking-[0.16em] uppercase disabled:opacity-50"
                  >
                    <User className="size-3.5" />
                    Unassign
                  </button>
                ) : (
                  <button
                    disabled={isUpdating || !meId}
                    onClick={() => apply(selected.id, { claim: true }, "Assigned to you.")}
                    className="cf-btn cf-press h-8 gap-1.5 px-3 text-[10px] font-bold tracking-[0.16em] uppercase disabled:opacity-50"
                  >
                    <User className="size-3.5" />
                    Assign to me
                  </button>
                )}

                <span className="mx-1 h-5 w-px" style={{ background: "var(--cf-line)" }} />

                <StatusButton
                  current={selected.status}
                  target="open"
                  icon={Circle}
                  label="Open"
                  disabled={isUpdating}
                  onPick={(s) => apply(selected.id, { status: s }, "Reopened.")}
                />
                <StatusButton
                  current={selected.status}
                  target="in_progress"
                  icon={Play}
                  label="Ongoing"
                  disabled={isUpdating}
                  onPick={(s) => apply(selected.id, { status: s }, "Marked ongoing.")}
                />
                <StatusButton
                  current={selected.status}
                  target="resolved"
                  icon={Check}
                  label="Fixed"
                  disabled={isUpdating}
                  onPick={(s) => apply(selected.id, { status: s }, "Marked fixed.")}
                />
                <StatusButton
                  current={selected.status}
                  target="closed"
                  icon={X}
                  label="Closed"
                  disabled={isUpdating}
                  onPick={(s) => apply(selected.id, { status: s }, "Closed.")}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: FeedbackStatus }) {
  const tone =
    status === "resolved"
      ? { background: "var(--cf-ink)", color: "var(--cf-cream)" }
      : status === "in_progress"
        ? { background: "var(--cf-orange)", color: "#fff" }
        : status === "closed"
          ? { color: "var(--cf-ink-soft)", border: "1px solid var(--cf-line)" }
          : { border: "1px solid var(--cf-line-strong)" };

  return (
    <span
      className="cf-meta inline-flex shrink-0 items-center px-1.5 py-0.5 text-[9px]"
      style={tone}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function StatusButton({
  current,
  target,
  icon: Icon,
  label,
  disabled,
  onPick,
}: {
  current: FeedbackStatus;
  target: FeedbackStatus;
  icon: typeof Bug;
  label: string;
  disabled?: boolean;
  onPick: (s: FeedbackStatus) => void;
}) {
  const active = current === target;
  return (
    <button
      disabled={disabled || active}
      onClick={() => onPick(target)}
      className="cf-btn-outline h-8 gap-1.5 px-3 text-[10px] font-bold tracking-[0.16em] uppercase disabled:opacity-50"
      style={active ? { background: "var(--cf-ink)", color: "var(--cf-cream)" } : undefined}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function Detail({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <dt className="cf-meta w-18 shrink-0">{label}</dt>
      <dd
        className={`min-w-0 flex-1 text-[12px] break-words ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--cf-ink-soft)" }}
      >
        {value}
      </dd>
    </div>
  );
}
