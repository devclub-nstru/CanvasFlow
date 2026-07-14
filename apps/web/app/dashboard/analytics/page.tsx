"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useListFormsByUserId, useGetFormById } from "~/hooks/api/form";
import { useGetFormAnalytics, useGetSubmissions } from "~/hooks/api/analytics";
import { useGetMe } from "~/hooks/api/user";
import { useDebounce } from "~/hooks/useDebounce";

import { AnalyticsSidebar } from "~/components/analytics/AnalyticsSidebar";
import { MetricsGrid } from "~/components/analytics/MetricsGrid";
import { StatsRow } from "~/components/analytics/StatsRow";
import { SubmissionsTable } from "~/components/analytics/SubmissionsTable";

// Lazy-load the recharts-backed widgets and the on-demand modal. Keeps the
// initial route bundle lean — recharts alone is ~140kb gzipped.
const ResponseTimeline = dynamic(
  () => import("~/components/analytics/ResponseTimeline").then((m) => m.ResponseTimeline),
  { ssr: false },
);
const DeviceBreakdown = dynamic(
  () => import("~/components/analytics/DeviceBreakdown").then((m) => m.DeviceBreakdown),
  { ssr: false },
);
const UpgradeModal = dynamic(
  () => import("~/components/analytics/UpgradeModal").then((m) => m.UpgradeModal),
  { ssr: false },
);

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
  const [showUpgrade, setShowUpgrade] = useState(false);

  const selectedFormId = searchParams.get("form");

  const setSelectedFormId = (id: string) => {
    router.replace(`/dashboard/analytics?form=${id}`, { scroll: false });
  };

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
  const { hasDetailedAnalytics: isFreeTier } = useGetMe();

  // Auto-select the first form when none is in the URL
  useEffect(() => {
    if (forms && forms.length > 0 && !selectedFormId) {
      const firstForm = forms[0];
      if (firstForm) setSelectedFormId(firstForm.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forms, selectedFormId]);

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
  const totalViews = analytics?.totalViews ?? 0;
  const completionRate =
    (analytics?.completionRate != null ? analytics.completionRate.toFixed(1) : "0.0") + "%";
  const avgPerDay = analytics?.avgSubmissionsPerDay ?? 0;
  const avgPerWeek = analytics?.avgSubmissionsPerWeek ?? 0;
  const peakDay = analytics?.peakDay ?? null;

  const deviceData = useMemo(() => {
    const deviceViews = analytics?.deviceViews ?? [];
    const desktop = deviceViews.find((d) => d.device === "desktop")?.count ?? 0;
    const mobile = deviceViews.find((d) => d.device === "mobile")?.count ?? 0;
    const tablet = deviceViews.find((d) => d.device === "tablet")?.count ?? 0;

    return [
      { name: "Desktop", value: desktop, color: "#f66f00" },
      { name: "Mobile", value: mobile, color: "#56504a" },
      { name: "Tablet", value: tablet, color: "#d9762a" },
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
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-140px)] w-full">
      <AnalyticsSidebar
        isLoadingForms={isLoadingForms}
        forms={forms}
        selectedFormId={selectedFormId}
        setSelectedFormId={setSelectedFormId}
      />

      <div className="flex-1 space-y-6 min-w-0">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[color:var(--cf-line-strong)] border-t-[color:var(--cf-orange)] rounded-full animate-spin" />
              <span className="cf-eyebrow text-[color:var(--cf-ink-soft)]">
                Loading analytics...
              </span>
            </div>
          </div>
        ) : !form ? (
          <div className="h-64 flex items-center justify-center bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] text-center p-8">
            <div className="max-w-xs space-y-2">
              <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">No form selected</p>
              <h4 className="cf-display text-[20px] leading-tight">Pick a form</h4>
              <p className="text-[13px] text-[color:var(--cf-ink-soft)] leading-relaxed">
                Choose a form from the sidebar to load its analytics and response history.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-[color:var(--cf-cream-2)] rounded-xl ring-1 ring-[color:var(--cf-line)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="min-w-0">
                <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Analytics</p>
                <h1 className="mt-2 cf-display text-[28px] sm:text-[32px] leading-tight truncate">
                  {form.title}
                </h1>
                <div className="flex items-center gap-3 mt-2 text-[12px] font-mono text-[color:var(--cf-ink-soft)]">
                  <span>
                    <span className="text-[color:var(--cf-ink)] tabular-nums">
                      {totalResponses}
                    </span>{" "}
                    responses
                  </span>
                  <span>·</span>
                  <span
                    className={`inline-flex items-center gap-1 ${
                      form.isPublished
                        ? "text-[color:var(--cf-orange)]"
                        : "text-[color:var(--cf-ink-soft)]"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        form.isPublished
                          ? "bg-[color:var(--cf-orange)]"
                          : "bg-[color:var(--cf-ink-soft)]/40"
                      }`}
                    />
                    {form.isPublished ? "Published" : "Draft"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                {!isFreeTier ? (
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="inline-flex items-center gap-1.5 h-[36px] px-3.5 bg-[color:var(--cf-cream)] hover:bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line-strong)] text-[color:var(--cf-ink)] rounded-full text-[12.5px] font-medium transition-colors cursor-pointer"
                  >
                    <Sparkles className="size-3.5 text-[color:var(--cf-orange)]" />
                    Detailed
                    <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[color:var(--cf-orange)]/15 text-[color:var(--cf-orange)]">
                      Pro+
                    </span>
                  </button>
                ) : (
                  <Link
                    href={`/dashboard/analytics/${form.id}`}
                    className="group inline-flex items-center gap-1.5 h-[36px] px-3.5 bg-[color:var(--cf-cream)] hover:bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line-strong)] text-[color:var(--cf-ink)] rounded-full text-[12.5px] font-medium transition-colors"
                  >
                    <Sparkles className="size-3.5 text-[color:var(--cf-orange)]" />
                    Detailed analytics
                    <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                )}

                <Link
                  href={`/dashboard/sketches/${form.id}`}
                  className="inline-flex items-center gap-1.5 h-[36px] px-3.5 bg-[color:var(--cf-cream)] hover:bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line-strong)] text-[color:var(--cf-ink)] rounded-full text-[12.5px] font-medium transition-colors"
                >
                  Open builder
                </Link>

                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 h-[36px] px-4 bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white rounded-full text-[12.5px] font-medium transition-colors cursor-pointer"
                >
                  <Download className="size-3.5" />
                  Export CSV
                </button>
              </div>
            </div>

            {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}

            <MetricsGrid
              totalResponses={totalResponses}
              completionRate={completionRate}
              totalViews={totalViews}
              avgPerDay={avgPerDay}
            />

            <StatsRow
              peakDay={peakDay}
              avgPerWeek={avgPerWeek}
              completionRate={analytics?.completionRate ?? 0}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <ResponseTimeline totalResponses={totalResponses} trends={dailyTrends} />
              <DeviceBreakdown totalViews={totalViews} deviceData={deviceData} />
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPageWrapper() {
  return (
    <Suspense>
      <AnalyticsPage />
    </Suspense>
  );
}
