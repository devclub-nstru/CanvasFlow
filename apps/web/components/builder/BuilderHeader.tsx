"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  Eye,
  MoreVertical,
  Save,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
    callbacks: { onSuccess: () => void; onError: (err: any) => void }
  ) => void;
  onPublishSuccess?: () => void;
  pendingNavRef: React.MutableRefObject<string | null>;
  setShowUnsavedDialog: (val: boolean) => void;
  onShare: () => void;
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
}: BuilderHeaderProps) {
  const isPublished = form?.isPublished ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const canDelete = form?.permissions?.settings?.canDelete ?? (form?.role === "owner");

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
    <header className="h-14 px-3 sm:px-4 border-b border-[color:var(--cf-line)] flex items-center justify-between bg-[color:var(--cf-cream-2)] z-20 shrink-0 gap-2">
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
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[color:var(--cf-ink-soft)] hover:text-[color:var(--cf-ink)] transition-colors shrink-0"
          aria-label="Back to forms"
        >
          <ChevronLeft className="size-3.5" />
          <span className="hidden sm:inline">Forms</span>
        </Link>

        <div className="hidden sm:block w-px h-4 bg-[color:var(--cf-line-strong)]" />

        {/* title only on sm+ — phones don't have space for it */}
        <div className="hidden sm:flex items-center gap-2 min-w-0">
          <span className="cf-display text-[16px] leading-none truncate max-w-[200px] text-[color:var(--cf-ink)]">
            {form?.title}
          </span>
        </div>

        {/* status pill — always visible */}
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ring-1 ${
            isPublished
              ? "bg-[color:var(--cf-orange)]/15 text-[color:var(--cf-orange)] ring-[color:var(--cf-orange)]/30"
              : "bg-[color:var(--cf-cream)] text-[color:var(--cf-ink-soft)] ring-[color:var(--cf-line-strong)]"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              isPublished
                ? "bg-[color:var(--cf-orange)]"
                : "bg-[color:var(--cf-ink-soft)]/40"
            }`}
          />
          {isPublished ? "Live" : "Draft"}
        </span>

        {isDirty && (
          <span className="hidden md:inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-[color:var(--cf-orange)] bg-[color:var(--cf-orange)]/10 ring-1 ring-[color:var(--cf-orange)]/30">
            <span className="size-1 rounded-full bg-[color:var(--cf-orange)] animate-pulse" />
            Unsaved
          </span>
        )}
      </div>

      {/* right: actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Save — always visible, icon-only on phone */}
        <button
          onClick={handleSave}
          disabled={(!isDirty && !justSaved) || isSaving}
          title="Save changes"
          aria-label="Save"
          className={`inline-flex items-center gap-1.5 h-[32px] px-2.5 sm:px-3 rounded-full ring-1 text-[12px] font-medium disabled:cursor-not-allowed transition-colors cursor-pointer ${
            justSaved && !isSaving
              ? "ring-[color:var(--cf-orange)]/40 bg-[color:var(--cf-orange)]/12 text-[color:var(--cf-orange)]"
              : "ring-[color:var(--cf-line-strong)] bg-[color:var(--cf-cream)] hover:bg-[color:var(--cf-cream-2)] text-[color:var(--cf-ink)] disabled:opacity-35"
          }`}
        >
          {justSaved && !isSaving ? (
            <Check className="size-3.5" />
          ) : (
            <Save className="size-3.5" />
          )}
          <span className="hidden sm:inline">
            {isSaving ? "Saving..." : justSaved ? "Saved" : "Save"}
          </span>
        </button>

        {/* Preview / Share / Delete — visible on sm+ */}
        <Link
          href={`/forms/${formId}`}
          target="_blank"
          title="Preview form"
          className="hidden sm:inline-flex items-center gap-1.5 h-[32px] px-3 rounded-full ring-1 ring-[color:var(--cf-line-strong)] bg-[color:var(--cf-cream)] hover:bg-[color:var(--cf-cream-2)] text-[12px] font-medium text-[color:var(--cf-ink)] transition-colors"
        >
          <Eye className="size-3.5" />
          <span className="hidden md:inline">Preview</span>
        </Link>

        <button
          onClick={onShare}
          title="Share form access"
          className="hidden sm:inline-flex items-center gap-1.5 h-[32px] px-3 rounded-full ring-1 ring-[color:var(--cf-line-strong)] bg-[color:var(--cf-cream)] hover:bg-[color:var(--cf-cream-2)] text-[12px] font-medium text-[color:var(--cf-ink)] transition-colors cursor-pointer"
        >
          <Share2 className="size-3.5" />
          <span className="hidden md:inline">Share</span>
        </button>

        {canDelete && (
          <>
            <div className="hidden sm:block w-px h-5 bg-[color:var(--cf-line-strong)] mx-0.5" />
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete form"
              className="hidden sm:inline-flex items-center gap-1.5 h-[32px] px-3 rounded-full ring-1 ring-[#c1281d]/25 text-[#c1281d] hover:bg-[#c1281d]/8 hover:ring-[#c1281d]/40 text-[12px] font-medium transition-colors cursor-pointer"
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
            className="inline-flex items-center justify-center size-[32px] rounded-full ring-1 ring-[color:var(--cf-line-strong)] bg-[color:var(--cf-cream)] text-[color:var(--cf-ink)] cursor-pointer"
          >
            <MoreVertical className="size-3.5" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-[color:var(--cf-cream-2)] ring-1 ring-[color:var(--cf-line-strong)] shadow-[0_20px_40px_-20px_rgba(22,19,17,0.28)] p-1.5 z-50"
            >
              <Link
                href={`/forms/${formId}`}
                target="_blank"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] transition-colors"
              >
                <Eye className="size-3.5 text-[color:var(--cf-ink-soft)]" />
                Preview
              </Link>
              <button
                onClick={() => {
                  onShare();
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream)] transition-colors text-left cursor-pointer"
              >
                <Share2 className="size-3.5 text-[color:var(--cf-ink-soft)]" />
                Share form
              </button>
              {canDelete && (
                <>
                  <div className="h-px bg-[color:var(--cf-line)] my-1" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-[#c1281d] hover:bg-[#c1281d]/8 transition-colors text-left cursor-pointer"
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
                onError: (err) =>
                  toast.error(err.message || "Failed to publish"),
              }
            );
          }}
          disabled={publishPending || isPublished}
          className="inline-flex items-center justify-center h-[32px] px-3.5 sm:px-4 rounded-full bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white text-[12.5px] font-medium tracking-tight disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
        >
          {publishPending ? "..." : isPublished ? "Published" : "Publish"}
        </button>
      </div>
    </header>
  );
}
