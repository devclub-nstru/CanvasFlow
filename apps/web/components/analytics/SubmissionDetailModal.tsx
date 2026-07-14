"use client";

import React from "react";
import { X } from "lucide-react";

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

/**
 * Detail modal for a single submission. Pulled into its own file so the
 * parent SubmissionsTable can lazy-load it via `next/dynamic` — keeps it
 * out of the initial route bundle since most users browse the list
 * without opening any row.
 */
export function SubmissionDetailModal({
  submission,
  form,
  getRespondentDetails,
  onClose,
}: SubmissionDetailModalProps) {
  const respondent = getRespondentDetails(submission);

  return (
    <div className="fixed inset-0 bg-[color:var(--cf-ink)]/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[color:var(--cf-cream-2)] rounded-2xl ring-1 ring-[color:var(--cf-line-strong)] max-w-lg w-full relative shadow-[0_40px_80px_-30px_rgba(22,19,17,0.4)] flex flex-col max-h-[90vh]">
        <div className="px-6 pt-6 pb-4 border-b border-[color:var(--cf-line)] relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-ink)] rounded-md hover:bg-[color:var(--cf-cream)] cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>

          <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">Submission</p>
          <h4 className="mt-2 cf-display text-[22px] leading-tight pr-8 truncate">
            {respondent.name}
          </h4>
          <p className="mt-1 text-[12px] font-mono text-[color:var(--cf-ink-soft)]">
            {new Date(submission.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          {form.fields.map((field) => {
            const answer = submission.values.find((v) => v.formFieldId === field.id);
            let displayVal = "No answer provided";
            if (answer?.value !== undefined && answer?.value !== null && answer?.value !== "") {
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
                <p className="cf-eyebrow text-[color:var(--cf-ink-soft)]">{field.label}</p>
                <div className="text-[13px] text-[color:var(--cf-ink)] bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line)] rounded-md px-3 py-2.5">
                  {displayVal}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-[color:var(--cf-line)] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-[13px] font-medium rounded-full bg-[color:var(--cf-ink)] hover:bg-black text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
