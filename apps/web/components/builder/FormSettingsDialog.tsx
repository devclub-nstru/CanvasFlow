"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useUpdateFormSettings } from "~/hooks/api/form";

interface FormSettingsDialogProps {
  show: boolean;
  form: {
    id: string;
    title: string;
    description?: string | null;
    isOpen: boolean;
    maxSubmissions?: number | null;
    expiresAt?: any | null;
  } | null;
  onClose: () => void;
}

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
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="cf-toggle"
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
        {Icon && <Icon className="mt-0.5 size-3.5 shrink-0 text-[color:var(--cf-ink-soft)]" />}
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[color:var(--cf-ink)]">{title}</p>
          <p className="text-[11px] leading-relaxed text-[color:var(--cf-ink-soft)]">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function FormSettingsDialog({ show, form, onClose }: FormSettingsDialogProps) {
  const { updateFormSettingsAsync, isPending } = useUpdateFormSettings();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [enableLimit, setEnableLimit] = useState(false);
  const [maxSubmissions, setMaxSubmissions] = useState<number | "">("");
  const [enableExpiration, setEnableExpiration] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (form) {
      setTitle(form.title);
      setDescription(form.description || "");
      setIsOpen(form.isOpen);
      setEnableLimit(!!form.maxSubmissions);
      setMaxSubmissions(form.maxSubmissions ?? "");
      setEnableExpiration(!!form.expiresAt);
      setExpiresAt(toDatetimeLocal(form.expiresAt));
    }
  }, [form, show]);

  if (!show || !form) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Form title cannot be empty");
      return;
    }

    try {
      await updateFormSettingsAsync({
        id: form.id,
        title: title.trim(),
        description: description.trim() || null,
        isOpen,
        maxSubmissions: enableLimit && maxSubmissions !== "" ? Number(maxSubmissions) : null,
        expiresAt: enableExpiration && expiresAt ? new Date(expiresAt).toISOString() : null,
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
    enableLimit && maxSubmissions !== "" ? `caps at ${maxSubmissions}` : "no cap",
  ].join(" · ");

  return (
    <div className="cf-scrim z-[300]">
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

                <div className="space-y-2">
                  <Row
                    icon={ShieldAlert}
                    title="Submission limit"
                    hint="Stop accepting after a total count"
                  >
                    <Toggle
                      on={enableLimit}
                      onChange={setEnableLimit}
                      label="Limit total submissions"
                    />
                  </Row>
                  {enableLimit && (
                    <input
                      type="number"
                      required
                      /* 1, not 0 — a cap of zero would publish a form that
                         can never be answered. */
                      min={1}
                      placeholder="100"
                      value={maxSubmissions}
                      onChange={(e) =>
                        setMaxSubmissions(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="cf-input px-3 py-2 text-[13px]"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="cf-dialog-foot">
            <span className="min-w-0 truncate">{summary}</span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="cf-btn-outline h-[32px] px-3 text-[12px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="cf-btn h-[32px] px-4 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
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
