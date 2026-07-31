"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, LogOut, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { useSignOut } from "~/hooks/api/auth";
import { useGetDashboardStats, useListFormsByUserId } from "~/hooks/api/form";
import { useGetMe, useUpdateMe } from "~/hooks/api/user";
import {
  AVATAR_PRESETS,
  avatarSeed,
  GlyphAvatar,
  isAvatarPreset,
  resolvePreset,
  type AvatarPreset,
} from "~/components/profile/GlyphAvatar";
import { ModalOverlay } from "~/components/ui/ModalOverlay";

const DAY_MS = 1000 * 60 * 60 * 24;

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function ProfilePage() {
  const { me, isLoading: meLoading } = useGetMe();
  const { stats, isLoading: statsLoading } = useGetDashboardStats();
  const { forms } = useListFormsByUserId();
  const { signOutAsync } = useSignOut();
  const { updateMeAsync, isPending: isSaving } = useUpdateMe();

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftPreset, setDraftPreset] = useState<AvatarPreset | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const seed = avatarSeed(me);
  const activePreset = resolvePreset(me?.image, seed);

  const daysActive = me?.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(me.createdAt).getTime()) / DAY_MS))
    : 0;

  const totalForms = stats?.totalSketches ?? 0;
  const publishedForms = stats?.publishedSketches ?? 0;
  const totalResponses = stats?.totalResponses ?? 0;
  const responsesThisMonth = stats?.responsesThisMonth ?? 0;

  const activity = useMemo(() => {
    if (!forms) return [];
    return [...forms]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map((form) => ({
        id: form.id,
        action:
          new Date(form.updatedAt).getTime() - new Date(form.createdAt).getTime() < 1000
            ? "Created"
            : "Updated",
        target: form.title,
        timestamp: form.updatedAt,
      }));
  }, [forms]);

  const milestones = [
    { label: "First form", desc: "Created a form", unlocked: totalForms > 0 },
    { label: "Live", desc: "Published a form", unlocked: publishedForms > 0 },
    { label: "Architect", desc: "5 or more forms", unlocked: totalForms >= 5 },
    { label: "Signal", desc: "100+ responses", unlocked: totalResponses >= 100 },
    { label: "Veteran", desc: "30+ days in", unlocked: daysActive >= 30 },
  ];
  const unlockedCount = milestones.filter((m) => m.unlocked).length;

  const anyDialogOpen = isEditing || confirmSignOut;
  useEffect(() => {
    if (!anyDialogOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [anyDialogOpen]);
  useEffect(() => {
    if (!anyDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isSigningOut) return;
      setIsEditing(false);
      setConfirmSignOut(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyDialogOpen, isSigningOut]);

  const openEditor = () => {
    setDraftName(me?.name ?? "");
    setDraftPreset(isAvatarPreset(me?.image) ? me.image : null);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = draftName.trim();
    if (!name) {
      toast.error("Name cannot be empty.");
      return;
    }

    // Send only what changed, so a no-op save doesn't write a row.
    const patch: { name?: string; image?: AvatarPreset } = {};
    if (name !== me?.name) patch.name = name;
    if (draftPreset && draftPreset !== me?.image) patch.image = draftPreset;

    if (Object.keys(patch).length === 0) {
      setIsEditing(false);
      return;
    }

    try {
      await updateMeAsync(patch);
      setIsEditing(false);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOutAsync();
      window.location.href = "/";
    } catch (err) {
      setIsSigningOut(false);
      setConfirmSignOut(false);
      toast.error(err instanceof Error ? err.message : "Could not sign out");
    }
  };

  if (meLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="size-8 animate-spin rounded-full border-2 border-(--cf-line) border-t-(--cf-orange)" />
        <p className="cf-meta">Loading your profile</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ───── header ───── */}
      <div className="flex flex-col gap-6 border-b border-(--cf-line-strong) pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="cf-meta mb-2">Account</p>
          <h1 className="cf-display text-[32px] leading-[0.95] uppercase sm:text-[42px] md:text-[52px]">
            Profile
            <span style={{ color: "var(--cf-orange)" }}>.</span>
          </h1>
        </div>
        <div className="sm:text-right">
          <p className="cf-meta mb-1.5">Member since</p>
          <p className="font-mono text-[14px] font-medium">{formatDate(me?.createdAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ───── left: identity ───── */}
        <div className="space-y-6 lg:col-span-1">
          <section className="cf-panel overflow-hidden">
            <div className="cf-pane-bar">
              <p className="cf-meta">Identity</p>
              <button
                type="button"
                onClick={openEditor}
                className="cf-btn-outline h-7 gap-1.5 px-2.5 text-[11px]"
              >
                <Pencil className="size-3" />
                Edit
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={openEditor}
                  aria-label="Change avatar"
                  className="group relative shrink-0 cursor-pointer"
                >
                  <GlyphAvatar seed={seed} preset={activePreset} size={64} />
                  <span className="absolute inset-0 flex items-center justify-center bg-(--cf-ink)/70 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-(--cf-cream) uppercase">
                      Edit
                    </span>
                  </span>
                </button>

                <div className="min-w-0">
                  <p className="cf-display text-[20px] leading-tight wrap-break-word">
                    {me?.name || "Unnamed"}
                  </p>
                  <p className="mt-1 font-mono text-[11px] break-all text-(--cf-ink-soft)">
                    {me?.email}
                  </p>
                </div>
              </div>

              <dl className="space-y-4 border-t border-(--cf-line) pt-4">
                <Field label="Days active">
                  <span className="tabular-nums">
                    {daysActive} {daysActive === 1 ? "day" : "days"}
                  </span>
                </Field>
              </dl>
            </div>
          </section>

          <section className="cf-panel overflow-hidden">
            <div className="cf-pane-bar">
              <p className="cf-meta">Session</p>
            </div>
            <div className="space-y-3 p-5">
              <button
                type="button"
                onClick={() => setConfirmSignOut(true)}
                className="cf-btn-danger h-11 w-full justify-start gap-2.5 px-4 text-[13px] hover:bg-(--cf-danger) hover:text-white"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </section>
        </div>

        {/* ───── right: activity ───── */}
        <div className="space-y-6 lg:col-span-2">
          <section className="cf-panel overflow-hidden">
            <div className="cf-pane-bar">
              <p className="cf-meta">Milestones</p>
              <span className="font-mono text-[10px] tracking-wider text-(--cf-ink-soft)">
                {unlockedCount}/{milestones.length} unlocked
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
              {milestones.map((m) => (
                <div
                  key={m.label}
                  className="flex flex-col items-center border p-3 text-center transition-colors"
                  style={{
                    borderColor: m.unlocked ? "var(--cf-line-strong)" : "var(--cf-line)",
                    background: m.unlocked ? "#fff" : "transparent",
                    opacity: m.unlocked ? 1 : 0.45,
                  }}
                >
                  <span
                    className="mb-2.5 flex size-7 items-center justify-center border"
                    style={{
                      borderColor: m.unlocked ? "var(--cf-orange)" : "var(--cf-line)",
                      color: m.unlocked ? "var(--cf-orange)" : "var(--cf-ink-soft)",
                    }}
                    aria-hidden
                  >
                    {m.unlocked ? (
                      <Check className="size-3.5" />
                    ) : (
                      <span className="text-[10px]">○</span>
                    )}
                  </span>
                  <p className="font-mono text-[10.5px] font-bold tracking-wide uppercase">
                    {m.label}
                  </p>
                  <p className="mt-0.5 font-mono text-[9.5px] text-(--cf-ink-soft)">{m.desc}</p>
                  <span className="sr-only">{m.unlocked ? "Unlocked" : "Locked"}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Forms" value={totalForms} loading={statsLoading} />
            <Stat label="Published" value={publishedForms} loading={statsLoading} />
            <Stat label="Responses" value={totalResponses} loading={statsLoading} />
            <Stat label="This month" value={responsesThisMonth} loading={statsLoading} />
          </div>

          <section className="cf-panel overflow-hidden">
            <div className="cf-pane-bar">
              <p className="cf-meta">Activity</p>
              <span className="font-mono text-[10px] tracking-wider text-(--cf-ink-soft)">
                Last {activity.length || 5}
              </span>
            </div>

            {activity.length > 0 ? (
              <ul>
                {activity.map((item, i) => (
                  <li
                    key={item.id}
                    className="group flex items-center gap-4 border-b border-(--cf-line) px-5 py-4 transition-colors last:border-b-0 hover:bg-(--cf-ink)/2"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center border border-(--cf-line-strong) font-mono text-[10px] font-bold transition-colors group-hover:bg-(--cf-ink) group-hover:text-(--cf-cream)">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px]">
                        <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-(--cf-ink-soft)">
                          {item.action}
                        </span>{" "}
                        <Link
                          href={`/dashboard/sketches/${item.id}`}
                          className="font-medium underline decoration-(--cf-line) underline-offset-4 hover:decoration-(--cf-ink)"
                        >
                          {item.target}
                        </Link>
                      </p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-(--cf-ink-soft)">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-14 text-center">
                <p className="cf-meta">No activity yet</p>
                <p className="mt-2 text-[13px] text-(--cf-ink-soft)">
                  Your forms will show up here as you build them.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
      {confirmSignOut && (
        <ModalOverlay onDismiss={isSigningOut ? undefined : () => setConfirmSignOut(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-title"
            className="cf-dark cf-crop w-full max-w-md"
          >
            <div className="relative z-1 p-6 sm:p-8">
              <p className="cf-dark-meta">Session</p>
              <h2
                id="signout-title"
                className="cf-display mt-3 text-[26px] leading-none uppercase sm:text-[32px]"
              >
                Sign out
                <span style={{ color: "var(--cf-orange)" }}>.</span>
              </h2>
              <p
                className="mt-3 mb-7 text-[13.5px] leading-relaxed"
                style={{ color: "var(--cfd-text-soft)" }}
              >
                You&apos;ll be signed out of CanvasFlow
                {me?.email ? (
                  <>
                    {" as "}
                    <span className="font-medium" style={{ color: "var(--cfd-text)" }}>
                      {me.email}
                    </span>
                  </>
                ) : null}
                . Your forms and responses stay exactly as they are.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(false)}
                  disabled={isSigningOut}
                  className="cf-dark-btn-outline px-4 py-2 text-[13px] disabled:opacity-50"
                >
                  Cancel
                </button>
                {/* Red, not the accent blue. `--cf-danger` is the repo's named
                    destructive token — the same one `cf-btn-danger` uses — so
                    this can't drift from the other destructive buttons. The
                    border matches the fill; `cf-btn` would otherwise outline it
                    in near-black, which reads as a shadow on a dark panel. */}
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  autoFocus
                  className="cf-btn px-5 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: "var(--cf-danger)",
                    borderColor: "var(--cf-danger)",
                  }}
                >
                  <LogOut className="size-3.5" />
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ───── edit dialog ───── */}
      {isEditing && (
        <ModalOverlay onDismiss={isSaving ? undefined : () => setIsEditing(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit profile"
            className="cf-dark cf-crop w-full max-w-lg"
          >
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="cf-dark-btn-outline absolute top-4 right-4 z-10 size-8"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>

            <div className="relative z-1 p-6 sm:p-8">
              <p className="cf-dark-meta">Identity</p>
              <h2 className="cf-display mt-3 text-[28px] leading-none uppercase sm:text-[34px]">
                Edit profile
                <span style={{ color: "var(--cf-orange)" }}>.</span>
              </h2>

              <form onSubmit={handleSave} className="mt-6 space-y-5">
                <div>
                  <label htmlFor="profile-name" className="cf-dark-meta mb-2 block">
                    Display name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    required
                    maxLength={80}
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="cf-dark-input h-10.5 px-4 text-[14px]"
                  />
                </div>

                <div>
                  <span className="cf-dark-meta mb-2 block">Avatar</span>
                  <div
                    role="radiogroup"
                    aria-label="Avatar"
                    className="grid grid-cols-4 gap-2.5 sm:grid-cols-8"
                  >
                    {AVATAR_PRESETS.map((preset) => {
                      const selected = (draftPreset ?? activePreset) === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={`Avatar ${preset.replace("glyph-", "")}`}
                          onClick={() => setDraftPreset(preset)}
                          className="relative cursor-pointer p-0.5 transition-transform"
                          style={{
                            outline: selected ? "2px solid var(--cf-orange)" : "none",
                            outlineOffset: 2,
                          }}
                        >
                          <GlyphAvatar seed={seed} preset={preset} size={44} />
                          {selected && (
                            <span
                              className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center border"
                              style={{
                                background: "var(--cf-orange)",
                                borderColor: "var(--cf-ink)",
                              }}
                            >
                              <Check className="size-2.5 text-white" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p
                    className="mt-3 font-mono text-[10.5px] leading-relaxed"
                    style={{ color: "var(--cfd-text-muted)" }}
                  >
                    Generated from your account, so it stays the same everywhere.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                    className="cf-dark-btn-outline px-4 py-2 text-[13px] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="cf-btn px-5 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/* ── pieces ────────────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="cf-meta mb-1">{label}</dt>
      <dd className="text-[13.5px] font-medium">{children}</dd>
    </div>
  );
}

function Stat({ label, value, loading }: { label: string; value: number; loading?: boolean }) {
  return (
    <div className="cf-panel p-5">
      <p className="cf-display text-[30px] leading-none tabular-nums sm:text-[36px]">
        {loading ? "—" : value.toLocaleString()}
      </p>
      <p className="cf-meta mt-2">{label}</p>
    </div>
  );
}
