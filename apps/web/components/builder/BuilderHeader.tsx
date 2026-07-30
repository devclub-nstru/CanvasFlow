"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  Eye,
  LayoutGrid,
  ListOrdered,
  MoreVertical,
  Save,
  Settings,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

/** Which editing surface the builder is showing. */
export type BuilderView = "canvas" | "outline";

interface BuilderHeaderProps {
  form:
    | {
        title: string;
        description?: string | null;
        isPublished: boolean;
        ownerEmail?: string | null;
        role?: "owner" | "editor" | "viewer";
        permissions?: any;
      }
    | null
    | undefined;
  formId: string;
  isDirty: boolean;
  isSaving: boolean;
  justSaved?: boolean;
  publishPending: boolean;
  handleSave: () => Promise<void>;
  setShowDeleteConfirm: (val: boolean) => void;
  publishForm: (
    args: { id: string },
    callbacks: { onSuccess: () => void; onError: (err: any) => void },
  ) => void;
  onPublishSuccess?: () => void;
  pendingNavRef: React.MutableRefObject<string | null>;
  setShowUnsavedDialog: (val: boolean) => void;
  onShare: () => void;
  onSettings: () => void;
  view: BuilderView;
  onViewChange: (view: BuilderView) => void;
}

export function BuilderHeader({
  form,
  formId,
  isDirty,
  isSaving,
  justSaved,
  publishPending,
  handleSave,
  setShowDeleteConfirm,
  publishForm,
  pendingNavRef,
  setShowUnsavedDialog,
  onPublishSuccess,
  onShare,
  onSettings,
  view,
  onViewChange,
}: BuilderHeaderProps) {
  const isPublished = form?.isPublished ?? false;
  const isOwner = form?.role === "owner";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const canDelete = form?.permissions?.settings?.canDelete ?? form?.role === "owner";

  // Close kebab menu on outside click / ESC
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header
      className="z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3 sm:px-4"
      style={{ borderBottomColor: "var(--cf-line-strong)", background: "var(--cf-cream-2)" }}
    >
      {/* left: back + title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Link
          href="/dashboard/sketches"
          onClick={(e) => {
            if (isDirty) {
              e.preventDefault();
              pendingNavRef.current = "/dashboard/sketches";
              setShowUnsavedDialog(true);
            }
          }}
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-[color:var(--cf-ink-soft)] transition-colors hover:text-[color:var(--cf-ink)]"
          aria-label="Back to forms"
        >
          <ChevronLeft className="size-3.5" />
          <span className="hidden sm:inline">Forms</span>
        </Link>

        <div className="hidden h-4 w-px sm:block" style={{ background: "var(--cf-line-strong)" }} />

        {/* title only on sm+ — phones don't have space for it */}
        <div className="hidden sm:flex items-center gap-2 min-w-0">
          <span className="cf-display max-w-[200px] truncate text-[16px] leading-none text-[color:var(--cf-ink)]">
            {form?.title}
          </span>
        </div>

        {/* status pill — always visible */}
        <span
          className={`inline-flex shrink-0 items-center gap-1 border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase ${
            isPublished
              ? "border-[color:var(--cf-orange)] text-[color:var(--cf-orange)]"
              : "border-[color:var(--cf-line-strong)] text-[color:var(--cf-ink-soft)]"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              isPublished ? "bg-[color:var(--cf-orange)]" : "bg-[color:var(--cf-ink-soft)]"
            }`}
          />
          {isPublished ? "Live" : "Draft"}
        </span>

        {isDirty && (
          <span className="hidden shrink-0 items-center gap-1 border border-[color:var(--cf-orange)] px-2 py-0.5 font-mono text-[10px] text-[color:var(--cf-orange)] md:inline-flex">
            <span className="size-1 animate-pulse rounded-full bg-[color:var(--cf-orange)]" />
            Unsaved
          </span>
        )}
      </div>

      {/* right: actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* View switcher. Desktop only: the canvas needs pointer
            drag-and-drop plus room for three panes, so below lg the list is
            the only surface and offering a choice would be a dead end. */}
        <div
          role="group"
          aria-label="Builder view"
          className="hidden shrink-0 items-center border lg:inline-flex"
          style={{ borderColor: "var(--cf-line-strong)" }}
        >
          {(
            [
              { id: "canvas", label: "Canvas", Icon: LayoutGrid },
              { id: "outline", label: "Outline", Icon: ListOrdered },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onViewChange(id)}
                aria-pressed={active}
                title={id === "canvas" ? "Canvas builder" : "Outline builder"}
                className={`inline-flex h-[30px] cursor-pointer items-center gap-1.5 px-2.5 font-mono text-[10px] tracking-wider uppercase transition-colors ${
                  active
                    ? "bg-[color:var(--cf-ink)] text-[color:var(--cf-cream)]"
                    : "text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-ink)]"
                }`}
              >
                <Icon className="size-3.5" />
                <span className="hidden xl:inline">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden h-5 w-px lg:block" style={{ background: "var(--cf-line-strong)" }} />

        {/* Save — always visible, icon-only on phone */}
        <button
          onClick={handleSave}
          disabled={(!isDirty && !justSaved) || isSaving}
          title="Save changes"
          aria-label="Save"
          className={`inline-flex h-[32px] cursor-pointer items-center gap-1.5 border px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed sm:px-3 ${
            justSaved && !isSaving
              ? "border-[color:var(--cf-orange)] text-[color:var(--cf-orange)]"
              : "cf-btn-outline disabled:opacity-35"
          }`}
        >
          {justSaved && !isSaving ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
          <span className="hidden sm:inline">
            {isSaving ? "Saving..." : justSaved ? "Saved" : "Save"}
          </span>
        </button>

        {/* Preview / Share / Delete — visible on sm+ */}
        <Link
          href={`/forms/${formId}`}
          target="_blank"
          title="Preview form"
          className="cf-btn-outline hidden h-[32px] px-3 text-[12px] sm:inline-flex"
        >
          <Eye className="size-3.5" />
          <span className="hidden md:inline">Preview</span>
        </Link>

        <button
          onClick={onShare}
          title="Share form access"
          className="cf-btn-outline hidden h-[32px] px-3 text-[12px] sm:inline-flex"
        >
          <Share2 className="size-3.5" />
          <span className="hidden md:inline">Share</span>
        </button>

        {isOwner && (
          <button
            onClick={onSettings}
            title="Form settings"
            className="cf-btn-outline hidden h-[32px] px-3 text-[12px] sm:inline-flex"
          >
            <Settings className="size-3.5" />
            <span className="hidden md:inline">Settings</span>
          </button>
        )}

        {canDelete && (
          <>
            <div
              className="mx-0.5 hidden h-5 w-px sm:block"
              style={{ background: "var(--cf-line-strong)" }}
            />
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete form"
              className="cf-btn-danger hidden h-[32px] px-3 text-[12px] sm:inline-flex"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden md:inline">Delete</span>
            </button>
          </>
        )}

        {/* Mobile kebab menu — holds Preview / Share / Delete */}
        <div ref={menuRef} className="relative sm:hidden">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="cf-btn-outline inline-flex size-[32px]"
          >
            <MoreVertical className="size-3.5" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="cf-panel cf-raised absolute top-full right-0 z-50 mt-1.5 w-44 p-1.5"
            >
              <Link
                href={`/forms/${formId}`}
                target="_blank"
                onClick={() => setMenuOpen(false)}
                className="cf-menu-item flex items-center gap-2.5 !py-2 text-[13px]"
              >
                <Eye className="size-3.5" />
                Preview
              </Link>
              <button
                onClick={() => {
                  onShare();
                  setMenuOpen(false);
                }}
                className="cf-menu-item flex w-full items-center gap-2.5 !py-2 text-[13px]"
              >
                <Share2 className="size-3.5" />
                Share form
              </button>
              {isOwner && (
                <button
                  onClick={() => {
                    onSettings();
                    setMenuOpen(false);
                  }}
                  className="cf-menu-item flex w-full items-center gap-2.5 !py-2 text-[13px]"
                >
                  <Settings className="size-3.5" />
                  Settings
                </button>
              )}
              {canDelete && (
                <>
                  <div className="my-1 h-px" style={{ background: "var(--cf-line)" }} />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="cf-menu-item !text-[color:var(--cf-danger)]"
                  >
                    <Trash2 className="size-3.5" />
                    Delete form
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Publish — always visible, always primary */}
        <button
          onClick={async () => {
            if (isDirty) await handleSave();
            publishForm(
              { id: formId },
              {
                onSuccess: () => {
                  toast.success("Form published");
                  onPublishSuccess?.();
                },
                onError: (err) => toast.error(err.message || "Failed to publish"),
              },
            );
          }}
          disabled={publishPending || isPublished}
          className="cf-btn h-[32px] shrink-0 px-3.5 text-[12.5px] tracking-tight disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
        >
          {publishPending ? "..." : isPublished ? "Published" : "Publish"}
        </button>
      </div>
    </header>
  );
}
