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
import { useRecordFieldAnswer } from "~/hooks/api/analytics";
import { useGetLoggedInUserInfo } from "~/hooks/api/auth";
import { useDebouncedCallback } from "~/hooks/useDebouncedCallback";
import { FormPreviewBanner } from "~/components/forms/FormPreviewBanner";
import { FormDraftNotice, type DraftStatus } from "~/components/forms/FormDraftNotice";
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

  /**
   * Preview mode. Set by the builder's Preview link (`?preview=1`).
   *
   * Everything about filling the form behaves normally, including Submit —
   * what changes is that nothing leaves the browser: no response, no draft, no
   * answer tracking, and the one-response-per-visitor lockout is ignored so the
   * author can test the flow as many times as they like. The banner says so, at
   * the top, for the whole session.
   */
  const searchParams = useSearchParams();
  const isPreview = searchParams.get("preview") === "1";

  const { form, isLoading, error } = useGetFormById(formId);
  const { submitForm, isPending } = useSubmitForm();
  const { recordFieldAnswer } = useRecordFieldAnswer();

  /* ─── Drafts ──────────────────────────────────────────────────────────
   *
   * Only for a signed-in respondent: a draft has to be tied to an account,
   * because that account is how we recognise them when they come back. An
   * anonymous visitor gets no draft rather than a fake one that dies with the
   * browser session. Never in preview — the author's test answers are not
   * progress worth keeping. */
  const { userInfo, isPending: sessionPending } = useGetLoggedInUserInfo();
  const canSaveDraft = !!userInfo && !isPreview;

  /* ─── Who may respond ─────────────────────────────────────────────────
   *
   * Evaluated with the same helpers the server enforces with, so the gate the
   * respondent sees and the rule that rejects them can't disagree. Checked
   * before they start rather than at submit: asking somebody to answer fifty
   * questions and only then telling them to sign in wastes their time and
   * loses the answers.
   *
   * Preview skips all of it — the author is testing the form, not qualifying
   * to answer it. */
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

  /* Held back until the session has resolved. `userInfo` is null both for a
   * visitor who isn't signed in and for one whose session is still in flight,
   * and treating those the same would flash the sign-in wall at somebody who is
   * already signed in. On a form that doesn't need sign-in we don't wait at
   * all — the session is irrelevant there. */
  const gateResolving = needsSignIn && sessionPending;

  const mustSignIn = needsSignIn && !gateResolving && !signedInEmail;
  const wrongDomain =
    needsSignIn &&
    !!signedInEmail &&
    !isEmailDomainAllowed(signedInEmail, accessRules.allowedEmailDomains);

  /** Sign-in link that comes back to this exact form, preview flag and all. */
  const signInHref = useMemo(() => {
    const back = isPreview ? `/forms/${formId}?preview=1` : `/forms/${formId}`;
    return `/signIn?redirect=${encodeURIComponent(back)}`;
  }, [formId, isPreview]);

  /** Only forms that ask for a single response should lock the browser. With
   *  multiple responses allowed — the default — a returning visitor is simply
   *  answering again. */
  const locksToOneResponse = !!form?.oneResponsePerRespondent;

  const { draft, isFetched: draftFetched } = useGetDraft(formId, canSaveDraft);
  const { saveDraftAsync } = useSaveDraft();
  const { deleteDraftAsync } = useDeleteDraft();

  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [resumedFrom, setResumedFrom] = useState<string | null>(null);
  const draftRestoredRef = React.useRef(false);

  const [answers, setAnswers] = useState<Record<string, any>>({});

  /**
   * The pages this respondent has actually been shown, in order. The last
   * entry is the current page.
   *
   * This began as a `currentQuestionIndex` counter, became a path of question
   * ids when branching arrived, and is now a path of page indexes. The reason
   * it tracks pages rather than questions: a page can hold a whole segment, so
   * "where am I" and "what did I come from" are page-level facts. Questions
   * are recovered from the pages when they're needed — for validation, for the
   * answers that belong to the run, and for the thank-you summary.
   *
   * Position still can't be derived, because branching means two respondents
   * on their third page can be on different pages.
   */
  const [pagePath, setPagePath] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [siteRating, setSiteRating] = useState<number | null>(null);

  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  /**
   * An access rule the server rejected us on at submit time.
   *
   * The gate below normally catches this before the respondent starts, so this
   * only fires when the session changed underneath them — it expired while they
   * were filling, or they signed into a different account in another tab.
   * Recording it in state means submit-time and load-time refusals render the
   * same screen instead of one being a toast and the other a wall.
   */
  const [accessError, setAccessError] = useState<
    "sign-in-required" | "domain-not-allowed" | null
  >(null);

  const formOpenedAtRef = React.useRef<number>(Date.now());
  const visitorIdRef = React.useRef<string | null>(null);
  const idempotencyKeyRef = React.useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  /**
   * Storage key for the "you've already responded" shortcut, or null when there
   * is nothing to remember.
   *
   * Three conditions, each for its own reason:
   *
   *  - Null when the form takes multiple responses, which is now the default. A
   *    returning visitor there is simply answering again, and the old
   *    unconditional lockout turned that into a wall.
   *  - Null in preview, so a lockout from a real submission doesn't stop the
   *    author walking their own form.
   *  - Scoped to the account rather than the form alone. One-response forms
   *    always require sign-in, so there is always an account to scope by — and
   *    without it a shared computer would lock the second person out of a form
   *    the first person filled.
   *
   * The server is what actually enforces one response per account. This only
   * saves a respondent from answering fifty questions before being told.
   */
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

  /** No-op unless the form is actually limited to one response per account. */
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

  /**
   * A toggle's starting position, as the author configured it.
   *
   * Pulled out of the effect below so the two "begin again" paths — discarding
   * a draft, and answering a second time — can reset to these rather than to an
   * empty object. Resetting to `{}` left every toggle unset, which is not the
   * form the author designed.
   */
  const toggleDefaults = useMemo(() => {
    const defaults: Record<string, any> = {};
    (form?.fields ?? []).forEach((field) => {
      if (field.type === "TOGGLE") {
        defaults[field.id] = !!(field.options as any)?.defaultValue;
      }
    });
    return defaults;
  }, [form?.fields]);

  // Applied under `prev`, so a toggle the respondent has already changed — or
  // one restored from a draft — is never pulled back to its default.
  useEffect(() => {
    setAnswers((prev) => ({ ...toggleDefaults, ...prev }));
  }, [toggleDefaults]);

  /**
   * Restore a saved draft, once.
   *
   * The ref guard is the important part: this must run exactly once per mount.
   * Without it a refetch would re-apply the server's copy over answers typed
   * since, which reads as the form undoing your work.
   *
   * Draft answers are spread last so they win over the toggle defaults above —
   * a toggle the respondent deliberately switched off must not be reset to its
   * default on resume.
   */
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

  /* Autosave. Debounced rather than per-keystroke: a fifty-question form would
   * otherwise be a request per character. 1200ms is long enough to cover normal
   * typing and short enough that closing the tab a moment after answering still
   * keeps the answer — and `flush()` covers the rest. */
  const persistDraft = useCallback(
    (nextAnswers: Record<string, any>, nextPagePath: number[]) => {
      if (!canSaveDraft) return;
      if (Object.keys(nextAnswers).length === 0) return;

      setDraftStatus("saving");
      saveDraftAsync({ formId, values: nextAnswers, pagePath: nextPagePath })
        .then(() => setDraftStatus("saved"))
        .catch(() => {
          // Autosave is best-effort. A failure here must not interrupt someone
          // mid-form with a toast about a feature they didn't ask for; the
          // notice simply stops claiming the work is saved.
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

  /* Per-question answer tracking, also debounced. This used to fire only when
   * the respondent pressed Next, which meant a form abandoned mid-question
   * recorded nothing about the question they gave up on — the one thing the
   * drop-off report most needs to know. */
  const trackAnswer = useCallback(
    (fieldId: string, value: unknown) => {
      if (isPreview) return;
      recordFieldAnswer({ formId, fieldId, value });
    },
    [isPreview, formId, recordFieldAnswer],
  );

  const { run: queueTrackAnswer } = useDebouncedCallback(trackAnswer, 800);

  const handleFieldChange = (fieldId: string, value: any) => {
    setAnswers((prev) => {
      const next = { ...prev, [fieldId]: value };
      // Both saves are queued from here rather than from an effect on
      // `answers`, so they see the value that caused them and can't fire on a
      // restore or on the toggle defaults.
      queueDraftSave(next, pagePath);
      return next;
    });
    queueTrackAnswer(fieldId, value);
  };

  // Flattened traversal order plus the rule lookups. Rebuilt only when the
  // form payload changes, since every navigation decision reads it.
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

  /**
   * How many questions share a page, resolved from the author's setting.
   *
   * AUTO — the default — reads the form's shape: a form with one segment or
   * none is a single run of questions and reads best one at a time, while a
   * form the author split into several segments already has its pages, so we
   * show them. That means adding a second segment changes the respondent's
   * experience without the author having to find a setting.
   *
   * The rule count goes in because a single-page layout can't carry branching:
   * a rule that picks the next page needs there to be one. `resolveLayout`
   * paginates anyway in that case rather than honour a setting that would make
   * the page rearrange itself as the respondent answered.
   */
  const layout = useMemo(
    () =>
      resolveLayout(
        form?.questionLayout as QuestionLayout | undefined,
        flow.segments.length,
        (form?.logicRules ?? []).length,
      ),
    [form?.questionLayout, flow.segments.length, form?.logicRules],
  );

  /**
   * `answers` is a dependency because ALL_AT_ONCE renders the questions the
   * current answers lead through — with branching on, a question on a road not
   * taken has no business being on the page. The other two layouts ignore
   * answers here and are unaffected.
   */
  const pages = useMemo(() => buildPages(flow, layout, answers), [flow, layout, answers]);

  // Start the respondent on the first page once the form has loaded. Guarded
  // on `pagePath.length` so a background refetch can't reset someone mid-form
  // back to the beginning.
  useEffect(() => {
    if (pagePath.length > 0 || pages.length === 0) return;
    setPagePath([0]);
  }, [pages.length, pagePath.length]);

  const currentPageIndex = pagePath[pagePath.length - 1] ?? 0;
  const currentPage = pages[currentPageIndex];

  /** Questions on the current page, resolved to field objects. */
  const currentFields = useMemo(
    () =>
      (currentPage?.fieldIds ?? [])
        .map((fieldId) => flow.fieldById.get(fieldId))
        .filter((field): field is FlowField => !!field),
    [currentPage, flow],
  );

  /** Whole-form question numbering for the Q01 eyebrow. Page-relative
   *  numbering would restart at 1 on every page. */
  const questionNumbers = useMemo(() => {
    const numbers: Record<string, number> = {};
    flow.order.forEach((field, i) => {
      numbers[field.id] = i + 1;
    });
    return numbers;
  }, [flow]);

  // Recomputed on every answer change, which is the point: choosing an option
  // that ends the form flips the button to "Submit" immediately rather than
  // after the respondent commits to it.
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

  /**
   * Progress over the route this respondent is on, not over the whole form.
   *
   * Dividing by the total would be meaningless once branches can skip most of
   * a form — a three-page path through a twenty-page form would crawl to 15%
   * and then jump straight to done. Dividing by the length of their own route
   * keeps it honest, at the cost of shifting when a branch changes what's
   * ahead.
   *
   * ALL_AT_ONCE has exactly one page, where that calculation only ever reads
   * 0% or 100%. There, answered-out-of-visible is the only measure that moves.
   */
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

  /** Every question the respondent has actually been shown, in route order.
   *  Derived from the visited pages, so a multi-question page contributes all
   *  of its questions. */
  const visitedFieldIds = useMemo(
    () => pagePath.flatMap((pageIndex) => pages[pageIndex]?.fieldIds ?? []),
    [pagePath, pages],
  );

  // Used by the thank-you summary so it mirrors the submitted payload exactly.
  const answeredPathFields = useMemo(
    () =>
      visitedFieldIds
        .map((fieldId) => flow.fieldById.get(fieldId))
        .filter((field): field is FlowField => !!field),
    [flow, visitedFieldIds],
  );

  /* "Segment 2 of 3 · Your details" above the page. Null when there's nothing
   * meaningful to say — an unsegmented form, or a single-page layout where a
   * page counter would just be noise. */
  const segmentLabel = useMemo(() => {
    if (!currentPage?.segment) return null;
    const position = flow.segments.findIndex((s) => s.id === currentPage.segment?.id);
    if (position === -1) return null;
    return `Segment ${position + 1} of ${flow.segments.length} · ${currentPage.segment.title}`;
  }, [currentPage, flow.segments]);

  /**
   * Validate one question. Returns an error message, or null when it passes.
   *
   * Extracted because a page can hold many questions and every one of them has
   * to pass before the page advances — previously there was only ever one to
   * check, so the rules were written inline.
   */
  const validateField = (field: FlowField): string | null => {
    const value = answers[field.id];
    const missing =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

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

    // Every question on the page, in the order they appear, so the reported
    // problem is the first one the respondent will see when they look up.
    for (const field of currentFields) {
      const error = validateField(field);
      if (error) {
        toast.error(error);
        return;
      }
    }

    // Per-question analytics for the whole page. Debounced tracking already
    // covers questions as they're answered; this catches the rest — a TOGGLE
    // left at its default was never "changed", so nothing queued it.
    if (!isPreview) {
      for (const field of currentFields) {
        const value = answers[field.id];
        const hasAnswer =
          value !== undefined &&
          value !== null &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0);
        if (hasAnswer || field.type === "TOGGLE") {
          recordFieldAnswer({ formId, fieldId: field.id, value });
        }
      }
    }

    if (nextPage.kind === "page") {
      const advanced = [...pagePath, nextPage.pageIndex];
      setPagePath(advanced);
      // Save on page turn without waiting out the debounce. Leaving a page is
      // the moment a respondent is most likely to walk away, and it's also the
      // only way the stored page position stays in step with the answers.
      if (canSaveDraft) persistDraft(answers, advanced);
    } else {
      // Only answers for questions on the route actually taken. A respondent
      // who answered, went back, and took a different branch has a stale
      // answer sitting in state for a question they were never finally
      // asked; submitting it would record a response to a question that
      // wasn't part of this run and skew every per-question analytic.
      const payloadValues = answersOnPath(answers, visitedFieldIds).map(
        ({ formFieldId, value }) => ({ formFieldId, value }),
      );

      /* Preview stops here. The author gets the full completion experience —
       * the thank-you screen, their own answers summarised — with no request
       * made, so nothing is stored and the form's response count is untouched.
       * Returning before `submitForm` rather than having the server discard a
       * "preview" flag keeps that guarantee on this side of the network, where
       * it can't be defeated by a crafted request. */
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
            // The draft has served its purpose. Cancel the pending autosave
            // first, or it would fire after the delete and resurrect a draft
            // for a form the respondent has already completed.
            cancelDraftSave();
            if (canSaveDraft) void deleteDraftAsync({ formId }).catch(() => {});
            toast.success("Thanks — your response was submitted");
          },
          onError: (err) => {
            /* The service's sentinels, matched by exact string. Each one is a
             * rule the respondent can act on, so each gets the screen that says
             * what to do — falling through to a toast would show them a raw
             * error code and no way forward. */
            switch (err.message) {
              // Both mean "we already have your response": the first from the
              // idempotency/visitor path, the second from the per-account check.
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

  /**
   * Step back to the page we actually came from.
   *
   * Popping the path rather than decrementing an index is what makes Back
   * correct across a jump: after skipping pages 2-5, the page before 6 is 1,
   * and only the path knows that.
   *
   * Answers on the page being left are kept. If the respondent changes one and
   * comes forward again, the routing re-runs and may send them somewhere new —
   * and anything stranded by that re-route is filtered out at submit time by
   * `answersOnPath`.
   */
  const handleBack = () => {
    setPagePath((prev) => {
      if (prev.length <= 1) return prev;
      const back = prev.slice(0, -1);
      // Keep the stored position in step, so resuming doesn't drop them on a
      // page they had already navigated away from.
      if (canSaveDraft) persistDraft(answers, back);
      return back;
    });
  };

  const canGoBack = pagePath.length > 1;

  /**
   * Discard the restored draft and begin again.
   *
   * Offered because restoring answers silently is unsettling — the form appears
   * to already know things about you — and the only honest remedy is a visible
   * way to throw them away.
   */
  const handleStartOver = useCallback(() => {
    cancelDraftSave();
    setAnswers({ ...toggleDefaults });
    setPagePath(pages.length > 0 ? [0] : []);
    setResumedFrom(null);
    setDraftStatus("idle");
    if (canSaveDraft) void deleteDraftAsync({ formId }).catch(() => {});
    toast("Starting over — your saved answers were discarded");
  }, [cancelDraftSave, toggleDefaults, pages.length, canSaveDraft, deleteDraftAsync, formId]);

  /**
   * Answer the form a second time, without a reload.
   *
   * Offered only when the form takes multiple responses, and in preview
   * regardless — the author is testing, and being sent away after one pass is
   * exactly what they don't want.
   *
   * The idempotency key has to be replaced, not reused. It exists so a
   * double-click can't record two responses, which means submitting the second
   * response under the first one's key would be read as a replay: the server
   * would return the original submission and the respondent's new answers would
   * be silently dropped. `formOpenedAtRef` restarts for the same reason — the
   * time-spent figure should describe this response, not both.
   */
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

    // A fresh draft would otherwise be restored on top of the blank form the
    // moment the next answer queues a save.
    draftRestoredRef.current = true;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [cancelDraftSave, toggleDefaults, pages.length]);

  /** Whether to offer it at all. Preview included so the author can loop. */
  const canRespondAgain = isPreview || !locksToOneResponse;

  /* Save immediately when the tab is hidden or closed. The debounce is the
   * common path; this is the one that matters when someone closes the laptop
   * mid-answer. `visibilitychange` rather than `beforeunload` because mobile
   * browsers frequently never fire the latter. */
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
  // Sign-in-gated form, session still in flight. Keep loading rather than
  // guessing — see `gateResolving`.
  if (gateResolving) return <FormLoadingState />;
  if (!form.isPublished) return <FormErrorState type="draft-mode" />;
  if (!form.isOpen) return <FormErrorState type="closed" />;
  if (form.expiresAt && new Date() > new Date(form.expiresAt)) {
    return <FormErrorState type="expired" />;
  }

  /* Access gates, ordered after the form-level ones: whether the form is even
   * taking responses doesn't depend on who's asking, so a closed form should say
   * "closed" rather than demand a sign-in first and only then admit it's shut.
   *
   * Both are checked before the questions render. Letting somebody fill fifty
   * fields and refusing them at Submit wastes their time and loses the answers,
   * and for an anonymous respondent there's no draft to recover from. */
  if (mustSignIn || accessError === "sign-in-required") {
    return <FormErrorState type="sign-in-required" signInHref={signInHref} />;
  }
  if (wrongDomain || accessError === "domain-not-allowed") {
    return (
      <FormErrorState
        type="domain-not-allowed"
        allowedDomains={form.allowedEmailDomains ?? undefined}
        signInHref={signInHref}
      />
    );
  }

  if (alreadySubmitted) return <FormErrorState type="already-submitted" />;

  const formCode = form.slug.substring(0, 7).toUpperCase();

  return (
    <div className="cf-landing cf-dotgrid relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-(--cf-cream) text-(--cf-ink)">
      <Noise />

      {/* Outside the padded column so it spans the full width and can stick. */}
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
              /* Only the questions on the route taken. Passing every field
               would let the summary list an answer from an abandoned branch
               that `answersOnPath` correctly withheld from the submission —
               showing the respondent something the server never received. */
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
                /* A multi-question page advances a page, not a question, and
                 saying so is the difference between "Next" meaning one more
                 question and one more section. */
                nextLabel={currentFields.length > 1 ? "Next section" : "Next"}
              />
            </div>
          )}
        </main>

        <FormFooter />
      </div>
    </div>
  );
}
