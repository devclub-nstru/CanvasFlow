"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  Share2,
  Edit3,
  FileText,
  Eye,
  X,
  Clock,
  Inbox,
  Mail,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart,
} from "recharts";
import { useGetSubmissions } from "~/hooks/api/analytics";
import { getFieldOptionsArray } from "~/components/builder/FormFieldNode";
import { apiOrigin, downloadUrlFor } from "~/lib/upload";
import { useUnarchiveForm } from "~/hooks/api/form";
import { toast } from "sonner";

// Helper to resolve absolute API URL if path is relative
const resolveFileUrl = (urlVal: string | null | undefined): string => {
  if (!urlVal) return "";
  if (urlVal.startsWith("http://") || urlVal.startsWith("https://")) {
    return urlVal;
  }
  const origin = apiOrigin();
  const cleanPath = urlVal.startsWith("/") ? urlVal : `/${urlVal}`;
  return `${origin}${cleanPath}`;
};

const FileUploadCell = ({ val }: { val: any }) => {
  // Normalize value to array of files (filtering empty values)
  const items = Array.isArray(val) ? val : [val].filter(Boolean);

  if (items.length === 0) {
    return <span className="italic text-(--cf-ink-soft) text-[13px]">No file uploaded</span>;
  }

  return (
    <span className="flex flex-col gap-1.5">
      {items.map((item, idx) => {
        const url = typeof item === "string" ? item : item?.url;
        const name =
          typeof item === "string"
            ? item.split("/").pop()
            : item?.originalName || item?.name || "Uploaded File";
        const fileUrl = resolveFileUrl(url);
        const dlUrl = downloadUrlFor(fileUrl, name);

        if (!fileUrl) {
          return (
            <span key={idx} className="italic text-(--cf-ink-soft) text-[13px]">
              No link available
            </span>
          );
        }

        return (
          <span key={idx} className="inline-flex items-center gap-2 flex-wrap text-[13px]">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-indigo-600 font-semibold hover:underline"
              title="Open file in new tab"
            >
              <FileText className="size-3.5" />
              <span>{name}</span>
            </a>
            <span className="text-(--cf-line-strong) font-mono">|</span>
            <a
              href={dlUrl}
              download={name}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-mono text-(--cf-ink-soft) hover:text-(--cf-ink) hover:underline"
              title="Download file"
            >
              <Download className="size-3" />
              <span>Download</span>
            </a>
          </span>
        );
      })}
    </span>
  );
};

// Standard CanvasFlow retro-modern theme colors
const CHART_COLORS = [
  "#d95d39", // coral/orange
  "#d4a359", // amber/gold
  "#2a9d8f", // teal/emerald
  "#5c54ed", // indigo
  "#0ea5e9", // sky
  "#ec4899", // pink
];

interface ResponsesViewProps {
  formId: string;
  fields: any[];
  segments?: any[];
  submissionsCount?: number;
  formTitle?: string;
  onNavigateTab?: (tab: "questions" | "responses") => void;
  onShare?: () => void;
  isArchived?: boolean;
  role?: "owner" | "editor" | "viewer";
}

