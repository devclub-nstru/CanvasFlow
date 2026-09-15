export interface CsvField {
  id: string;
  label?: string | null;
  type?: string | null;
}

export interface CsvSubmission {
  id: string;
  createdAt: string | Date | null;
  respondentEmail?: string | null;
  deviceType?: string | null;
  values?: Array<{ formFieldId: string; value: unknown }> | null;
}

export const CSV_METADATA_HEADERS = [
  "Submission ID",
  "Submitted At",
  "Respondent Email",
  "Device Type",
] as const;

function isFormulaLike(value: string): boolean {
  if (/^[=+@\t\r]/.test(value)) return true;
  return value.startsWith("-") && !/^-\d+(\.\d+)?$/.test(value);
}

export function escapeCsvCell(value: string): string {
  const safe = isFormulaLike(value) ? `'${value}` : value;

  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function describeFile(item: unknown): string {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return "";

  const file = item as { originalName?: string; name?: string; url?: string };
  const name = file.originalName || file.name || "";
  const url = file.url || "";

  if (name && url) return `${name} (${url})`;
  return name || url;
}

export function formatCsvValue(value: unknown, fieldType?: string | null): string {
  if (value === null || value === undefined) return "";

  if (fieldType === "FILE_UPLOAD") {
    const items = Array.isArray(value) ? value : [value];
    return items.map(describeFile).filter(Boolean).join(", ");
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatCsvValue(item, fieldType)).join(", ");
  }

  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";

  return String(value);
}

function formatTimestamp(value: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function buildResponsesCsv(fields: CsvField[], submissions: CsvSubmission[]): string {
  const headers = [
    ...CSV_METADATA_HEADERS,
    ...fields.map((field) => field.label || "Untitled Question"),
  ];

  const rows = submissions.map((sub) => {
    const values = sub.values ?? [];

    return [
      sub.id,
      formatTimestamp(sub.createdAt),
      sub.respondentEmail || "Anonymous",
      sub.deviceType || "Unknown",
      ...fields.map((field) => {
        const entry = values.find((v) => v.formFieldId === field.id);
        return formatCsvValue(entry?.value, field.type);
      }),
    ];
  });

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

export function responsesCsvFilename(formTitle: string | undefined, now = new Date()): string {
  const slug = (formTitle || "form")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const day = now.toISOString().slice(0, 10);
  return `${slug || "form"}-responses-${day}.csv`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
