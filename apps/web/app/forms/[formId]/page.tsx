"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { useGetFormById, useSubmitForm } from "~/hooks/api/form";
import { useRecordFieldAnswer } from "~/hooks/api/analytics";
import { FormLoadingState } from "~/components/forms/FormLoadingState";
import { FormErrorState } from "~/components/forms/FormErrorState";
import { FormThankYou } from "~/components/forms/FormThankYou";
import { FormQuestion } from "~/components/forms/FormQuestion";
import { FormHeader } from "~/components/forms/FormHeader";
import { FormFooter } from "~/components/forms/FormFooter";
import Noise from "~/components/Noise";

type DeviceType = "desktop" | "mobile" | "tablet";

function detectDeviceType(): DeviceType {
  const ua = window.navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|webos/i.test(ua)) return "mobile";
  return "desktop";
}

function getOrCreateVisitorId(formId: string): string | null {
  const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const storageKey = `cf_vid_${formId}`;
    let visitorId = window.localStorage.getItem(storageKey);
    if (!visitorId) {
      visitorId = newId();
      window.localStorage.setItem(storageKey, visitorId);
    }
    return visitorId;
  } catch {
    return null;
  }
}

export default function PublicFormPage() {
  const params = useParams();
  const formId = params.formId as string;

  const { form, isLoading, error } = useGetFormById(formId);
  const { submitForm, isPending } = useSubmitForm();
  const { recordFieldAnswer } = useRecordFieldAnswer();

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [siteRating, setSiteRating] = useState<number | null>(null);

  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const [limitReached, setLimitReached] = useState(false);

  const formOpenedAtRef = React.useRef<number>(Date.now());
  const visitorIdRef = React.useRef<string | null>(null);
  const idempotencyKeyRef = React.useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    if (!formId) return;
    try {
      if (window.localStorage.getItem(`cf_submitted_${formId}`) === "1") {
        setAlreadySubmitted(true);
      }
    } catch {
      // localStorage unavailable — we'll catch the duplicate at submit time.
    }
  }, [formId]);

  useEffect(() => {
    if (!formId) return;
    formOpenedAtRef.current = Date.now();
    visitorIdRef.current = getOrCreateVisitorId(formId);
  }, [formId]);

  // default values for toggles
  useEffect(() => {
    if (form?.fields) {
      const defaults: Record<string, any> = {};
      form.fields.forEach((field) => {
        if (field.type === "TOGGLE") {
          defaults[field.id] = !!(field.options as any)?.defaultValue;
        }
      });
      setAnswers((prev) => ({ ...defaults, ...prev }));
    }
  }, [form]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const currentField = form?.fields?.[currentQuestionIndex];
  const totalQuestions = form?.fields?.length || 0;

  const answeredCount =
    form?.fields?.filter((field) => {
      const val = answers[field.id];
      if (field.type === "TOGGLE") return val !== undefined;
      if (Array.isArray(val)) return val.length > 0;
      return val !== undefined && val !== null && val !== "";
    }).length || 0;

  const progressPercent =
    totalQuestions > 0
      ? Math.round((Math.max(currentQuestionIndex, answeredCount) / totalQuestions) * 100)
      : 0;

  const handleNext = () => {
    if (!currentField) return;

    const value = answers[currentField.id];
    if (
      currentField.isRequired &&
      (value === undefined || value === "" || (Array.isArray(value) && value.length === 0))
    ) {
      toast.error(`Please answer the required field: "${currentField.label}"`);
      return;
    }

    if (typeof value === "string" && value.trim() !== "") {
      if (currentField.type === "EMAIL") {
        // Pragmatic email check: one '@', non-empty local part, dotted host.
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
        if (!ok) {
          toast.error("Please enter a valid email address");
          return;
        }
      } else if (currentField.type === "URL") {
        try {
          new URL(value.trim());
        } catch {
          toast.error("Please enter a valid URL (including https://)");
          return;
        }
      }
    }

    const hasAnswer =
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0);
    if (hasAnswer || currentField.type === "TOGGLE") {
      recordFieldAnswer({ formId, fieldId: currentField.id, value });
    }

    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      const payloadValues = Object.entries(answers).map(([fieldId, value]) => ({
        formFieldId: fieldId,
        value,
      }));

      const urlParams = new URLSearchParams(window.location.search);

      submitForm(
        {
          formId,
          values: payloadValues,
          idempotencyKey: idempotencyKeyRef.current,
          visitorId: visitorIdRef.current,
          referrer: document.referrer || null,
          utmSource: urlParams.get("utm_source"),
          utmMedium: urlParams.get("utm_medium"),
          utmCampaign: urlParams.get("utm_campaign"),
          timeSpentMs: Date.now() - formOpenedAtRef.current,
          deviceType: detectDeviceType(),
        },
        {
          onSuccess: () => {
            setSubmitted(true);
            try {
              window.localStorage.setItem(`cf_submitted_${formId}`, "1");
            } catch {
              // localStorage unavailable — server-side dedup still applies.
            }
            toast.success("Thanks — your response was submitted");
          },
          onError: (err) => {
            if (err.message === "ALREADY_SUBMITTED") {
              try {
                window.localStorage.setItem(`cf_submitted_${formId}`, "1");
              } catch {
                /* noop */
              }
              setAlreadySubmitted(true);
              return;
            }
            if (err.message === "LIMIT_REACHED") {
              setLimitReached(true);
              return;
            }
            toast.error(err.message || "Failed to submit form");
          },
        },
      );
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  if (isLoading) return <FormLoadingState />;
  if (error || !form) return <FormErrorState type="not-found" />;
  if (!form.isPublished) return <FormErrorState type="draft-mode" />;
  if (!form.isOpen) return <FormErrorState type="closed" />;
  if (form.expiresAt && new Date() > new Date(form.expiresAt)) {
    return <FormErrorState type="expired" />;
  }
  // Full on arrival, or filled up mid-session and the server said so.
  const capReachedOnLoad =
    form.maxSubmissions !== null &&
    form.maxSubmissions !== undefined &&
    form.submissionsCount !== null &&
    form.submissionsCount !== undefined &&
    form.submissionsCount >= form.maxSubmissions;

  if (limitReached || capReachedOnLoad) {
    return <FormErrorState type="limit-reached" />;
  }
  if (alreadySubmitted) return <FormErrorState type="already-submitted" />;

  const formCode = form.slug.substring(0, 7).toUpperCase();

  return (
    <div className="cf-landing cf-dotgrid relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-(--cf-cream) px-4 py-6 text-(--cf-ink) sm:px-10 sm:py-8">
      <Noise />
      <style>{`
        @keyframes cf-card-in {
          from { transform: translateY(12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes cf-draw-check {
          to { stroke-dashoffset: 0; }
        }
        @keyframes cf-check-pop {
          0% { transform: scale(0.85); opacity: 0; }
          60% { transform: scale(1.06); }
          100% { transform: scale(1); opacity: 1; }
        }
        .cf-animate-card {
          animation: cf-card-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .cf-animate-pop {
          animation: cf-check-pop 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }
        .cf-check-circle {
          stroke-dasharray: 150;
          stroke-dashoffset: 150;
          animation: cf-draw-check 0.7s ease-in-out forwards;
        }
        .cf-check-mark {
          stroke-dasharray: 50;
          stroke-dashoffset: 50;
          animation: cf-draw-check 0.5s ease-in-out 0.55s forwards;
        }
      `}</style>

      <FormHeader
        progressPercent={progressPercent}
        submitted={submitted}
        formCode={formCode}
        formTitle={form.title}
      />

      <main className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center py-8 sm:py-12">
        {!submitted && (
          <div className="mb-8 w-full sm:mb-10">
            <h1
              className="cf-display border-l-4 pl-4 text-[26px] leading-[1.05] text-(--cf-ink) sm:border-l-[6px] sm:pl-5 sm:text-[34px]"
              style={{ borderLeftColor: "var(--cf-ink)" }}
            >
              {form.title}
            </h1>
            {form.description && (
              <p className="mt-3 pl-4 text-[14.5px] leading-relaxed text-(--cf-ink-soft) sm:pl-5">
                {form.description}
              </p>
            )}
          </div>
        )}

        {submitted ? (
          <FormThankYou
            siteRating={siteRating}
            setSiteRating={setSiteRating}
            fields={form.fields}
            answers={answers}
          />
        ) : totalQuestions === 0 ? (
          <div
            className="cf-animate-card w-full max-w-md border p-8 text-center"
            style={{
              borderColor: "var(--cf-line-strong)",
              background: "var(--cf-cream-2)",
              boxShadow: "5px 5px 0 0 rgba(26, 29, 41, 0.08)",
            }}
          >
            <p className="font-mono text-[10px] font-bold tracking-[0.18em] text-(--cf-ink-soft) uppercase">
              Empty form
            </p>
            <h3 className="cf-display mt-4 text-[26px] leading-tight">Nothing to fill out yet</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-(--cf-ink-soft)">
              The author hasn&apos;t added any questions to this form.
            </p>
          </div>
        ) : (
          <FormQuestion
            currentField={currentField}
            currentQuestionIndex={currentQuestionIndex}
            totalQuestions={totalQuestions}
            answers={answers}
            isPending={isPending}
            handleFieldChange={handleFieldChange}
            handleNext={handleNext}
            handleBack={handleBack}
          />
        )}
      </main>

      <FormFooter />
    </div>
  );
}
