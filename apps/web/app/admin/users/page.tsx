"use client";

import React from "react";
import { toast } from "sonner";
import {
  Ban,
  CircleCheck,
  Clock,
  KeyRound,
  LogOut,
  Mail,
  FileText,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  User as UserIcon,
} from "lucide-react";

import { useGetLoggedInUserInfo } from "~/hooks/api/auth";
import { Pager } from "~/components/admin/Pager";
import { ConfirmDialog } from "~/components/admin/ConfirmDialog";
import { useDebounce } from "~/hooks/useDebounce";
import {
  useAuditLog,
  useForceSignOut,
  useListUsers,
  usePendingSignupActions,
  usePendingSignups,
  useSendPasswordReset,
  useSetSuspended,
  useUserDetail,
  type UserFilters,
} from "~/hooks/api/admin";
import { AUDIT_LABEL } from "~/lib/admin-audit";

const FILTERS: Array<{ id: string; label: string; patch: UserFilters }> = [
  { id: "all", label: "All", patch: {} },
  { id: "admins", label: "Admins", patch: { role: "admin" } },
  { id: "suspended", label: "Suspended", patch: { suspended: true } },
];

function when(value: unknown): string {
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* A full UA string is unreadable in a table; the browser and platform are what
 * an admin actually scans for. */
function briefAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) && !/Chrome/.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : "Browser";
  const os =
    /iPhone|iPad/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Windows/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return os ? `${browser} · ${os}` : browser;
}

