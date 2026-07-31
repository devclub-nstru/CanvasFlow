"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { useListFormsByUserId, useGetFormById } from "~/hooks/api/form";
import {
  useGetFormAnalytics,
  useGetDetailedAnalytics,
  useGetSubmissions,
} from "~/hooks/api/analytics";
import { useDebounce } from "~/hooks/useDebounce";

import { AnalyticsFormPicker } from "~/components/analytics/AnalyticsFormPicker";
import { MetricsGrid } from "~/components/analytics/MetricsGrid";
import { StatsRow } from "~/components/analytics/StatsRow";
import { SubmissionsTable } from "~/components/analytics/SubmissionsTable";
import { DEVICE_COLORS } from "~/components/analytics/palette";

const ResponseTimeline = dynamic(
  () => import("~/components/analytics/ResponseTimeline").then((m) => m.ResponseTimeline),
  { ssr: false },
);
const DeviceBreakdown = dynamic(
  () => import("~/components/analytics/DeviceBreakdown").then((m) => m.DeviceBreakdown),
  { ssr: false },
);
const QuestionDistribution = dynamic(
  () => import("~/components/analytics/QuestionDistribution").then((m) => m.QuestionDistribution),
  { ssr: false },
);
const TrafficSources = dynamic(
  () => import("~/components/analytics/TrafficSources").then((m) => m.TrafficSources),
  { ssr: false },
);
const FieldDropoff = dynamic(
  () => import("~/components/analytics/FieldDropoff").then((m) => m.FieldDropoff),
  { ssr: false },
);
const PeriodComparison = dynamic(
  () => import("~/components/analytics/PeriodComparison").then((m) => m.PeriodComparison),
  { ssr: false },
);
const EngagementStats = dynamic(
  () => import("~/components/analytics/EngagementStats").then((m) => m.EngagementStats),
  { ssr: false },
);

type TabId = "summary" | "responses" | "dropoff" | "segments";

const TABS: { id: TabId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "responses", label: "Responses" },
  { id: "dropoff", label: "Drop-off" },
  { id: "segments", label: "Segments" },
];

interface SubmissionValue {
  formFieldId: string;
  value: any;
}

interface Submission {
  id: string;
  formId: string;
  values: SubmissionValue[];
  createdAt: string;
}