export function ResponsesView({
  formId,
  fields,
  formTitle = "Onboarding Survey",
  onNavigateTab,
  onShare,
  isArchived = false,
  role,
}: ResponsesViewProps) {
  const { submissions, isLoading } = useGetSubmissions(formId);
  const { unarchiveFormAsync, isPending: isUnarchiving } = useUnarchiveForm();
  const [subTab, setSubTab] = useState<"summary" | "question" | "responses">("summary");

  // Selected question for the Question sub-tab
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [viewingSub, setViewingSub] = useState<any>(null);

  // Set default selected field once fields load
  React.useEffect(() => {
    if (fields.length > 0 && !selectedFieldId) {
      setSelectedFieldId(fields[0].id);
    }
  }, [fields, selectedFieldId]);

  // Export CSV
  const handleExportCsv = () => {
    if (submissions.length === 0) return;
    const headers = ["Submission ID", "Submitted At", "Respondent Email", "Device Type"];
    fields.forEach((f) => headers.push(f.label || "Untitled Question"));

    const rows = submissions.map((sub) => {
      const metadata = [
        sub.id,
        new Date(sub.createdAt).toLocaleString(),
        sub.respondentEmail || "Anonymous",
        sub.deviceType || "Unknown",
      ];
      const fieldValues = fields.map((f) => {
        const valObj = sub.values.find((v: any) => v.formFieldId === f.id);
        const val = valObj ? valObj.value : "";
        if (Array.isArray(val)) return `"${val.join(", ")}"`;
        if (typeof val === "object" && val !== null) return `"${JSON.stringify(val)}"`;
        return `"${String(val ?? "").replace(/"/g, '""')}"`;
      });
      return [...metadata, ...fieldValues];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `responses_${formId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // General summary metrics
  const summaryMetrics = useMemo(() => {
    const totalCount = submissions.length;
    const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };
    let totalTime = 0;
    let timeCount = 0;

    submissions.forEach((sub) => {
      const dev = (sub.deviceType || "desktop").toLowerCase();
      if (dev.includes("mobile")) deviceCounts.mobile++;
      else if (dev.includes("tablet")) deviceCounts.tablet++;
      else deviceCounts.desktop++;

      if (sub.timeSpentMs && sub.timeSpentMs > 0) {
        totalTime += sub.timeSpentMs;
        timeCount++;
      }
    });

    const avgTimeMs = timeCount > 0 ? totalTime / timeCount : 0;
    const totalSecs = Math.round(avgTimeMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const formattedAvgTime = totalSecs > 0 ? `${mins}:${secs < 10 ? "0" : ""}${secs}` : "—";

    return {
      total: totalCount,
      completionRate: totalCount > 0 ? "100%" : "0%",
      avgTime: formattedAvgTime,
    };
  }, [submissions]);

  // Per-question summaries
  const questionSummaries = useMemo(() => {
    return fields.map((field) => {
      const answers: any[] = [];
      submissions.forEach((sub) => {
        const entry = sub.values.find((v: any) => v.formFieldId === field.id);
        if (entry && entry.value !== undefined && entry.value !== null && entry.value !== "") {
          answers.push({
            value: entry.value,
            respondent: sub.respondentEmail || "Anonymous",
            submittedAt: sub.createdAt,
          });
        }
      });

      let chartData: any[] = [];
      const isChoice = ["RADIO", "SELECT", "CHECKBOX", "TOGGLE", "RATING"].includes(field.type);

      if (isChoice) {
        const counts: Record<string, number> = {};
        if (field.type === "CHECKBOX") {
          answers.forEach((ans) => {
            const arr = Array.isArray(ans.value) ? ans.value : [ans.value];
            arr.forEach((val: any) => {
              const label = String(val);
              counts[label] = (counts[label] || 0) + 1;
            });
          });
        } else if (field.type === "TOGGLE") {
          answers.forEach((ans) => {
            const label =
              ans.value === true || String(ans.value).toLowerCase() === "true" ? "Yes" : "No";
            counts[label] = (counts[label] || 0) + 1;
          });
        } else if (field.type === "RATING") {
          [1, 2, 3, 4, 5].forEach((num) => {
            counts[String(num)] = 0;
          });
          answers.forEach((ans) => {
            const label = String(ans.value);
            if (counts[label] !== undefined) counts[label]++;
          });
        } else {
          answers.forEach((ans) => {
            const label = String(ans.value);
            counts[label] = (counts[label] || 0) + 1;
          });
        }

        const options = getFieldOptionsArray(field);
        if (field.type === "RATING") {
          chartData = [1, 2, 3, 4, 5].map((num) => ({
            name: `${num} ★`,
            count: counts[String(num)] || 0,
          }));
        } else if (field.type === "TOGGLE") {
          chartData = [
            { name: "Yes", count: counts["Yes"] || 0 },
            { name: "No", count: counts["No"] || 0 },
          ];
        } else {
          chartData = options.map((opt) => ({
            name: String(opt),
            count: counts[String(opt)] || 0,
          }));
        }
      }

      let ratingAvg = 0;
      if (field.type === "RATING" && answers.length > 0) {
        const sum = answers.reduce((acc, ans) => acc + Number(ans.value || 0), 0);
        ratingAvg = sum / answers.length;
      }

      return { field, answers, chartData, isChoice, ratingAvg };
    });
  }, [fields, submissions]);

  // Selected question summary for the Question sub-tab
  const selectedQuestionSummary = useMemo(() => {
    return questionSummaries.find((qs) => qs.field.id === selectedFieldId);
  }, [questionSummaries, selectedFieldId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-(--cf-cream) py-24 gap-4">
        <div className="size-8 animate-spin rounded-full border-2 border-(--cf-line) border-t-(--cf-orange)" />
        <p className="cf-meta">Loading responses...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-(--cf-cream) overflow-y-auto">
      {/* ── Top App Bar matching Mockup Header ── */}
      <div
        className="flex items-center justify-between border-b px-6 py-3 bg-white/80 backdrop-blur-sm sticky top-0 z-30"
        style={{ borderBottomColor: "var(--cf-line-strong)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/sketches"
            className="text-(--cf-ink-soft) hover:text-(--cf-ink) transition-colors flex items-center justify-center size-8 border border-(--cf-line) hover:border-(--cf-line-strong) bg-white"
            title="Back to Sketches"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-2 text-(--cf-ink)">
            <span className="text-[13px] text-(--cf-ink-soft) font-medium">CanvasFlow</span>
            <span className="text-[13px] text-(--cf-ink-soft) font-medium">·</span>
            <span className="text-[16px] sm:text-[18px] font-bold tracking-tight">{formTitle}</span>
            {isArchived && (
              <span className="border border-red-500 bg-red-50 text-red-500 px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase">
                Archived
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isArchived && (
            <button
              onClick={() => onNavigateTab?.("questions")}
              className="cf-btn-outline h-8 px-3 text-[12px] font-medium inline-flex items-center gap-1.5"
            >
              <Edit3 className="size-3.5" />
              Edit
            </button>
          )}
          {!isArchived && (
            <button
              onClick={onShare}
              className="cf-btn h-8 px-4 text-[12px] font-medium bg-(--cf-ink) text-(--cf-cream) hover:bg-black transition-colors"
            >
              <Share2 className="size-3.5 inline mr-1.5" />
              Share
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-6 pb-24">
        {isArchived && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[13.5px]">
              <span className="font-bold">This form is archived.</span> It is not accepting new
              submissions and editing is disabled.
            </div>
            {role === "owner" && (
              <button
                onClick={async () => {
                  try {
                    await unarchiveFormAsync({ id: formId });
                    toast.success("Form unarchived");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to unarchive");
                  }
                }}
                disabled={isUnarchiving}
                className="cf-btn h-8 px-4 text-[12px] font-medium bg-red-600 hover:bg-red-700 text-white transition-colors shrink-0 disabled:opacity-50"
              >
                {isUnarchiving ? "Restoring..." : "Unarchive"}
              </button>
            )}
          </div>
        )}
        {/* ── Main Title Area ── */}
        <div>
          <h1 className="cf-display text-[30px] font-bold leading-tight text-(--cf-ink) uppercase">
            {submissions.length} {submissions.length === 1 ? "Response" : "Responses"}
            <span style={{ color: "var(--cf-orange)" }}>.</span>
          </h1>
        </div>

        {/* ── Google Forms Sub-navigation Tabs ── */}
        <div className="flex items-center justify-between border-b border-(--cf-line-strong) pb-0 text-[14px]">
          <div className="flex gap-6">
            <button
              onClick={() => setSubTab("summary")}
              className={`pb-2.5 font-medium transition-colors border-b-2 cursor-pointer ${
                subTab === "summary"
                  ? "border-(--cf-ink) text-(--cf-ink) font-semibold"
                  : "border-transparent text-(--cf-ink-soft) hover:text-(--cf-ink)"
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setSubTab("question")}
              className={`pb-2.5 font-medium transition-colors border-b-2 cursor-pointer ${
                subTab === "question"
                  ? "border-(--cf-ink) text-(--cf-ink) font-semibold"
                  : "border-transparent text-(--cf-ink-soft) hover:text-(--cf-ink)"
              }`}
            >
              Question
            </button>
            <button
              onClick={() => setSubTab("responses")}
              className={`pb-2.5 font-medium transition-colors border-b-2 cursor-pointer ${
                subTab === "responses"
                  ? "border-(--cf-ink) text-(--cf-ink) font-semibold"
                  : "border-transparent text-(--cf-ink-soft) hover:text-(--cf-ink)"
              }`}
            >
              Individual
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="cf-btn-outline h-7 px-2.5 text-[11px] font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5"
            title="Export responses to CSV"
          >
            <Download className="size-3" />
            CSV Export
          </button>
        </div>

        {/* ── 1. SUMMARY VIEW ── */}
        {subTab === "summary" && (
          <div className="space-y-6">
            {/* Top 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-(--cf-line-strong) p-5 cf-panel cf-raised space-y-1">
                <span className="cf-display text-[32px] leading-none text-(--cf-ink) font-bold block">
                  {submissions.length}
                </span>
                <p className="text-[12px] text-(--cf-ink-soft) font-medium">Total responses</p>
              </div>
              <div className="bg-white border border-(--cf-line-strong) p-5 cf-panel cf-raised space-y-1">
                <span className="cf-display text-[32px] leading-none text-(--cf-ink) font-bold block">
                  {summaryMetrics.completionRate}
                </span>
                <p className="text-[12px] text-(--cf-ink-soft) font-medium">Completion rate</p>
              </div>
              <div className="bg-white border border-(--cf-line-strong) p-5 cf-panel cf-raised space-y-1">
                <span className="cf-display text-[32px] leading-none text-(--cf-ink) font-bold block">
                  {summaryMetrics.avgTime}
                </span>
                <p className="text-[12px] text-(--cf-ink-soft) font-medium">Avg. time</p>
              </div>
            </div>

            {/* Questions breakdown */}
            {submissions.length === 0 ? (
              <div className="bg-white border border-(--cf-line-strong) p-8 text-center cf-panel cf-raised space-y-4">
                <Inbox className="size-10 mx-auto text-(--cf-ink-soft)" />
                <p className="cf-meta">No submissions yet</p>
                <h3 className="cf-display text-[22px] leading-tight">Waiting for responses</h3>
              </div>
            ) : (
              <div className="space-y-6">
                {questionSummaries.map(({ field, answers, chartData, isChoice, ratingAvg }) => (
                  <div
                    key={field.id}
                    className="bg-white border border-(--cf-line-strong) p-5 sm:p-6 cf-panel cf-raised space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-(--cf-line) pb-3 mb-2">
                      <div>
                        <h4 className="text-[15px] font-bold text-(--cf-ink) leading-snug">
                          {field.label || "Untitled Question"}
                        </h4>
                        <p className="text-[11px] text-(--cf-ink-soft) mt-0.5 font-mono">
                          {answers.length} {answers.length === 1 ? "response" : "responses"}
                        </p>
                      </div>
                      <span className="text-[9px] font-mono bg-(--cf-cream) px-2 py-0.5 border text-(--cf-ink-soft) uppercase shrink-0">
                        {field.type}
                      </span>
                    </div>

                    {answers.length === 0 ? (
                      <p className="text-[12px] italic text-(--cf-ink-soft) py-2">
                        No answers submitted yet for this field.
                      </p>
                    ) : isChoice ? (
                      <div className="space-y-4">
                        {field.type === "RATING" && (
                          <div className="bg-(--cf-cream) border p-3 flex items-center justify-between font-mono text-[12px]">
                            <span>Average Rating:</span>
                            <span className="font-bold text-[14px] text-(--cf-orange)">
                              {ratingAvg.toFixed(2)} / 5.00
                            </span>
                          </div>
                        )}

                        {["RADIO", "SELECT", "TOGGLE"].includes(field.type) ? (
                          <div className="h-56 w-full pt-2 flex flex-col sm:flex-row items-center justify-around gap-4">
                            <div className="h-44 w-44 shrink-0">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={0}
                                    outerRadius={65}
                                    dataKey="count"
                                    nameKey="name"
                                  >
                                    {chartData.map((_, index) => (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                                      />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(val) => `${val} response(s)`} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto w-full max-w-xs">
                              {chartData.map((d, index) => {
                                const pct =
                                  answers.length > 0
                                    ? ((d.count / answers.length) * 100).toFixed(1)
                                    : 0;
                                return (
                                  <div
                                    key={d.name}
                                    className="flex items-center justify-between text-[11px] font-mono"
                                  >
                                    <span className="flex items-center gap-2 min-w-0">
                                      <span
                                        className="size-2.5 border shrink-0"
                                        style={{
                                          backgroundColor:
                                            CHART_COLORS[index % CHART_COLORS.length],
                                          borderColor: "var(--cf-line-strong)",
                                        }}
                                      />
                                      <span
                                        className="truncate max-w-32 font-medium text-(--cf-ink)"
                                        title={d.name}
                                      >
                                        {d.name}
                                      </span>
                                    </span>
                                    <span className="text-(--cf-ink-soft) shrink-0">
                                      {d.count} ({pct}%)
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="h-56 w-full pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={chartData}
                                layout="vertical"
                                margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
                              >
                                <XAxis
                                  type="number"
                                  stroke="var(--cf-line-strong)"
                                  fontSize={10}
                                  fontFamily="monospace"
                                />
                                <YAxis
                                  type="category"
                                  dataKey="name"
                                  stroke="var(--cf-line-strong)"
                                  fontSize={10}
                                  fontFamily="monospace"
                                  width={110}
                                />
                                <Tooltip formatter={(val) => `${val} response(s)`} />
                                <Bar dataKey="count" fill="var(--cf-orange)" radius={[0, 4, 4, 0]}>
                                  {chartData.map((_, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                        {answers.map((ans, aIdx) => (
                          <div
                            key={aIdx}
                            className="bg-(--cf-cream-2) border border-(--cf-line) p-3"
                          >
                            <p className="text-[13px] whitespace-pre-wrap leading-relaxed text-(--cf-ink)">
                              {field.type === "FILE_UPLOAD" ? (
                                <FileUploadCell val={ans.value} />
                              ) : (
                                String(ans.value)
                              )}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-(--cf-ink-soft) mt-2 font-mono">
                              <span>{ans.respondent}</span>
                              <span>{new Date(ans.submittedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 2. QUESTION VIEW ── */}
        {subTab === "question" && (
          <div className="space-y-4">
            {fields.length === 0 ? (
              <p className="text-[13px] text-(--cf-ink-soft) text-center py-8">
                No fields in this form.
              </p>
            ) : (
              <>
                {/* Selector */}
                <div className="bg-white border border-(--cf-line-strong) p-4 cf-panel cf-raised flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <select
                      value={selectedFieldId}
                      onChange={(e) => setSelectedFieldId(e.target.value)}
                      className="w-full bg-white border border-(--cf-line-strong) px-3 py-1.5 text-[13px] font-medium text-(--cf-ink) focus:outline-none focus:border-(--cf-orange)"
                    >
                      {fields.map((f, idx) => (
                        <option key={f.id} value={f.id}>
                          {idx + 1}. {f.label || "Untitled Question"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        const idx = fields.findIndex((f) => f.id === selectedFieldId);
                        if (idx > 0) setSelectedFieldId(fields[idx - 1].id);
                      }}
                      disabled={fields.findIndex((f) => f.id === selectedFieldId) <= 0}
                      className="cf-btn-outline size-8.5 flex items-center justify-center disabled:opacity-30"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      onClick={() => {
                        const idx = fields.findIndex((f) => f.id === selectedFieldId);
                        if (idx < fields.length - 1) setSelectedFieldId(fields[idx + 1].id);
                      }}
                      disabled={
                        fields.findIndex((f) => f.id === selectedFieldId) >= fields.length - 1
                      }
                      className="cf-btn-outline size-8.5 flex items-center justify-center disabled:opacity-30"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>

                {/* List of answers */}
                {selectedQuestionSummary && (
                  <div className="bg-white border border-(--cf-line-strong) p-5 sm:p-6 cf-panel cf-raised space-y-4">
                    <div>
                      <h3 className="cf-display text-[18px] font-bold text-(--cf-ink)">
                        {selectedQuestionSummary.field.label || "Untitled Question"}
                      </h3>
                      <p className="text-[11px] text-(--cf-ink-soft) mt-1 font-mono">
                        {selectedQuestionSummary.answers.length}{" "}
                        {selectedQuestionSummary.answers.length === 1 ? "response" : "responses"}
                      </p>
                    </div>

                    <div className="border-t border-(--cf-line) pt-4 space-y-3">
                      {selectedQuestionSummary.answers.length === 0 ? (
                        <p className="text-[12px] italic text-(--cf-ink-soft) py-2">
                          No answers submitted for this question.
                        </p>
                      ) : (
                        selectedQuestionSummary.answers.map((ans, idx) => (
                          <div
                            key={idx}
                            className="bg-(--cf-cream) border border-(--cf-line) p-4 flex flex-col gap-2"
                          >
                            <p className="text-[13.5px] leading-relaxed text-(--cf-ink) font-medium">
                              {selectedQuestionSummary.field.type === "FILE_UPLOAD" ? (
                                <FileUploadCell val={ans.value} />
                              ) : Array.isArray(ans.value) ? (
                                ans.value.join(", ")
                              ) : (
                                String(ans.value)
                              )}
                            </p>
                            <div className="flex items-center justify-between font-mono text-[10px] text-(--cf-ink-soft) mt-1">
                              <span className="flex items-center gap-1">
                                <Mail className="size-3 text-(--cf-ink-soft)" />
                                {ans.respondent}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="size-3 text-(--cf-ink-soft)" />
                                {new Date(ans.submittedAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── 3. INDIVIDUAL VIEW ── */}
        {subTab === "responses" && (
          <div className="space-y-4">
            {submissions.length === 0 ? (
              <div className="bg-white border border-(--cf-line-strong) p-8 text-center cf-panel cf-raised space-y-4">
                <Inbox className="size-10 mx-auto text-(--cf-ink-soft)" />
                <p className="cf-meta">No submissions yet</p>
                <h3 className="cf-display text-[22px] leading-tight">Waiting for responses</h3>
              </div>
            ) : (
              <div className="bg-white border border-(--cf-line-strong) cf-panel cf-raised divide-y divide-(--cf-line)">
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between px-5 py-4 hover:bg-(--cf-cream) transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-(--cf-ink truncate">
                        {sub.respondentEmail || "Anonymous"}
                      </p>
                      <p className="text-[11.5px] font-mono text-(--cf-ink-soft) mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" /> {new Date(sub.createdAt).toLocaleString()}
                        </span>
                        <span>·</span>
                        <span className="capitalize">{sub.deviceType || "Desktop"}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => setViewingSub(sub)}
                      title="View response details"
                      className="cf-btn-outline size-8 shrink-0 ml-3 flex items-center justify-center"
                    >
                      <Eye className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Details Popup Modal ── */}
      {viewingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-(--cf-line-strong) cf-panel cf-raised w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-(--cf-line-strong)">
              <div>
                <h3 className="cf-display text-[18px] font-bold text-(--cf-ink) uppercase">
                  Response Details
                  <span style={{ color: "var(--cf-orange)" }}>.</span>
                </h3>
                <p className="text-[11px] font-mono text-(--cf-ink-soft) mt-1">
                  {viewingSub.respondentEmail || "Anonymous"} ·{" "}
                  {new Date(viewingSub.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setViewingSub(null)}
                className="cf-btn-outline size-8 flex items-center justify-center"
                title="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {fields.map((field) => {
                const valObj = viewingSub.values?.find((v: any) => v.formFieldId === field.id);
                const val = valObj?.value;
                let display: React.ReactNode = (
                  <span className="italic text-(--cf-ink-soft)">No answer submitted</span>
                );

                if (val !== undefined && val !== null && val !== "") {
                  if (field.type === "FILE_UPLOAD") {
                    display = <FileUploadCell val={val} />;
                  } else if (Array.isArray(val)) {
                    display = val.join(", ");
                  } else {
                    display = String(val);
                  }
                }

                return (
                  <div
                    key={field.id}
                    className="bg-(--cf-cream) border border-(--cf-line-strong) p-4"
                  >
                    <p className="text-[10px] font-mono text-(--cf-ink-soft) uppercase tracking-wider mb-1.5">
                      {field.label || "Untitled Question"}
                    </p>
                    <p className="text-[13.5px] text-(--cf-ink) font-medium leading-relaxed">
                      {display}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