export default function AdminUsersPage() {
  const { userInfo } = useGetLoggedInUserInfo();
  const meId = userInfo?.id;

  const [tab, setTab] = React.useState("all");
  const [rawQuery, setRawQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showPending, setShowPending] = React.useState(false);
  const [page, setPage] = React.useState(0);

  /* One piece of state for both dialogs: only ever one is open, and a single
   * discriminated union keeps "which dialog" and "what it acts on" from
   * drifting apart. */
  const [dialog, setDialog] = React.useState<
    | { kind: "suspend"; userId: string; label: string }
    | { kind: "clearSignup"; id: string; email: string }
    | null
  >(null);

  const query = useDebounce(rawQuery, 250);
  const filters: UserFilters = {
    ...(FILTERS.find((f) => f.id === tab)?.patch ?? {}),
    query: query.trim() || undefined,
  };

  const { users, total, isLoading, pageCount } = useListUsers(filters, page);
  const { user: selected, isLoading: isLoadingDetail } = useUserDetail(selectedId);
  const { pending, isLoading: isLoadingPending } = usePendingSignups(showPending);
  const { resendAsync, deleteAsync, isPending: isActingOnSignup } = usePendingSignupActions();

  /* The slice of the audit log about whoever is selected — the history belongs
   * next to the account it is about, not only in a separate tab. */
  const { entries: userAudit } = useAuditLog(
    { targetUserId: selectedId ?? undefined, limit: 5 },
    !!selectedId,
  );

  const { setSuspendedAsync, isPending: isSuspending } = useSetSuspended();
  const { forceSignOutAsync, isPending: isSigningOut } = useForceSignOut();
  const { sendPasswordResetAsync, isPending: isSendingReset } = useSendPasswordReset();

  /* Suspending asks for a reason, so it opens the dialog. Lifting a suspension
   * takes no input and is reversible, so it just runs. */
  const applySuspend = async (userId: string, suspended: boolean, reason?: string) => {
    try {
      await setSuspendedAsync({ userId, suspended, reason: reason || undefined });
      toast.success(suspended ? "Account suspended." : "Suspension lifted.");
      setDialog(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change that account");
    }
  };

  const onSignOut = async () => {
    if (!selected) return;
    try {
      const { revoked } = await forceSignOutAsync({ userId: selected.id });
      toast.success(
        revoked === 0 ? "They had no active sessions." : `Signed out of ${revoked} session${revoked === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't sign them out");
    }
  };

  const onResendCode = async (id: string, email: string) => {
    try {
      const { sent, reason } = await resendAsync({ id });
      if (sent) toast.success(`New code sent to ${email}.`);
      else toast.error(reason ?? "Nothing was sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't resend");
    }
  };

  const applyDeleteSignup = async (id: string) => {
    try {
      await deleteAsync({ id });
      toast.success("Signup cleared.");
      setDialog(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't clear that signup");
    }
  };

  const onReset = async () => {
    if (!selected) return;
    try {
      const { sent, reason } = await sendPasswordResetAsync({ userId: selected.id });
      if (sent) toast.success("Reset link sent.");
      else toast.error(reason ?? "Nothing was sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send a reset");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="cf-meta">People</p>
        <h1 className="cf-display mt-3 text-[32px] leading-none sm:text-[42px]">
          Users
          <span style={{ color: "var(--cf-orange)" }}>.</span>
        </h1>
        <p className="mt-3 text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
          Every account, how they sign in, and what to do when they&apos;re stuck.
        </p>
      </div>

      {/* ── search + filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            style={{ color: "var(--cf-ink-soft)" }}
            aria-hidden
          />
          <input
            type="text"
            value={rawQuery}
            onChange={(e) => {
              setRawQuery(e.target.value);
              /* A narrower search can leave the current page past the end of
                 the results, which reads as "nobody matches". */
              setPage(0);
            }}
            placeholder="Search by name or email"
            aria-label="Search users"
            className="h-9 w-full border px-3 pl-9 text-[13px] outline-none"
            style={{ borderColor: "var(--cf-line-strong)", background: "#fff" }}
          />
        </div>

        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => { setTab(f.id); setPage(0); }}
            className="cf-btn-outline h-9 px-3 text-[10px] font-bold tracking-[0.16em] uppercase"
            style={tab === f.id ? { background: "var(--cf-ink)", color: "var(--cf-cream)" } : undefined}
          >
            {f.label}
          </button>
        ))}

        <button
          onClick={() => setShowPending((v) => !v)}
          className="cf-btn-outline h-9 gap-1.5 px-3 text-[10px] font-bold tracking-[0.16em] uppercase"
          style={showPending ? { background: "var(--cf-ink)", color: "var(--cf-cream)" } : undefined}
        >
          <Clock className="size-3.5" />
          Stuck signups
        </button>
      </div>

      {/* ── stuck signups ── */}
      {showPending && (
        <div className="cf-panel cf-raised">
          <div
            className="border-b px-4 py-3"
            style={{ borderBottomColor: "var(--cf-line)" }}
          >
            <p className="cf-meta">
              {isLoadingPending ? "Loading…" : `${pending.length} signup${pending.length === 1 ? "" : "s"} never finished`}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
              People who entered a password but never confirmed the emailed code. No account exists
              for them yet.
            </p>
          </div>
          {!isLoadingPending && pending.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
              Nobody is stuck.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--cf-line)" }}>
              {pending.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <Mail className="size-4 shrink-0" style={{ color: "var(--cf-ink-soft)" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{p.email}</p>
                    <p className="truncate text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
                      started {when(p.createdAt)} · {p.attempts} wrong code
                      {p.attempts === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="cf-meta shrink-0" style={{ color: "var(--cf-ink-soft)" }}>
                    {p.expired ? "expired" : "open"}
                  </span>

                  <div className="flex shrink-0 gap-2">
                    <button
                      /* An expired row cannot be revived by another code — it
                         has to be cleared so they can start over. */
                      disabled={isActingOnSignup || p.expired}
                      onClick={() => onResendCode(p.id, p.email)}
                      title={p.expired ? "Expired — clear it instead" : "Send a fresh code"}
                      className="cf-btn-outline h-8 gap-1.5 px-2.5 text-[10px] font-bold tracking-[0.16em] uppercase disabled:opacity-40"
                    >
                      <Send className="size-3.5" />
                      Resend
                    </button>
                    <button
                      disabled={isActingOnSignup}
                      onClick={() => setDialog({ kind: "clearSignup", id: p.id, email: p.email })}
                      title="Clear so they can sign up again"
                      className="cf-btn-outline h-8 gap-1.5 px-2.5 text-[10px] font-bold tracking-[0.16em] uppercase disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                      Clear
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── list ── */}
        <div className="cf-panel cf-raised">
          <div className="border-b px-4 py-3" style={{ borderBottomColor: "var(--cf-line)" }}>
            <p className="cf-meta">
              {isLoading ? "Loading…" : `${total} account${total === 1 ? "" : "s"}`}
            </p>
          </div>

          {!isLoading && users.length === 0 && (
            <p className="px-4 py-12 text-center text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
              Nobody matches.
            </p>
          )}

          <ul className="divide-y" style={{ borderColor: "var(--cf-line)" }}>
            {users.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => setSelectedId(u.id)}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-(--cf-cream-2)"
                  style={u.id === selectedId ? { background: "var(--cf-cream-2)" } : undefined}
                >
                  <div className="flex items-center gap-3">
                    {u.suspendedAt ? (
                      <Ban className="size-4 shrink-0" style={{ color: "var(--cf-orange)" }} />
                    ) : u.role === "user" ? (
                      <UserIcon className="size-4 shrink-0" style={{ color: "var(--cf-ink-soft)" }} />
                    ) : (
                      <ShieldCheck className="size-4 shrink-0" style={{ color: "var(--cf-orange)" }} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">
                        {u.name || u.email}
                        {u.id === meId && (
                          <span className="cf-meta ml-2" style={{ color: "var(--cf-ink-soft)" }}>
                            you
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
                        {u.email}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="cf-meta" style={{ color: "var(--cf-ink-soft)" }}>
                        {u.suspendedAt ? "suspended" : u.role}
                      </p>
                      <p className="mt-1 text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
                        {u.formCount} form{u.formCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <Pager page={page} pageCount={pageCount} total={total} noun="account" onChange={setPage} />
        </div>

        {/* ── detail ── */}
        <div className="cf-panel cf-raised p-5">
          {!selectedId ? (
            <div className="flex h-full min-h-60 flex-col items-center justify-center gap-3 text-center">
              <UserIcon className="size-6" style={{ color: "var(--cf-ink-soft)" }} />
              <p className="text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
                Pick someone to see their account.
              </p>
            </div>
          ) : isLoadingDetail || !selected ? (
            <p className="cf-meta opacity-60">Loading…</p>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="cf-meta">{selected.role}</span>
                  {selected.suspendedAt && (
                    <span
                      className="cf-meta px-1.5 py-0.5 text-[9px]"
                      style={{ background: "var(--cf-orange)", color: "#fff" }}
                    >
                      suspended
                    </span>
                  )}
                  {selected.emailVerified ? (
                    <span className="cf-meta inline-flex items-center gap-1" style={{ color: "var(--cf-ink-soft)" }}>
                      <CircleCheck className="size-3" /> verified
                    </span>
                  ) : (
                    <span className="cf-meta" style={{ color: "var(--cf-ink-soft)" }}>
                      unverified
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-[18px] font-semibold">{selected.name || selected.email}</h2>
                <p className="mt-1 text-[12px]" style={{ color: "var(--cf-ink-soft)" }}>
                  {selected.email} · joined {when(selected.createdAt)}
                </p>
                {selected.suspendedReason && (
                  <p className="mt-2 text-[12px]" style={{ color: "var(--cf-orange)" }}>
                    Reason: {selected.suspendedReason}
                  </p>
                )}
              </div>

              <dl className="space-y-2 border-t pt-4" style={{ borderTopColor: "var(--cf-line)" }}>
                {/* The line that answers "why can't they sign in with a
                    password" without a database session. */}
                <Row
                  label="Sign-in"
                  value={
                    selected.providers.length
                      ? selected.providers
                          .map((p) => (p === "credential" ? "password" : p))
                          .join(", ")
                      : "none"
                  }
                />
                <Row label="Forms" value={String(selected.formCount)} />
                <Row label="Responses" value={String(selected.submissionCount)} />
                <Row label="Active sessions" value={String(selected.sessions.length)} />
              </dl>

              {selected.forms.length > 0 && (
                <div className="border-t pt-4" style={{ borderTopColor: "var(--cf-line)" }}>
                  <p className="cf-meta mb-3">
                    Forms
                    {/* The pane caps the list; say so rather than silently
                        showing a partial list as if it were everything. */}
                    {selected.formCount > selected.forms.length && (
                      <span className="ml-2 normal-case" style={{ color: "var(--cf-ink-soft)" }}>
                        newest {selected.forms.length} of {selected.formCount}
                      </span>
                    )}
                  </p>
                  <ul className="space-y-2">
                    {selected.forms.map((f) => (
                      <li key={f.id} className="flex items-center gap-2.5">
                        <FileText
                          className="size-3.5 shrink-0"
                          style={{
                            color: f.isPublished ? "var(--cf-orange)" : "var(--cf-ink-soft)",
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[12px]">{f.title}</span>
                        <span
                          className="cf-meta shrink-0"
                          style={{ color: "var(--cf-ink-soft)" }}
                        >
                          {f.isArchived ? "archived" : f.isPublished ? "live" : "draft"}
                        </span>
                        <span
                          className="w-16 shrink-0 text-right text-[12px] tabular-nums"
                          style={{ color: "var(--cf-ink-soft)" }}
                        >
                          {f.submissionCount}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.sessions.length > 0 && (
                <div className="border-t pt-4" style={{ borderTopColor: "var(--cf-line)" }}>
                  <p className="cf-meta mb-3">Sessions</p>
                  <ul className="space-y-2">
                    {selected.sessions.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="min-w-0 truncate">{briefAgent(s.userAgent)}</span>
                        <span className="shrink-0 font-mono" style={{ color: "var(--cf-ink-soft)" }}>
                          {s.ipAddress ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {userAudit.length > 0 && (
                <div className="border-t pt-4" style={{ borderTopColor: "var(--cf-line)" }}>
                  <p className="cf-meta mb-3">Recent admin actions</p>
                  <ul className="space-y-2">
                    {userAudit.map((e) => (
                      <li key={e.id} className="text-[12px]">
                        <span className="font-medium">{AUDIT_LABEL[e.action]}</span>
                        <span style={{ color: "var(--cf-ink-soft)" }}>
                          {" "}
                          by {e.actorEmail} · {when(e.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── actions ── */}
              <div className="flex flex-wrap gap-2 border-t pt-4" style={{ borderTopColor: "var(--cf-line)" }}>
                <button
                  disabled={isSigningOut || selected.sessions.length === 0}
                  onClick={onSignOut}
                  className="cf-btn-outline h-8 gap-1.5 px-3 text-[10px] font-bold tracking-[0.16em] uppercase disabled:opacity-50"
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </button>

                <button
                  disabled={isSendingReset || !selected.hasPassword}
                  onClick={onReset}
                  title={selected.hasPassword ? undefined : "No password to reset"}
                  className="cf-btn-outline h-8 gap-1.5 px-3 text-[10px] font-bold tracking-[0.16em] uppercase disabled:opacity-50"
                >
                  <KeyRound className="size-3.5" />
                  Reset password
                </button>

                {/* Suspending yourself would end the session making the
                    request; the server refuses it too. */}
                {selected.id !== meId &&
                  (selected.suspendedAt ? (
                    <button
                      disabled={isSuspending}
                      onClick={() => applySuspend(selected.id, false)}
                      className="cf-btn cf-press h-8 gap-1.5 px-3 text-[10px] font-bold tracking-[0.16em] uppercase disabled:opacity-50"
                    >
                      <CircleCheck className="size-3.5" />
                      Unsuspend
                    </button>
                  ) : (
                    <button
                      disabled={isSuspending}
                      onClick={() =>
                        setDialog({
                          kind: "suspend",
                          userId: selected.id,
                          label: selected.name || selected.email,
                        })
                      }
                      className="cf-btn-danger h-8 gap-1.5 px-3 text-[10px] font-bold tracking-[0.16em] uppercase disabled:opacity-50"
                    >
                      <Ban className="size-3.5" />
                      Suspend
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={dialog?.kind === "suspend"}
        title="Suspend account"
        message={
          <>
            <strong>{dialog?.kind === "suspend" ? dialog.label : ""}</strong> will be signed out
            everywhere and blocked from signing in again — with a password, Google, or GitHub.
            Their forms and responses are left untouched, and you can lift this at any time.
          </>
        }
        input={{
          label: "Reason",
          placeholder: "Shown to them at sign-in",
          optional: true,
          maxLength: 300,
        }}
        confirmLabel="Suspend"
        danger
        busy={isSuspending}
        onConfirm={(reason) => {
          if (dialog?.kind !== "suspend") return;
          void applySuspend(dialog.userId, true, reason);
        }}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog?.kind === "clearSignup"}
        title="Clear pending signup"
        message={
          <>
            Removes the half-finished signup for{" "}
            <strong>{dialog?.kind === "clearSignup" ? dialog.email : ""}</strong> so they can start
            again from scratch. No account exists for them yet, so nothing else is lost.
          </>
        }
        confirmLabel="Clear it"
        danger
        busy={isActingOnSignup}
        onConfirm={() => {
          if (dialog?.kind !== "clearSignup") return;
          void applyDeleteSignup(dialog.id);
        }}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
        {label}
      </dt>
      <dd className="text-[13px] font-semibold">{value}</dd>
    </div>
  );
}
