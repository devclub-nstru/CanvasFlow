"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, Lock, Mail, UserCheck, AtSign, Plus } from "lucide-react";
import { toast } from "sonner";
import { useUpdateFormSettings } from "~/hooks/api/form";
import { normaliseDomain } from "~/lib/form-access";
import { canRenderOnOnePage } from "~/lib/form-flow";

type QuestionLayout = "AUTO" | "ONE_PER_PAGE" | "SEGMENT_PER_PAGE" | "ALL_AT_ONCE";

/** Matches the service's cap, so the author is stopped here rather than by a
 *  validation error after pressing Save. */
const MAX_DOMAINS = 20;
const MAX_THANK_YOU = 2000;

interface FormSettingsDialogProps {
  show: boolean;
  form: {
    id: string;
    title: string;
    description?: string | null;
    isOpen: boolean;
    expiresAt?: any | null;
    questionLayout?: QuestionLayout | null;
    requireSignIn?: boolean | null;
    collectRespondentEmail?: boolean | null;
    oneResponsePerRespondent?: boolean | null;
    allowedEmailDomains?: string[] | null;
    thankYouMessage?: string | null;
  } | null;
  /** Drives the sentence explaining what AUTO resolves to for this form. */
  segmentCount?: number;
  /** Active branching rules. A form that branches can't be shown on one page. */
  ruleCount?: number;
  onClose: () => void;
}

/**
 * The four layouts, worded from the respondent's side rather than the
 * schema's — an author is choosing what filling the form feels like, not
 * naming an enum.
 */
const LAYOUT_CHOICES: Array<{ value: QuestionLayout; title: string; hint: string }> = [
  {
    value: "AUTO",
    title: "Match the form's shape",
    hint: "One question at a time until you add a second segment, then one segment per page.",
  },
  {
    value: "ONE_PER_PAGE",
    title: "One question per page",
    hint: "Focused and conversational. Best for longer forms and for phones.",
  },
  {
    value: "SEGMENT_PER_PAGE",
    title: "One segment per page",
    hint: "Each segment's questions together, with Next between them.",
  },
  {
    value: "ALL_AT_ONCE",
    title: "Everything on one page",
    hint: "The whole form in a single scroll, like a classic web form.",
  },
];

const toDatetimeLocal = (d?: string | Date | null) => {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().slice(0, 16);
};

/* The three booleans here all gate behaviour, so they all read as switches.
   Two of them used to be bare `accent-color` checkboxes sitting beside a
   custom switch, which made the same kind of decision look like two
   different kinds of control. */
function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  /** Used for a switch another setting is holding on. Left visibly on and
   *  inert, rather than hidden: the author needs to see that the requirement
   *  applies, and why turning it off here wouldn't work. */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      className="cf-toggle disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span />
    </button>
  );
}

