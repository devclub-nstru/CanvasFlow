"use client";

import React from "react";
import { Download, X } from "lucide-react";

import { ModalOverlay } from "~/components/ui/ModalOverlay";
import { downloadUrlFor, formatBytes } from "~/lib/upload";

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

interface FormField {
  id: string;
  label: string;
  type: string;
}

interface SubmissionDetailModalProps {
  submission: Submission;
  form: { fields: FormField[] };
  getRespondentDetails: (sub: Submission) => { name: string; email: string };
  onClose: () => void;
}

export function SubmissionDetailModal({
  submission,
  form,
  getRespondentDetails,
  onClose,
}: SubmissionDetailModalProps) {
  const respondent = getRespondentDetails(submission);

  return (
    <ModalOverlay onDismiss={onClose}>
      <div
        className="cf-panel cf-raised relative flex max-h-[90vh] w-full max-w-lg flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Submission from ${respondent.name}`}
      >
        <div className="px-6 pt-6 pb-4 border-b border-(--cf-line) relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 text-(--cf-ink-soft) hover:text-(--cf-ink) rounded-md hover:bg-(--cf-cream) cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>

          <p className="cf-eyebrow text-(--cf-ink-soft)">Submission</p>
          <h4 className="mt-2 cf-display text-[22px] leading-tight pr-8 truncate">
            {respondent.name}
          </h4>
          <p className="mt-1 text-[12px] font-mono text-(--cf-ink-soft)">
            {new Date(submission.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          {form.fields.map((field) => {
            const answer = submission.values.find((v) => v.formFieldId === field.id);
            const hasValue =
              answer?.value !== undefined && answer?.value !== null && answer?.value !== "";

            if (field.type === "FILE_UPLOAD" && hasValue) {
              const filesRaw = Array.isArray(answer?.value) ? answer.value : [answer?.value];
              const files = filesRaw.filter(Boolean) as Array<{
                uploadId?: string;
                name?: string;
                url?: string | null;
                status?: string;
                sizeBytes?: number;
              }>;

              return (
                <div key={field.id} className="space-y-1.5">
                  <p className="cf-eyebrow text-(--cf-ink-soft)">{field.label}</p>
                  <div className="space-y-1.5 rounded-md bg-(--cf-cream) px-3 py-2.5 text-[13px] ring-1 ring-(--cf-line)">
                    {files.length === 0 ? (
                      <span className="text-(--cf-ink-soft)">No answer provided</span>
                    ) : (
                      files.map((file, i) => (
                        <div key={file.uploadId ?? i} className="flex items-center gap-2">
                          {file.url ? (
                            <>
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="min-w-0 flex-1 truncate text-(--cf-orange) underline underline-offset-2"
                                title="Open in a new tab"
                              >
                                {file.name || "Attachment"}
                              </a>

                              <a
                                href={downloadUrlFor(file.url, file.name || "attachment")}
                                download
                                rel="noopener noreferrer"
                                className="shrink-0 cursor-pointer p-1 text-(--cf-ink-soft) transition-colors hover:text-(--cf-ink)"
                                aria-label={`Download ${file.name || "attachment"}`}
                                title="Download"
                              >
                                <Download className="size-3.5" aria-hidden />
                              </a>
                            </>
                          ) : (
                            <span className="min-w-0 flex-1 truncate text-(--cf-ink)">
                              {file.name || "Attachment"}
                            </span>
                          )}

                          {typeof file.sizeBytes === "number" && (
                            <span className="shrink-0 font-mono text-[10.5px] tracking-wide text-(--cf-ink-soft)">
                              {formatBytes(file.sizeBytes)}
                            </span>
                          )}

                          {!file.url && (
                            <span className="shrink-0 font-mono text-[10.5px] tracking-wide text-(--cf-ink-soft)">
                              {file.status === "failed" ? "failed" : "still processing"}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            }

            let displayVal = "No answer provided";
            if (hasValue) {
              if (Array.isArray(answer.value)) {
                displayVal = answer.value.join(", ");
              } else if (typeof answer.value === "boolean") {
                displayVal = answer.value ? "Yes" : "No";
              } else {
                displayVal = String(answer.value);
              }
            }

            return (
              <div key={field.id} className="space-y-1.5">
                <p className="cf-eyebrow text-(--cf-ink-soft)">{field.label}</p>
                <div className="text-[13px] text-(--cf-ink) bg-(--cf-cream) ring-1 ring-(--cf-line) rounded-md px-3 py-2.5">
                  {displayVal}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-(--cf-line) flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-[13px] font-medium rounded-full bg-(--cf-ink) hover:bg-black text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