export function AnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  // Debounce so filtering and any future expensive operations on the
  // submissions list don't run on every keystroke.
  const debouncedSearchQuery = useDebounce(searchQuery, 200);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);

  const [tab, setTab] = useState<TabId>("summary");

  const selectedFormId = searchParams.get("form");

  // Memoised so the auto-select effect below can depend on it honestly. As a
  // plain function it was reallocated every render, which is why that effect
  // needed an exhaustive-deps suppression to avoid firing on every pass.
  const setSelectedFormId = useCallback(
    (id: string) => {
      router.replace(`/dashboard/analytics?form=${id}`, { scroll: false });
    },
    [router],
  );

  const { forms, isLoading: isLoadingForms } = useListFormsByUserId();
  const { form, isLoading: isLoadingForm } = useGetFormById(selectedFormId || "");
  const { analytics, isLoading: isLoadingAnalytics } = useGetFormAnalytics(selectedFormId || "");
  const {
    submissions,
    isLoading: isLoadingSubmissions,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useGetSubmissions(selectedFormId || "");
  // No longer conditional on a subscription tier — every signed-in owner gets
  // the detailed breakdown, so the query runs whenever a form is selected.
  const { detailedAnalytics } = useGetDetailedAnalytics(selectedFormId || "");

  // Auto-select the first form when none is in the URL.
  useEffect(() => {
    if (forms && forms.length > 0 && !selectedFormId) {
      const firstForm = forms[0];
      if (firstForm) setSelectedFormId(firstForm.id);
    }
  }, [forms, selectedFormId, setSelectedFormId]);

  const getRespondentDetails = useCallback(
    (sub: Submission) => {
      let name = "Anonymous";
      let email = "no-email@anonymous.com";

      if (form?.fields) {
        const emailField = form.fields.find(
          (f) => f.type === "EMAIL" || f.label.toLowerCase().includes("email"),
        );
        if (emailField) {
          const val = sub.values.find((v) => v.formFieldId === emailField.id);
          if (val?.value) email = String(val.value);
        }

        const nameField = form.fields.find(
          (f) =>
            f.type === "TEXT" &&
            (f.label.toLowerCase().includes("name") ||
              f.label.toLowerCase().includes("respondent")),
        );
        if (nameField) {
          const val = sub.values.find((v) => v.formFieldId === nameField.id);
          if (val?.value) name = String(val.value);
        } else if (email && email !== "no-email@anonymous.com") {
          name = email.split("@")[0] || "Anonymous";
        }
      }
      return { name, email };
    },
    [form],
  );

  const handleExportCSV = () => {
    if (!form || !submissions || submissions.length === 0) {
      toast.error("No submissions available to export");
      return;
    }

    const headers = ["Submission ID", "Submitted At"];
    form.fields.forEach((f) => headers.push(f.label));
    const csvRows = [headers.join(",")];

    submissions.forEach((sub) => {
      const row = [sub.id, new Date(sub.createdAt).toLocaleString()];
      form.fields.forEach((f) => {
        const answer = sub.values.find((v) => v.formFieldId === f.id);
        let valStr = "";
        if (answer?.value !== undefined && answer?.value !== null) {
          if (Array.isArray(answer.value)) {
            valStr = `"${answer.value.join("; ")}"`;
          } else {
            valStr = `"${String(answer.value).replace(/"/g, '""')}"`;
          }
        }
        row.push(valStr);
      });
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${form.title.toLowerCase().replace(/\s+/g, "_")}_submissions.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV downloaded");
  };

  // Derived metrics
  const totalResponses = analytics?.totalResponses ?? 0;
  const avgPerDay = analytics?.avgSubmissionsPerDay ?? 0;
  const avgPerWeek = analytics?.avgSubmissionsPerWeek ?? 0;
  const peakDay = analytics?.peakDay ?? null;

  const deviceData = useMemo(() => {
    const deviceBreakdown = analytics?.deviceBreakdown ?? [];
    const desktop = deviceBreakdown.find((d) => d.device === "desktop")?.count ?? 0;
    const mobile = deviceBreakdown.find((d) => d.device === "mobile")?.count ?? 0;
    const tablet = deviceBreakdown.find((d) => d.device === "tablet")?.count ?? 0;

    return [
      { name: "Desktop", value: desktop, color: DEVICE_COLORS.Desktop },
      { name: "Mobile", value: mobile, color: DEVICE_COLORS.Mobile },
      { name: "Tablet", value: tablet, color: DEVICE_COLORS.Tablet },
    ];
  }, [analytics]);

  const dailyTrends = analytics?.dailyTrends ?? [];

  const filteredSubmissions = useMemo(() => {
    const matchQuery = debouncedSearchQuery.toLowerCase();
    return submissions.filter((sub) => {
      const details = getRespondentDetails(sub);
      return (
        details.name.toLowerCase().includes(matchQuery) ||
        details.email.toLowerCase().includes(matchQuery) ||
        sub.id.toLowerCase().includes(matchQuery)
      );
    });
  }, [submissions, debouncedSearchQuery, getRespondentDetails]);

  const isLoading = isLoadingForm || isLoadingAnalytics || isLoadingSubmissions;

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="cf-display text-[32px] leading-[0.95] uppercase sm:text-[42px] md:text-[52px]">
          Analytics
          <span style={{ color: "var(--cf-orange)" }}>.</span>
        </h1>
        <p className="mt-3 max-w-sm font-mono text-[13px] leading-relaxed text-(--cf-ink-soft)">
          Read the numbers behind every form you publish.
        </p>
      </div>

      <AnalyticsFormPicker
        isLoadingForms={isLoadingForms}
        forms={forms}
        selectedFormId={selectedFormId}
        setSelectedFormId={setSelectedFormId}
      />

      <div className="min-w-0 space-y-6">
        {isLoading ? (
          <div className="cf-panel cf-raised flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-8 animate-spin rounded-full border-2 border-(--cf-line) border-t-(--cf-orange)" />
              <span className="cf-meta">Loading analytics</span>
            </div>
          </div>
        ) : !form ? (
          <div className="cf-panel cf-raised flex h-64 items-center justify-center p-8 text-center">
            <div className="max-w-xs space-y-2">
              <p className="cf-meta">No form selected</p>
              <h4 className="cf-display text-[24px] leading-tight uppercase">Pick a form</h4>
              <p className="text-[13px] text-(--cf-ink-soft) leading-relaxed">
                Choose a form from the sidebar to load its analytics and response history.
              </p>
            </div>
          </div>
        ) : (
          <div className="cf-panel cf-raised overflow-hidden">
            {/* chrome bar */}
            <div
              className="flex items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-6"
              style={{ borderBottomColor: "var(--cf-line-strong)" }}
            >
              <span className="truncate text-[12px] font-medium">CanvasFlow · {form.title}</span>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/dashboard/sketches/${form.id}`}
                  className="cf-btn-outline h-8 px-3 text-[11px]"
                >
                  Edit
                </Link>
                <button
                  onClick={handleExportCSV}
                  className="cf-btn h-8 px-3 text-[11px]"
                  style={{ background: "var(--cf-ink)" }}
                >
                  <Download className="size-3.5" />
                  Export
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <h2 className="cf-display text-[20px] leading-tight sm:text-[27px]">
                {form.title} · Overview
              </h2>
              <p
                className="mt-1.5 text-[13px] leading-relaxed"
                style={{ color: "var(--cf-ink-soft)" }}
              >
                Live breakdown of responses across time, devices, and questions.
              </p>

              <div
                className="custom-scrollbar mt-5 flex items-center gap-5 overflow-x-auto border-b sm:gap-7"
                style={{ borderBottomColor: "var(--cf-line-strong)" }}
                role="tablist"
                aria-label="Analytics sections"
              >
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className="cf-tab shrink-0"
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="pt-5">
                <MetricsGrid totalResponses={totalResponses} avgPerDay={avgPerDay} />
              </div>

              <div className="pt-5">
                {tab === "summary" && (
                  <div className="space-y-5">
                    <StatsRow peakDay={peakDay} avgPerWeek={avgPerWeek} />
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                      <ResponseTimeline totalResponses={totalResponses} trends={dailyTrends} />
                      <DeviceBreakdown deviceData={deviceData} />
                    </div>
                    {/* Waits on the detailed query rather than gating on a
                        plan — the trend buckets simply aren't loaded yet. */}
                    {detailedAnalytics && (
                      <div className="grid grid-cols-1 gap-5">
                        <PeriodComparison
                          trend30d={detailedAnalytics.trend30d}
                          trend60d={detailedAnalytics.trend60d}
                          trend90d={detailedAnalytics.trend90d}
                        />
                      </div>
                    )}
                  </div>
                )}

                {tab === "responses" && (
                  <SubmissionsTable
                    filteredSubmissions={filteredSubmissions as Submission[]}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    getRespondentDetails={getRespondentDetails}
                    setViewingSubmission={setViewingSubmission}
                    viewingSubmission={viewingSubmission}
                    form={form}
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    fetchNextPage={fetchNextPage}
                  />
                )}

                {tab === "dropoff" && (
                  <div className="space-y-5">
                    <FieldDropoff
                      fieldCompletionRates={detailedAnalytics?.fieldCompletionRates ?? []}
                      fields={form.fields ?? []}
                      submissions={submissions as Submission[]}
                    />
                    <QuestionDistribution
                      questionDistribution={detailedAnalytics?.questionDistribution ?? []}
                    />
                  </div>
                )}

                {tab === "segments" && (
                  <div className="space-y-8">
                    <SegmentGroup
                      label="Engagement"
                      hint="How long people take, and how quickly they arrive."
                    >
                      <EngagementStats
                        avgTimeSpentMs={detailedAnalytics?.avgTimeSpentMs ?? null}
                        medianResponseTime={detailedAnalytics?.medianResponseTime ?? null}
                        returningRate={detailedAnalytics?.returningRate ?? 0}
                        velocityFirst24h={detailedAnalytics?.velocityFirst24h ?? 0}
                      />
                    </SegmentGroup>

                    <SegmentGroup label="Acquisition" hint="Where the responses came from.">
                      <TrafficSources topReferrers={detailedAnalytics?.topReferrers ?? []} />
                    </SegmentGroup>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SegmentGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        className="mb-4 flex items-baseline justify-between gap-3 border-b pb-2"
        style={{ borderBottomColor: "var(--cf-line)" }}
      >
        <h3 className="cf-meta">{label}</h3>
        <p className="truncate text-right text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
          {hint}
        </p>
      </div>
      {children}
    </section>
  );
}

export default function AnalyticsPageWrapper() {
  return (
    <Suspense>
      <AnalyticsPage />
    </Suspense>
  );
}
