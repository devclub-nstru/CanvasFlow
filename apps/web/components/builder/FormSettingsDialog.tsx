"use client";

import React, { useState, useEffect } from "react";
import { Settings, X, Calendar, ShieldAlert } from "lucide-react";
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

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[color:var(--cf-ink)]/45 backdrop-blur-sm p-4">
      <div className="bg-[color:var(--cf-cream-2)] rounded-2xl ring-1 ring-[color:var(--cf-line-strong)] p-6 max-w-md w-full shadow-[0_30px_80px_-30px_rgba(22,19,17,0.35)] flex flex-col gap-5">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[color:var(--cf-orange)]/10 text-[color:var(--cf-orange)]">
              <Settings className="size-4.5" />
            </div>
            <div>
              <p className="cf-eyebrow text-[color:var(--cf-orange)]">Settings</p>
              <h3 className="mt-0.5 cf-display text-[20px] leading-tight text-[color:var(--cf-ink)]">
                Form Settings
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[color:var(--cf-cream)] text-[color:var(--cf-ink-soft)] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="size-4.5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 pt-1 border-t border-[color:var(--cf-line)] text-[13px]"
        >
          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[color:var(--cf-ink-soft)]">
              Form Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[color:var(--cf-cream)] rounded-lg ring-1 ring-[color:var(--cf-line)] px-3 py-1.5 text-[13px] text-[color:var(--cf-ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--cf-orange)]"
              placeholder="My Form"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[color:var(--cf-ink-soft)]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-[color:var(--cf-cream)] rounded-lg ring-1 ring-[color:var(--cf-line)] px-3 py-1.5 text-[13px] text-[color:var(--cf-ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--cf-orange)] resize-none"
              placeholder="Form description..."
            />
          </div>

          {/* Accept Submissions */}
          <div className="flex items-center justify-between py-2 border-y border-[color:var(--cf-line)]">
            <div>
              <p className="font-semibold text-[color:var(--cf-ink)]">Accepting submissions</p>
              <p className="text-[11px] text-[color:var(--cf-ink-soft)]">
                Manually open or close this form
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isOpen ? "bg-[color:var(--cf-orange)]" : "bg-[color:var(--cf-line-strong)]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isOpen ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Expiration Date */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-[color:var(--cf-ink-soft)]" />
                <span className="font-medium text-[color:var(--cf-ink)]">Set expiration date</span>
              </div>
              <input
                type="checkbox"
                checked={enableExpiration}
                onChange={(e) => setEnableExpiration(e.target.checked)}
                className="accent-[color:var(--cf-orange)] cursor-pointer"
              />
            </div>
            {enableExpiration && (
              <input
                type="datetime-local"
                required={enableExpiration}
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-[color:var(--cf-cream)] rounded-lg ring-1 ring-[color:var(--cf-line)] px-3 py-1.5 text-[13px] text-[color:var(--cf-ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--cf-orange)]"
              />
            )}
          </div>

          {/* Submission Limit */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="size-3.5 text-[color:var(--cf-ink-soft)]" />
                <span className="font-medium text-[color:var(--cf-ink)]">
                  Limit total submissions
                </span>
              </div>
              <input
                type="checkbox"
                checked={enableLimit}
                onChange={(e) => setEnableLimit(e.target.checked)}
                className="accent-[color:var(--cf-orange)] cursor-pointer"
              />
            </div>
            {enableLimit && (
              <input
                type="number"
                required={enableLimit}
                min={0}
                placeholder="100"
                value={maxSubmissions}
                onChange={(e) =>
                  setMaxSubmissions(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-full bg-[color:var(--cf-cream)] rounded-lg ring-1 ring-[color:var(--cf-line)] px-3 py-1.5 text-[13px] text-[color:var(--cf-ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--cf-orange)]"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--cf-line)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 h-[34px] text-[12px] rounded-lg text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line-strong)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-1.5 h-[34px] rounded-lg bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
