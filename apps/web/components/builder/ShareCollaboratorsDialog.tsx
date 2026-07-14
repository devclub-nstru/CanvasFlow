"use client";

import React, { useState, useEffect, useRef } from "react";
import { Copy, Crown, Plus, QrCode, Shield, Trash2, User, X } from "lucide-react";
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
  const [showQr, setShowQr] = useState(true);
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

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[color:var(--cf-ink)]/45 backdrop-blur-sm p-4">
      <div className="bg-[color:var(--cf-cream-2)] rounded-2xl ring-1 ring-[color:var(--cf-line-strong)] p-6 max-w-md w-full shadow-[0_30px_80px_-30px_rgba(22,19,17,0.35)] flex flex-col gap-5">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <p className="cf-eyebrow text-[color:var(--cf-orange)]">Collaborators</p>
            <h3 className="mt-1 cf-display text-[22px] leading-tight text-[color:var(--cf-ink)] truncate max-w-[320px]">
              {formTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[color:var(--cf-cream)] text-[color:var(--cf-ink-soft)] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Public Link Section */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-mono uppercase tracking-wider text-[color:var(--cf-ink-soft)]">
            Public link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={publicUrl}
              className="flex-1 bg-[color:var(--cf-cream)] rounded-lg ring-1 ring-[color:var(--cf-line)] px-3 py-1.5 text-[12.5px] font-mono text-[color:var(--cf-ink-soft)] select-all focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center p-2 rounded-lg bg-[color:var(--cf-cream)] hover:bg-[color:var(--cf-cream-2)] ring-1 ring-[color:var(--cf-line-strong)] text-[color:var(--cf-ink)] transition-colors cursor-pointer"
              title="Copy public link"
            >
              <Copy className="size-4" />
            </button>
            <button
              onClick={() => setShowQr(!showQr)}
              className={`inline-flex items-center justify-center p-2 rounded-lg bg-[color:var(--cf-cream)] hover:bg-[color:var(--cf-cream-2)] ring-1 ring-[color:var(--cf-line-strong)] text-[color:var(--cf-ink)] transition-colors cursor-pointer ${showQr ? "bg-[color:var(--cf-orange)]/10 ring-[color:var(--cf-orange)]/30 text-[color:var(--cf-orange)]" : ""}`}
              title="Toggle QR Code"
            >
              <QrCode className="size-4" />
            </button>
          </div>
        </div>

        {/* QR Code Container */}
        {showQr && (
          <div className="flex flex-col items-center justify-center bg-[color:var(--cf-cream)] p-4 rounded-xl border border-[color:var(--cf-line)] space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-white p-2.5 rounded-lg shadow-sm border border-[color:var(--cf-line-strong)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(publicUrl)}&color=221917&bgcolor=ffffff`}
                alt="Form QR Code"
                width={150}
                height={150}
                className="block"
              />
            </div>
            <button
              onClick={handleDownloadQr}
              className="text-[12px] font-medium text-[color:var(--cf-orange)] hover:text-[color:var(--cf-orange-hover)] transition-colors cursor-pointer"
            >
              Download QR Code
            </button>
          </div>
        )}

        {/* Owner Invite Form or Transfer Confirmation */}
        {isOwner &&
          (confirmTransferUserId ? (
            <div className="bg-[color:var(--cf-cream)] p-4 rounded-xl ring-1 ring-[color:var(--cf-orange)]/40 space-y-3">
              <h4 className="font-semibold text-[13.5px] text-[color:var(--cf-ink)] flex items-center gap-1.5">
                <Crown className="size-4 text-[color:var(--cf-orange)]" />
                Transfer Ownership?
              </h4>
              <p className="text-[12px] text-[color:var(--cf-ink-soft)] leading-relaxed">
                Make{" "}
                <span className="font-semibold text-[color:var(--cf-ink)]">
                  {confirmTransferUserEmail}
                </span>{" "}
                the new owner? You will become an editor collaborator.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmTransferUserId(null)}
                  className="px-3 py-1 h-[28px] text-[11.5px] rounded-full text-[color:var(--cf-ink)] hover:bg-[color:var(--cf-cream-2)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTransferOwnership}
                  className="px-4 py-1 h-[28px] rounded-full bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white text-[11.5px] font-medium transition-colors cursor-pointer"
                >
                  Transfer
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleAdd}
              className="space-y-1.5 pt-1 border-t border-[color:var(--cf-line)]"
            >
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[color:var(--cf-ink-soft)]">
                Invite collaborator
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1" ref={suggestionsRef}>
                  <input
                    type="email"
                    required
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full bg-[color:var(--cf-cream)] rounded-lg ring-1 ring-[color:var(--cf-line)] px-3 py-1.5 text-[13px] text-[color:var(--cf-ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--cf-orange)]"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-[color:var(--cf-cream-2)] rounded-lg ring-1 ring-[color:var(--cf-line-strong)] shadow-lg max-h-48 overflow-y-auto z-[350] py-1">
                      {suggestions.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setEmail(u.email);
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-[color:var(--cf-cream)] flex flex-col transition-colors cursor-pointer"
                        >
                          <span className="font-medium text-[color:var(--cf-ink)]">{u.name}</span>
                          <span className="text-[11px] text-[color:var(--cf-ink-soft)]">
                            {u.email}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "viewer" | "editor")}
                  className="bg-[color:var(--cf-cream)] rounded-lg ring-1 ring-[color:var(--cf-line)] px-2.5 py-1.5 text-[12px] text-[color:var(--cf-ink)] focus:outline-none focus:ring-2 focus:ring-[color:var(--cf-orange)] cursor-pointer"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  type="submit"
                  disabled={addPending}
                  className="inline-flex items-center justify-center h-[34px] px-3.5 rounded-lg bg-[color:var(--cf-orange)] hover:bg-[color:var(--cf-orange-hover)] text-white text-[12.5px] font-medium disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="size-4 mr-0.5" />
                  Add
                </button>
              </div>
            </form>
          ))}

        {/* Collaborators List */}
        <div className="space-y-2 pt-1 border-t border-[color:var(--cf-line)]">
          <label className="block text-[11px] font-mono uppercase tracking-wider text-[color:var(--cf-ink-soft)] mb-2">
            Who has access
          </label>

          <div className="max-h-[180px] overflow-y-auto pr-1 space-y-3">
            {/* Owner Row */}
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-7 rounded-full bg-[color:var(--cf-cream)] border border-[color:var(--cf-line-strong)] flex items-center justify-center text-[color:var(--cf-ink-soft)] shrink-0">
                  <Shield className="size-3.5 text-[color:var(--cf-orange)]" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-[color:var(--cf-ink)] truncate">Workspace Owner</p>
                  {ownerEmail && (
                    <p className="text-[11px] text-[color:var(--cf-ink-soft)] truncate">
                      {ownerEmail}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-[11.5px] font-mono text-[color:var(--cf-ink-soft)] bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line-strong)] px-2 py-0.5 rounded-full">
                Owner
              </span>
            </div>

            {/* Collaborator Rows */}
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="size-5 border-2 border-[color:var(--cf-line-strong)] border-t-[color:var(--cf-orange)] rounded-full animate-spin" />
              </div>
            ) : collaborators?.length === 0 ? (
              <p className="text-[12.5px] text-[color:var(--cf-ink-soft)] italic py-2 text-center">
                No external collaborators invited yet.
              </p>
            ) : (
              collaborators?.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-7 rounded-full bg-[color:var(--cf-cream)] border border-[color:var(--cf-line-strong)] flex items-center justify-center text-[color:var(--cf-ink-soft)] shrink-0">
                      <User className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[color:var(--cf-ink)] truncate">
                        {c.name || "Collaborator"}
                      </p>
                      <p className="text-[11px] text-[color:var(--cf-ink-soft)] truncate">
                        {c.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isOwner ? (
                      <>
                        <select
                          value={c.role}
                          onChange={(e) =>
                            handleUpdateRole(c.id, e.target.value as "viewer" | "editor")
                          }
                          className="bg-[color:var(--cf-cream)] rounded-md ring-1 ring-[color:var(--cf-line)] px-2 py-1 text-[11.5px] text-[color:var(--cf-ink)] focus:outline-none cursor-pointer"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                        <button
                          onClick={() => {
                            setConfirmTransferUserId(c.id);
                            setConfirmTransferUserEmail(c.email);
                          }}
                          className="p-1 rounded text-[color:var(--cf-ink-soft)]/60 hover:text-[color:var(--cf-orange)] hover:bg-[color:var(--cf-cream)] transition-colors cursor-pointer"
                          title="Transfer ownership"
                        >
                          <Crown className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemove(c.id)}
                          className="p-1 rounded text-[color:var(--cf-ink-soft)]/60 hover:text-[color:var(--cf-orange)] hover:bg-[color:var(--cf-cream)] transition-colors cursor-pointer"
                          title="Remove collaborator"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11.5px] font-mono text-[color:var(--cf-ink-soft)] bg-[color:var(--cf-cream)] ring-1 ring-[color:var(--cf-line-strong)] px-2 py-0.5 rounded-full capitalize">
                        {c.role}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