function Row({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon?: React.ElementType;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cf-row">
      <div className="flex min-w-0 items-start gap-2">
        {Icon && <Icon className="mt-0.5 size-3.5 shrink-0 text-(--cf-ink-soft)" />}
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-(--cf-ink)">{title}</p>
          <p className="text-[11px] leading-relaxed text-(--cf-ink-soft)">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function FormSettingsDialog({
  show,
  form,
  segmentCount = 0,
  ruleCount = 0,
  onClose,
}: FormSettingsDialogProps) {
  const { updateFormSettingsAsync, isPending } = useUpdateFormSettings();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questionLayout, setQuestionLayout] = useState<QuestionLayout>("AUTO");
  const [isOpen, setIsOpen] = useState(true);
  const [enableExpiration, setEnableExpiration] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const [requireSignIn, setRequireSignIn] = useState(false);
  const [collectRespondentEmail, setCollectRespondentEmail] = useState(false);
  const [oneResponsePerRespondent, setOneResponsePerRespondent] = useState(false);
  const [restrictDomains, setRestrictDomains] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState("");

  useEffect(() => {
    if (form) {
      setTitle(form.title);
      setDescription(form.description || "");
      setQuestionLayout(form.questionLayout ?? "AUTO");
      setIsOpen(form.isOpen);
      setEnableExpiration(!!form.expiresAt);
      setExpiresAt(toDatetimeLocal(form.expiresAt));

      setRequireSignIn(!!form.requireSignIn);
      setCollectRespondentEmail(!!form.collectRespondentEmail);
      setOneResponsePerRespondent(!!form.oneResponsePerRespondent);
      // The toggle is derived from whether any domains are stored rather than
      // kept as its own column — an empty allow-list and no restriction are the
      // same thing, and storing both invites them to disagree.
      setDomains(form.allowedEmailDomains ?? []);
      setRestrictDomains((form.allowedEmailDomains?.length ?? 0) > 0);
      setDomainInput("");
      setThankYouMessage(form.thankYouMessage ?? "");
    }
  }, [form, show]);

  if (!show || !form) return null;

  /* Whether "everything on one page" is still on the table, decided by the same
     function the renderer uses so the dialog can't offer a layout the renderer
     would override. */
  const onePageAllowed = canRenderOnOnePage(segmentCount, ruleCount);
  const onePageBlockedReason =
    ruleCount > 0 && segmentCount > 1
      ? "This form branches and is split into segments, so it needs pages."
      : ruleCount > 0
        ? "This form uses branching, which needs a next page to send people to."
        : "This form is split into segments, which are its pages.";

  /* The dependency, stated once.
   *
   * Recording an email, holding someone to one response, and restricting by
   * domain all need an account to read, so each of them turns sign-in on
   * whether or not the author ticked it. Showing that here — rather than only
   * applying it server-side — is the difference between a switch that looks
   * off while behaving as on, and one the author can see is being held. */
  const activeDomains = restrictDomains ? domains : [];
  const signInImplied =
    collectRespondentEmail || oneResponsePerRespondent || activeDomains.length > 0;
  const signInEffective = requireSignIn || signInImplied;

  const impliedBy = [
    collectRespondentEmail && "recording emails",
    oneResponsePerRespondent && "one response per person",
    activeDomains.length > 0 && "the domain restriction",
  ].filter(Boolean) as string[];

  const addDomain = () => {
    const candidate = normaliseDomain(domainInput);

    if (!candidate) {
      setDomainInput("");
      return;
    }
    // A domain needs a dot and a plausible TLD. Without the check a typo like
    // "gmail" would save happily and then match nothing, which reads as the
    // restriction rejecting everyone for no reason.
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(candidate)) {
      toast.error(`"${domainInput.trim()}" doesn't look like a domain`);
      return;
    }
    if (candidate.length > 255) {
      toast.error("That domain is too long");
      return;
    }
    if (domains.includes(candidate)) {
      toast.error(`${candidate} is already on the list`);
      setDomainInput("");
      return;
    }
    if (domains.length >= MAX_DOMAINS) {
      toast.error(`At most ${MAX_DOMAINS} domains`);
      return;
    }

    setDomains((prev) => [...prev, candidate]);
    setDomainInput("");
  };

  const removeDomain = (domain: string) =>
    setDomains((prev) => prev.filter((d) => d !== domain));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Form title cannot be empty");
      return;
    }

    if (restrictDomains && domains.length === 0) {
      toast.error("Add at least one domain, or turn the restriction off");
      return;
    }

    try {
      await updateFormSettingsAsync({
        id: form.id,
        title: title.trim(),
        description: description.trim() || null,
        isOpen,
        questionLayout,
        expiresAt: enableExpiration && expiresAt ? new Date(expiresAt).toISOString() : null,

        // The effective value, not the raw switch. The service derives the same
        // thing, but sending what the dialog displayed means a reopened dialog
        // shows the state the author left rather than one shifting under them.
        requireSignIn: signInEffective,
        collectRespondentEmail,
        oneResponsePerRespondent,
        allowedEmailDomains: activeDomains.length > 0 ? activeDomains : null,
        thankYouMessage: thankYouMessage.trim() || null,
      });
      toast.success("Settings updated successfully");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update form settings");
    }
  };

  // Footer summary, built from the pending state rather than the saved form,
  // so it previews what Save will actually do.
  const summary = [
    isOpen ? "Accepting" : "Closed",
    enableExpiration && expiresAt ? "expires" : "no expiry",
    LAYOUT_CHOICES.find((c) => c.value === questionLayout)?.title.toLowerCase() ?? "",
    signInEffective ? "sign-in required" : "open to anyone",
    oneResponsePerRespondent ? "1 response each" : "multiple responses",
    activeDomains.length > 0
      ? `${activeDomains.length} domain${activeDomains.length === 1 ? "" : "s"}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="cf-scrim z-300">
      <div className="cf-dialog max-h-[88vh] max-w-lg">
        <div className="cf-dialog-bar">
          <span className="min-w-0 truncate">Settings · {form.title}</span>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase"
              style={
                isOpen
                  ? { borderColor: "var(--cf-orange)", color: "var(--cf-orange)" }
                  : { borderColor: "var(--cf-line-strong)", color: "var(--cf-ink-soft)" }
              }
            >
              {isOpen ? "Open" : "Closed"}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="cf-btn-outline size-7"
              aria-label="Close dialog"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* The form is the flex column so the body scrolls and the actions in
            the footer stay pinned. */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="cf-dialog-body space-y-5">
            <div>
              <label htmlFor="cf-set-title" className="cf-meta mb-2 block">
                Form title
              </label>
              <input
                id="cf-set-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="cf-input px-3 py-2 text-[13px]"
                placeholder="My form"
              />
            </div>

            <div>
              <label htmlFor="cf-set-desc" className="cf-meta mb-2 block">
                Description
              </label>
              <textarea
                id="cf-set-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="cf-input resize-none px-3 py-2 text-[13px]"
                placeholder="A short note for respondents..."
              />
            </div>

            <div>
              <p className="cf-meta mb-2">Layout</p>
              <div className="space-y-1.5">
                {LAYOUT_CHOICES.map((choice) => {
                  const on = questionLayout === choice.value;
                  /* Offered only while it would actually be honoured. A
                     branching or segmented form is paginated by the renderer
                     whatever this says, and a switch that silently does nothing
                     is worse than one that explains why it can't. */
                  const blocked = choice.value === "ALL_AT_ONCE" && !onePageAllowed;

                  return (
                    <button
                      key={choice.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-disabled={blocked}
                      disabled={blocked}
                      onClick={() => setQuestionLayout(choice.value)}
                      className={`flex w-full items-start gap-2.5 border px-3 py-2.5 text-left transition-colors ${
                        blocked ? "cursor-not-allowed opacity-55" : "cursor-pointer"
                      }`}
                      style={{
                        borderColor: on ? "var(--cf-orange)" : "var(--cf-line-strong)",
                        background: on ? "var(--cf-cream)" : "var(--cf-cream-2)",
                        boxShadow: on && !blocked ? "3px 3px 0 0 var(--cf-orange)" : undefined,
                      }}
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center border"
                        style={{
                          borderColor: on ? "var(--cf-orange)" : "var(--cf-line-strong)",
                          background: on ? "var(--cf-orange)" : "#fff",
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-(--cf-ink)">
                          {choice.title}
                          {choice.value === "AUTO" && (
                            <span className="ml-1.5 font-mono text-[9.5px] tracking-wider text-(--cf-ink-soft) uppercase">
                              default
                            </span>
                          )}
                          {blocked && (
                            <span className="ml-1.5 font-mono text-[9.5px] tracking-wider text-(--cf-orange) uppercase">
                              unavailable
                            </span>
                          )}
                        </span>
                        <span className="block text-[11.5px] leading-relaxed text-(--cf-ink-soft)">
                          {blocked ? onePageBlockedReason : choice.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Names what AUTO has actually chosen for this form. Without it
                  the default is the one option whose behaviour the author
                  can't see. */}
              {questionLayout === "AUTO" && (
                <p className="mt-2 text-[11.5px] leading-relaxed text-(--cf-ink-soft)">
                  {segmentCount > 1
                    ? `This form has ${segmentCount} segments, so respondents get one segment per page.`
                    : "This form has one segment, so respondents get one question per page."}
                </p>
              )}

              {/* The form was set to one page before it branched or was split.
                  The setting is kept rather than rewritten — remove the
                  branching and the author's choice comes back — so the honest
                  thing is to say it isn't in force right now. */}
              {questionLayout === "ALL_AT_ONCE" && !onePageAllowed && (
                <p className="mt-2 text-[11.5px] leading-relaxed text-(--cf-orange)">
                  Saved as one page, but not in use: {onePageBlockedReason} Respondents currently
                  get{" "}
                  {segmentCount > 1 ? "one segment per page" : "one question per page"}.
                </p>
              )}
            </div>

            <div>
              <p className="cf-meta mb-2">Availability</p>
              <div className="space-y-2">
                <Row title="Accepting submissions" hint="Manually open or close this form">
                  <Toggle on={isOpen} onChange={setIsOpen} label="Accepting submissions" />
                </Row>

                <div className="space-y-2">
                  <Row
                    icon={Calendar}
                    title="Expiration date"
                    hint="Stop accepting after a given time"
                  >
                    <Toggle
                      on={enableExpiration}
                      onChange={setEnableExpiration}
                      label="Set an expiration date"
                    />
                  </Row>
                  {enableExpiration && (
                    <input
                      type="datetime-local"
                      required
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="cf-input px-3 py-2 text-[13px]"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ── Who can respond ─────────────────────────────────────────
                Ordered so the requirement everything else depends on comes
                first, and each dependent setting sits below the thing it
                switches on. */}
            <div>
              <p className="cf-meta mb-2">Who can respond</p>
              <div className="space-y-2">
                <Row
                  icon={Lock}
                  title="Require sign-in"
                  hint={
                    signInImplied
                      ? `Held on by ${impliedBy.join(" and ")}.`
                      : "Respondents sign in to a CanvasFlow account before answering."
                  }
                >
                  <Toggle
                    on={signInEffective}
                    onChange={setRequireSignIn}
                    label="Require sign-in"
                    disabled={signInImplied}
                  />
                </Row>

                <Row
                  icon={Mail}
                  title="Record respondent email"
                  hint="Saves each respondent's account email with their response. Turns on sign-in."
                >
                  <Toggle
                    on={collectRespondentEmail}
                    onChange={setCollectRespondentEmail}
                    label="Record respondent email"
                  />
                </Row>

                <Row
                  icon={UserCheck}
                  title="One response per person"
                  hint="Off by default, so people can answer more than once. Turns on sign-in."
                >
                  <Toggle
                    on={oneResponsePerRespondent}
                    onChange={setOneResponsePerRespondent}
                    label="One response per person"
                  />
                </Row>

                <div className="space-y-2">
                  <Row
                    icon={AtSign}
                    title="Restrict to an organisation"
                    hint="Only accounts on these email domains can answer. Turns on sign-in."
                  >
                    <Toggle
                      on={restrictDomains}
                      onChange={setRestrictDomains}
                      label="Restrict to an organisation"
                    />
                  </Row>

                  {restrictDomains && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={domainInput}
                          onChange={(e) => setDomainInput(e.target.value)}
                          /* Enter adds the domain rather than submitting the
                             dialog, which is what a text input inside a form
                             does by default — and saving on Enter would strand
                             the domain the author had just typed. */
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              addDomain();
                            }
                          }}
                          className="cf-input px-3 py-2 text-[13px]"
                          placeholder="rishihood.edu.in"
                          aria-label="Add an email domain"
                        />
                        <button
                          type="button"
                          onClick={addDomain}
                          className="cf-btn-outline h-auto shrink-0 px-3 text-[12px]"
                        >
                          <Plus className="size-3.5" />
                          Add
                        </button>
                      </div>

                      {domains.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {domains.map((domain) => (
                            <li key={domain}>
                              <span
                                className="inline-flex items-center gap-1 border px-2 py-1 font-mono text-[11px]"
                                style={{
                                  borderColor: "var(--cf-line-strong)",
                                  background: "var(--cf-cream)",
                                }}
                              >
                                @{domain}
                                <button
                                  type="button"
                                  onClick={() => removeDomain(domain)}
                                  aria-label={`Remove ${domain}`}
                                  className="cursor-pointer text-(--cf-ink-soft) hover:text-(--cf-ink)"
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-(--cf-orange)">
                          Add at least one domain, or turn the restriction off.
                        </p>
                      )}

                      {/* Subdomain behaviour, spelled out. It's the part an
                          author would otherwise have to discover by testing —
                          and the part that decides whether they need to list
                          every department separately. */}
                      <p className="text-[11px] leading-relaxed text-(--cf-ink-soft)">
                        Subdomains are included. <span className="font-mono">rishihood.edu.in</span>{" "}
                        accepts both <span className="font-mono">kamlesh@rishihood.edu.in</span> and{" "}
                        <span className="font-mono">dittya@nst.rishihood.edu.in</span>.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── After submitting ── */}
            <div>
              <label htmlFor="cf-set-thanks" className="cf-meta mb-2 block">
                Thank-you note
              </label>
              <textarea
                id="cf-set-thanks"
                value={thankYouMessage}
                onChange={(e) => setThankYouMessage(e.target.value)}
                rows={3}
                maxLength={MAX_THANK_YOU}
                className="cf-input resize-none px-3 py-2 text-[13px]"
                placeholder="We'll be in touch by Friday..."
              />
              <div className="mt-1.5 flex items-start justify-between gap-3">
                <p className="text-[11px] leading-relaxed text-(--cf-ink-soft)">
                  Shown below the standard confirmation, not instead of it — respondents still get
                  told their answer was recorded.
                </p>
                {thankYouMessage.length > 0 && (
                  <span className="shrink-0 font-mono text-[10px] text-(--cf-ink-soft)">
                    {thankYouMessage.length}/{MAX_THANK_YOU}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="cf-dialog-foot">
            <span className="min-w-0 truncate">{summary}</span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="cf-btn-outline h-8 px-3 text-[12px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="cf-btn h-8 px-4 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save settings"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
