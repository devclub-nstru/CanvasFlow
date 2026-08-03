"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { requiresSignIn, isEmailDomainAllowed } from "~/lib/form-access";
import {
  buildFlow,
  buildPages,
  resolveLayout,
  resolveNextPage,
  estimateRemainingPages,
  answersOnPath,
  type FlowField,
  type FlowSegment,
  type FlowRule,
  type QuestionLayout,
} from "~/lib/form-flow";
import {
  useGetFormById,
  useSubmitForm,
  useGetDraft,
  useSaveDraft,
  useDeleteDraft,
} from "~/hooks/api/form";
import { useGetLoggedInUserInfo } from "~/hooks/api/auth";
import { useDebouncedCallback } from "~/hooks/useDebouncedCallback";
import { FormPreviewBanner } from "~/components/forms/FormPreviewBanner";
import { FormDraftNotice, type DraftStatus } from "~/components/forms/FormDraftNotice";
import { FormLoadingState } from "~/components/forms/FormLoadingState";
import { FormErrorState } from "~/components/forms/FormErrorState";
import { FormThankYou } from "~/components/forms/FormThankYou";
import { isUploadAnswerComplete } from "~/lib/upload";
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

  const searchParams = useSearchParams();
  const isPreview = searchParams.get("preview") === "1";

  const { form, isLoading, error } = useGetFormById(formId);
  const { submitForm, isPending } = useSubmitForm();

  const { userInfo, isPending: sessionPending } = useGetLoggedInUserInfo();
  const canSaveDraft = !!userInfo && !isPreview;

  const accessRules = useMemo(
    () => ({
      requireSignIn: !!form?.requireSignIn,
      collectRespondentEmail: !!form?.collectRespondentEmail,
      oneResponsePerRespondent: !!form?.oneResponsePerRespondent,
      allowedEmailDomains: form?.allowedEmailDomains ?? null,
    }),
    [
      form?.requireSignIn,
      form?.collectRespondentEmail,
      form?.oneResponsePerRespondent,
      form?.allowedEmailDomains,
    ],
  );

  const needsSignIn = !isPreview && requiresSignIn(accessRules);
  const signedInEmail = userInfo?.email ?? null;

  const gateResolving = needsSignIn && sessionPending;

  const mustSignIn = needsSignIn && !gateResolving && !signedInEmail;
  const wrongDomain =
    needsSignIn &&
    !!signedInEmail &&
    !isEmailDomainAllowed(signedInEmail, accessRules.allowedEmailDomains);

  const signInHref = useMemo(() => {
    const back = isPreview ? `/forms/${formId}?preview=1` : `/forms/${formId}`;
    return `/signIn?redirect=${encodeURIComponent(back)}`;
  }, [formId, isPreview]);

  const locksToOneResponse = !!form?.oneResponsePerRespondent;

  const { draft, isFetched: draftFetched } = useGetDraft(formId, canSaveDraft);
  const { saveDraftAsync } = useSaveDraft();
  const { deleteDraftAsync } = useDeleteDraft();

  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [resumedFrom, setResumedFrom] = useState<string | null>(null);
  const draftRestoredRef = React.useRef(false);

  const [answers, setAnswers] = useState<Record<string, any>>({});

  const [pagePath, setPagePath] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [siteRating, setSiteRating] = useState<number | null>(null);

  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const [accessError, setAccessError] = useState<"sign-in-required" | "domain-not-allowed" | null>(
    null,
  );

  const formOpenedAtRef = React.useRef<number>(Date.now());
  const visitorIdRef = React.useRef<string | null>(null);
  const idempotencyKeyRef = React.useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const submittedStorageKey = useMemo(() => {
    if (!formId || isPreview || !locksToOneResponse || !userInfo?.id) return null;
    return `cf_submitted_${formId}_${userInfo.id}`;
  }, [formId, isPreview, locksToOneResponse, userInfo?.id]);

  useEffect(() => {
    if (!submittedStorageKey) return;
    try {
      if (window.localStorage.getItem(submittedStorageKey) === "1") {
        setAlreadySubmitted(true);
      }
    } catch {
      // localStorage unavailable — we'll catch the duplicate at submit time.
    }
  }, [submittedStorageKey]);

  const rememberSubmitted = useCallback(() => {
    if (!submittedStorageKey) return;
    try {
      window.localStorage.setItem(submittedStorageKey, "1");
    } catch {
      // localStorage unavailable — the server-side check still applies.
    }
  }, [submittedStorageKey]);

  useEffect(() => {
    if (!formId) return;
    formOpenedAtRef.current = Date.now();
    visitorIdRef.current = getOrCreateVisitorId(formId);
  }, [formId]);

  const toggleDefaults = useMemo(() => {
    const defaults: Record<string, any> = {};
    (form?.fields ?? []).forEach((field) => {
      if (field.type === "TOGGLE") {
        defaults[field.id] = !!(field.options as any)?.defaultValue;
      }
    });
    return defaults;
  }, [form?.fields]);

  useEffect(() => {
    setAnswers((prev) => ({ ...toggleDefaults, ...prev }));
  }, [toggleDefaults]);

  useEffect(() => {
    if (draftRestoredRef.current || !canSaveDraft || !draftFetched) return;
    draftRestoredRef.current = true;

    if (!draft || Object.keys(draft.values ?? {}).length === 0) return;

    setAnswers((prev) => ({ ...prev, ...(draft.values as Record<string, any>) }));
    if (draft.pagePath && draft.pagePath.length > 0) {
      setPagePath(draft.pagePath);
    }
    setResumedFrom(draft.updatedAt);
  }, [draft, draftFetched, canSaveDraft]);

  const persistDraft = useCallback(
    (nextAnswers: Record<string, any>, nextPagePath: number[]) => {
      if (!canSaveDraft) return;
      if (Object.keys(nextAnswers).length === 0) return;

      setDraftStatus("saving");
      saveDraftAsync({ formId, values: nextAnswers, pagePath: nextPagePath })
        .then(() => setDraftStatus("saved"))
        .catch(() => {
          setDraftStatus("idle");
        });
    },
    [canSaveDraft, formId, saveDraftAsync],
  );

  const {
    run: queueDraftSave,
    flush: flushDraftSave,
    cancel: cancelDraftSave,
  } = useDebouncedCallback(persistDraft, 1200);
  const handleFieldChange = (fieldId: string, value: any) => {
    setAnswers((prev) => {
      const next = { ...prev, [fieldId]: value };
      queueDraftSave(next, pagePath);
      return next;
    });
  };

  const flow = useMemo(
    () =>
      buildFlow(
        (form?.fields ?? []) as FlowField[],
        (form?.segments ?? []) as FlowSegment[],
        (form?.logicRules ?? []) as FlowRule[],
      ),
    [form?.fields, form?.segments, form?.logicRules],
  );

  const totalQuestions = flow.order.length;

  const layout = useMemo(
    () =>
      resolveLayout(
        form?.questionLayout as QuestionLayout | undefined,
        flow.segments.length,
        (form?.logicRules ?? []).length,
      ),
    [form?.questionLayout, flow.segments.length, form?.logicRules],
  );

  const pages = useMemo(() => buildPages(flow, layout, answers), [flow, layout, answers]);
  useEffect(() => {
    if (pagePath.length > 0 || pages.length === 0) return;
    setPagePath([0]);
  }, [pages.length, pagePath.length]);

  const currentPageIndex = pagePath[pagePath.length - 1] ?? 0;
  const currentPage = pages[currentPageIndex];

  const currentFields = useMemo(
    () =>
      (currentPage?.fieldIds ?? [])
        .map((fieldId) => flow.fieldById.get(fieldId))
        .filter((field): field is FlowField => !!field),
    [currentPage, flow],
  );

  const questionNumbers = useMemo(() => {
    const numbers: Record<string, number> = {};
    flow.order.forEach((field, i) => {
      numbers[field.id] = i + 1;
    });
    return numbers;
  }, [flow]);

  const nextPage = useMemo(
    () =>
      pages.length === 0
        ? ({ kind: "end" } as const)
        : resolveNextPage({
            flow,
            pages,
            answers,
            currentPageIndex,
            visitedPageIndexes: pagePath.slice(0, -1),
          }),
    [flow, pages, answers, currentPageIndex, pagePath],
  );

  const isLast = nextPage.kind === "end";

  const estimatedRemainingPages = useMemo(
    () =>
      pages.length === 0
        ? 0
        : estimateRemainingPages({
            flow,
            pages,
            answers,
            currentPageIndex,
            visitedPageIndexes: pagePath.slice(0, -1),
          }),
    [flow, pages, answers, currentPageIndex, pagePath],
  );

  const progressPercent = useMemo(() => {
    if (pages.length === 0) return 0;

    if (layout === "ALL_AT_ONCE") {
      const visible = currentFields.length;
      if (visible === 0) return 0;
      const answered = currentFields.filter((field) => {
        const val = answers[field.id];
        if (field.type === "TOGGLE") return val !== undefined;
        if (Array.isArray(val)) return val.length > 0;
        return val !== undefined && val !== null && val !== "";
      }).length;
      return Math.round((answered / visible) * 100);
    }

    const total = pagePath.length + estimatedRemainingPages;
    return total > 0 ? Math.round((pagePath.length / total) * 100) : 0;
  }, [pages.length, layout, currentFields, answers, pagePath.length, estimatedRemainingPages]);

  const visitedFieldIds = useMemo(
    () => pagePath.flatMap((pageIndex) => pages[pageIndex]?.fieldIds ?? []),
    [pagePath, pages],
  );

  const answeredPathFields = useMemo(
    () =>
      visitedFieldIds
        .map((fieldId) => flow.fieldById.get(fieldId))
        .filter((field): field is FlowField => !!field),
    [flow, visitedFieldIds],
  );

  const segmentLabel = useMemo(() => {
    if (!currentPage?.segment) return null;
    const position = flow.segments.findIndex((s) => s.id === currentPage.segment?.id);
    if (position === -1) return null;
    return `Segment ${position + 1} of ${flow.segments.length} · ${currentPage.segment.title}`;
  }, [currentPage, flow.segments]);

  const validateField = (field: FlowField): string | null => {
    const value = answers[field.id];
    const missing =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (field.type === "FILE_UPLOAD") {
      if (missing) {
        return field.isRequired
          ? `Please attach a file for the required field: “${field.label}”`
          : null;
      }

      if (!isUploadAnswerComplete(value)) {
        const refs = Array.isArray(value) ? value : [value];
        const failed = refs.find((ref: any) => ref?.status === "failed");

        return failed
          ? `“${field.label}” — that file could not be attached. Remove it and try again.`
          : `“${field.label}” is still uploading — give it a moment.`;
      }

      return null;
    }

    if (field.isRequired && missing) {
      return `Please answer the required field: “${field.label}”`;
    }

    if (typeof value === "string" && value.trim() !== "") {
      if (field.type === "EMAIL") {
        // Pragmatic email check: one '@', non-empty local part, dotted host.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          return `“${field.label}” needs a valid email address`;
        }
      } else if (field.type === "URL") {
        try {
          new URL(value.trim());
        } catch {
          return `“${field.label}” needs a valid URL, including https://`;
        }
      }
    }

    return null;
  };

  const handleNext = () => {
    if (currentFields.length === 0) return;

    for (const field of currentFields) {
      const error = validateField(field);
      if (error) {
        toast.error(error);
        return;
      }
    }



    if (nextPage.kind === "page") {
      const advanced = [...pagePath, nextPage.pageIndex];
      setPagePath(advanced);
      if (canSaveDraft) persistDraft(answers, advanced);
    } else {
      const payloadValues = answersOnPath(answers, visitedFieldIds).map(
        ({ formFieldId, value }) => ({ formFieldId, value }),
      );

      if (isPreview) {
        cancelDraftSave();
        setSubmitted(true);
        toast.success("Preview complete — nothing was saved");
        return;
      }

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
            rememberSubmitted();
            cancelDraftSave();
            if (canSaveDraft) void deleteDraftAsync({ formId }).catch(() => {});
            toast.success("Thanks — your response was submitted");
          },
          onError: (err) => {
            switch (err.message) {
              case "ALREADY_SUBMITTED":
              case "ALREADY_RESPONDED":
                rememberSubmitted();
                setAlreadySubmitted(true);
                return;
              case "SIGN_IN_REQUIRED":
                setAccessError("sign-in-required");
                return;
              case "DOMAIN_NOT_ALLOWED":
                setAccessError("domain-not-allowed");
                return;
              default:
                toast.error(err.message || "Failed to submit form");
            }
          },
        },
      );
    }
  };

  const handleBack = () => {
    setPagePath((prev) => {
      if (prev.length <= 1) return prev;
      const back = prev.slice(0, -1);
      if (canSaveDraft) persistDraft(answers, back);
      return back;
    });
  };

  const canGoBack = pagePath.length > 1;
  const handleStartOver = useCallback(() => {
    cancelDraftSave();
    setAnswers({ ...toggleDefaults });
    setPagePath(pages.length > 0 ? [0] : []);
    setResumedFrom(null);
    setDraftStatus("idle");
    if (canSaveDraft) void deleteDraftAsync({ formId }).catch(() => {});
    toast("Starting over — your saved answers were discarded");
  }, [cancelDraftSave, toggleDefaults, pages.length, canSaveDraft, deleteDraftAsync, formId]);

  const handleRespondAgain = useCallback(() => {
    cancelDraftSave();
    setAnswers({ ...toggleDefaults });
    setPagePath(pages.length > 0 ? [0] : []);
    setSubmitted(false);
    setSiteRating(null);
    setResumedFrom(null);
    setDraftStatus("idle");
    setAccessError(null);

    idempotencyKeyRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    formOpenedAtRef.current = Date.now();

    draftRestoredRef.current = true;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [cancelDraftSave, toggleDefaults, pages.length]);

  const canRespondAgain = isPreview || !locksToOneResponse;

  useEffect(() => {
    if (!canSaveDraft) return;

    const onHide = () => {
      if (document.visibilityState === "hidden") flushDraftSave();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushDraftSave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushDraftSave);
    };
  }, [canSaveDraft, flushDraftSave]);

  if (isLoading) return <FormLoadingState />;
  if (error || !form) return <FormErrorState type="not-found" />;
  if (gateResolving) return <FormLoadingState />;
  if (!form.isPublished) return <FormErrorState type="draft-mode" />;
  if (!form.isOpen) return <FormErrorState type="closed" />;
  if (form.expiresAt && new Date() > new Date(form.expiresAt)) {
    return <FormErrorState type="expired" />;
  }

  if (mustSignIn || accessError === "sign-in-required") {
    return <FormErrorState type="sign-in-required" signInHref={signInHref} />;
  }
  if (wrongDomain || accessError === "domain-not-allowed") {
    return (
      <FormErrorState
        type="domain-not-allowed"
        allowedDomains={form.allowedEmailDomains ?? undefined}
        signInHref={`${signInHref}&switch=1`}
      />
    );
  }

  if (alreadySubmitted) return <FormErrorState type="already-submitted" />;

  const formCode = form.slug.substring(0, 7).toUpperCase();

  return (
    <div className="cf-landing cf-dotgrid relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-(--cf-cream) text-(--cf-ink)">
      <Noise />

      {isPreview && <FormPreviewBanner />}

      <div className="flex w-full flex-1 flex-col items-center px-4 py-6 sm:px-10 sm:py-8">
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
              fields={answeredPathFields}
              answers={answers}
              customMessage={form.thankYouMessage}
              onRespondAgain={canRespondAgain ? handleRespondAgain : undefined}
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
            <div className="w-full max-w-xl space-y-4">
              {canSaveDraft && (
                <FormDraftNotice
                  status={draftStatus}
                  resumedFrom={resumedFrom}
                  onStartOver={handleStartOver}
                />
              )}

              <FormQuestion
                fields={currentFields}
                questionNumbers={questionNumbers}
                totalQuestions={totalQuestions}
                answers={answers}
                isPending={isPending}
                handleFieldChange={handleFieldChange}
                handleNext={handleNext}
                handleBack={handleBack}
                isLast={isLast}
                canGoBack={canGoBack}
                segmentLabel={segmentLabel}
                segmentDescription={currentPage?.segment?.description ?? null}
                nextLabel={currentFields.length > 1 ? "Next section" : "Next"}
                formId={formId}
                isPreview={isPreview}
              />
            </div>
          )}
        </main>

        <FormFooter />
      </div>
    </div>
  );
}
