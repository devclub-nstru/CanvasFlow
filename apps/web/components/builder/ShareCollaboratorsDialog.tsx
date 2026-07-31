"use client";

import React, { useState, useEffect, useRef } from "react";
import { Copy, Crown, Plus, Shield, Trash2, User, X } from "lucide-react";
import { toast } from "sonner";
import {
  useListCollaborators,
  useAddCollaborator,
  useUpdateCollaboratorRole,
  useRemoveCollaborator,
  useTransferOwnership,
} from "~/hooks/api/form";
import { useSearchUsers } from "~/hooks/api/user";
import { useDebounce } from "~/hooks/useDebounce";

interface ShareCollaboratorsDialogProps {
  show: boolean;
  formId: string;
  formTitle: string;
  ownerEmail?: string | null;
  role?: "owner" | "editor" | "viewer";
  onClose: () => void;
}

export function ShareCollaboratorsDialog({
  show,
  formId,
  formTitle,
  ownerEmail,
  role = "viewer",
  onClose,
}: ShareCollaboratorsDialogProps) {
  const { collaborators, isLoading, refetch } = useListCollaborators(formId);
  const { addCollaboratorAsync, isPending: addPending } = useAddCollaborator();
  const { updateCollaboratorRoleAsync } = useUpdateCollaboratorRole();
  const { removeCollaboratorAsync } = useRemoveCollaborator();

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("viewer");
  const [confirmTransferUserId, setConfirmTransferUserId] = useState<string | null>(null);
  const [confirmTransferUserEmail, setConfirmTransferUserEmail] = useState("");
  const { transferOwnershipAsync } = useTransferOwnership();

  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debouncedEmail = useDebounce(email, 200);
  const { users: suggestions } = useSearchUsers(debouncedEmail);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  if (!show) return null;

  const isOwner = role === "owner";
  const publicUrl = `${window.location.origin}/forms/${formId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Public link copied to clipboard");
  };

  const handleDownloadQr = async () => {
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}&color=221917&bgcolor=ffffff`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${formTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr-code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success("QR Code downloaded");
    } catch {
      toast.error("Failed to download QR Code");
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      await addCollaboratorAsync({
        formId,
        email: email.trim(),
        role: inviteRole,
      });
      toast.success("Collaborator added");
      setEmail("");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add collaborator");
    }
  };

  const handleUpdateRole = async (collaboratorId: string, newRole: "viewer" | "editor") => {
    try {
      await updateCollaboratorRoleAsync({
        formId,
        userId: collaboratorId,
        role: newRole,
      });
      toast.success("Role updated");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const handleRemove = async (collaboratorId: string) => {
    try {
      await removeCollaboratorAsync({
        formId,
        userId: collaboratorId,
      });
      toast.success("Collaborator removed");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove collaborator");
    }
  };

  const handleTransferOwnership = async () => {
    if (!confirmTransferUserId) return;
    try {
      await transferOwnershipAsync({
        formId,
        targetUserId: confirmTransferUserId,
      });
      toast.success("Ownership transferred successfully");
      setConfirmTransferUserId(null);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to transfer ownership");
    }
  };

  const accessCount = 1 + (collaborators?.length ?? 0);

  return (
    <div className="cf-scrim z-300">
      <div className="cf-dialog max-h-[88vh] max-w-2xl">
        <div className="cf-dialog-bar">
          <span className="truncate">Share · {formTitle}</span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="font-mono text-[11px] capitalize" style={{ color: "var(--cf-ink-soft)" }}>
              {role}
            </span>
            <button
              onClick={onClose}
              className="cf-btn-outline size-7"
              aria-label="Close dialog"
            >
              <X className="size-3.5" />
            </button>
          </span>
        </div>

        <div className="cf-dialog-body space-y-6">
          {/* Public link */}
          <div>
            <p className="cf-meta mb-2">Public link</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="cf-input flex-1 px-3 py-2.5 font-mono text-[12.5px]"
                style={{ color: "var(--cf-ink-soft)" }}
              />
              <button
                onClick={handleCopyLink}
                className="cf-btn shrink-0 px-4 text-[12.5px]"
                style={{ background: "var(--cf-ink)" }}
                title="Copy public link"
              >
                <Copy className="size-3.5" />
                Copy
              </button>
            </div>
          </div>

          {/* QR + access, mirroring the reference's two-column split */}
          <div className="grid gap-5 sm:grid-cols-[148px_1fr]">
            <div>
              <p className="cf-meta mb-2">QR code</p>
              <div
                className="border bg-white p-2"
                style={{ borderColor: "var(--cf-line-strong)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(publicUrl)}&color=1a1d29&bgcolor=ffffff`}
                  alt="QR code for the public form link"
                  width={150}
                  height={150}
                  className="block h-auto w-full"
                />
              </div>
              <button
                onClick={handleDownloadQr}
                className="cf-btn-outline mt-2 w-full py-1.5 text-[11.5px]"
              >
                Download
              </button>
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="cf-meta">Access</p>
                <span className="cf-meta">{accessCount}</span>
              </div>

              <div className="custom-scrollbar max-h-59 space-y-2 overflow-y-auto">
                {/* Owner */}
                <div className="cf-row">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Shield className="size-3.5 shrink-0" style={{ color: "var(--cf-orange)" }} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">Workspace owner</span>
                      {ownerEmail && (
                        <span
                          className="block truncate text-[11px]"
                          style={{ color: "var(--cf-ink-soft)" }}
                        >
                          {ownerEmail}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="cf-meta shrink-0">Owner</span>
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-4">
                    <div
                      className="size-5 animate-spin rounded-full border-2"
                      style={{
                        borderColor: "var(--cf-line)",
                        borderTopColor: "var(--cf-orange)",
                      }}
                    />
                  </div>
                ) : collaborators?.length === 0 ? (
                  <p className="py-3 text-center text-[12.5px]" style={{ color: "var(--cf-ink-soft)" }}>
                    No collaborators yet.
                  </p>
                ) : (
                  collaborators?.map((c) => (
                    <div key={c.id} className="cf-row">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <User className="size-3.5 shrink-0" style={{ color: "var(--cf-ink-soft)" }} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {c.name || "Collaborator"}
                          </span>
                          <span
                            className="block truncate text-[11px]"
                            style={{ color: "var(--cf-ink-soft)" }}
                          >
                            {c.email}
                          </span>
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-1.5">
                        {isOwner ? (
                          <>
                            <label htmlFor={`role-${c.id}`} className="sr-only">
                              Role for {c.email}
                            </label>
                            <select
                              id={`role-${c.id}`}
                              value={c.role}
                              onChange={(e) =>
                                handleUpdateRole(c.id, e.target.value as "viewer" | "editor")
                              }
                              className="cf-input cursor-pointer px-2 py-1 text-[11.5px]"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="editor">Editor</option>
                            </select>
                            <button
                              onClick={() => {
                                setConfirmTransferUserId(c.id);
                                setConfirmTransferUserEmail(c.email);
                              }}
                              className="cf-btn-outline size-7"
                              title="Transfer ownership"
                              aria-label={`Transfer ownership to ${c.email}`}
                            >
                              <Crown className="size-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemove(c.id)}
                              className="cf-btn-outline size-7"
                              title="Remove collaborator"
                              aria-label={`Remove ${c.email}`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="cf-meta capitalize">{c.role}</span>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Invite, or the transfer confirmation that replaces it */}
          {isOwner &&
            (confirmTransferUserId ? (
              <div
                className="border p-4"
                style={{ borderColor: "var(--c-red)", background: "var(--cf-cream-2)" }}
              >
                <p className="cf-meta" style={{ color: "var(--c-red)" }}>
                  Transfer ownership
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed">
                  Make{" "}
                  <span className="font-semibold">{confirmTransferUserEmail}</span> the new owner?
                  You become an editor and cannot undo this yourself.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmTransferUserId(null)}
                    className="cf-btn-outline px-3 py-1.5 text-[12px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleTransferOwnership}
                    className="cf-btn px-4 py-1.5 text-[12px]"
                    style={{ background: "var(--c-red)" }}
                  >
                    Transfer
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAdd}>
                <p className="cf-meta mb-2">Invite collaborator</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 flex-1" ref={suggestionsRef}>
                    <label htmlFor="invite-email" className="sr-only">
                      Collaborator email
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      className="cf-input px-3 py-2 text-[13px]"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div
                        className="custom-scrollbar absolute top-full right-0 left-0 z-350 mt-1 max-h-48 overflow-y-auto border"
                        style={{
                          borderColor: "var(--cf-line-strong)",
                          background: "var(--cf-cream)",
                          boxShadow: "4px 4px 0 0 rgba(26,29,41,0.14)",
                        }}
                      >
                        {suggestions.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setEmail(u.email);
                              setShowSuggestions(false);
                            }}
                            className="flex w-full cursor-pointer flex-col px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-(--cf-cream-2)"
                          >
                            <span className="font-medium">{u.name}</span>
                            <span className="text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
                              {u.email}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <label htmlFor="invite-role" className="sr-only">
                    Invite role
                  </label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "viewer" | "editor")}
                    className="cf-input shrink-0 cursor-pointer px-2.5 py-2 text-[12px] sm:w-auto"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>

                  <button
                    type="submit"
                    disabled={addPending}
                    className="cf-btn shrink-0 px-4 py-2 text-[12.5px] disabled:opacity-50"
                  >
                    <Plus className="size-4" />
                    Add
                  </button>
                </div>
              </form>
            ))}
        </div>

        <div className="cf-dialog-foot">
          <span>
            {accessCount} {accessCount === 1 ? "person" : "people"} with access
          </span>
          <span>{isOwner ? "you own this form" : `you are ${role}`}</span>
        </div>
      </div>
    </div>
  );
}
