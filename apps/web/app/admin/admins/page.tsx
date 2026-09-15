"use client";

import React from "react";
import { toast } from "sonner";
import { Check, Search, ShieldCheck, ShieldOff, UserPlus, X } from "lucide-react";

import { useGetLoggedInUserInfo } from "~/hooks/api/auth";
import { useDebounce } from "~/hooks/useDebounce";
import {
  useAddAdmin,
  useListAdmins,
  useRemoveAdmin,
  useSearchAdminCandidates,
} from "~/hooks/api/user";

type Candidate = { id: string; name: string; email: string };

export default function AdminsPage() {
  const { userInfo } = useGetLoggedInUserInfo();
  const isSuperAdmin = userInfo?.role === "superadmin";

  /* Not fetched at all unless the viewer is a superadmin — the query would be
   * refused anyway, and a guaranteed 403 in the console helps nobody. */
  const { admins, isLoading } = useListAdmins(isSuperAdmin);
  const { addAdminAsync, isPending: isAdding } = useAddAdmin();
  const { removeAdminAsync, isPending: isRemoving } = useRemoveAdmin();

  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<Candidate | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  /* Debounced so a burst of keystrokes is one query, not one per letter. */
  const debouncedQuery = useDebounce(query, 250);
  const { candidates, isSearching } = useSearchAdminCandidates(
    debouncedQuery,
    isSuperAdmin && !picked,
  );

  const boxRef = React.useRef<HTMLDivElement>(null);

  /* Clicking anywhere else dismisses the list — without this it would sit open
   * over the table below it. */
  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (!isSuperAdmin) {
    return (
      <div className="max-w-125">
        <p className="cf-meta">Restricted</p>
        <h1 className="cf-display mt-3 text-[32px] leading-none">
          Superadmins only
          <span style={{ color: "var(--cf-orange)" }}>.</span>
        </h1>
        <p className="mt-3 text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
          Granting and revoking admin is reserved for superadmins.
        </p>
      </div>
    );
  }

  const onAdd = async () => {
    if (!picked) return;
    try {
      const result = await addAdminAsync({ email: picked.email });
      toast.success(`${result.email} is now an admin.`);
      setPicked(null);
      setQuery("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't grant admin");
    }
  };

  const choose = (c: Candidate) => {
    setPicked(c);
    setQuery(c.email);
    setIsOpen(false);
  };

  const clearPick = () => {
    setPicked(null);
    setQuery("");
    setIsOpen(false);
  };

  const onRemove = async (id: string, email: string) => {
    try {
      await removeAdminAsync({ userId: id });
      toast.success(`${email} is no longer an admin.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove admin");
    }
  };

  return (
    <div className="max-w-200 space-y-6">
      <div>
        <p className="cf-meta">Access</p>
        <h1 className="cf-display mt-3 text-[32px] leading-none sm:text-[42px]">
          Admins
          <span style={{ color: "var(--cf-orange)" }}>.</span>
        </h1>
        <p className="mt-3 text-[13px]" style={{ color: "var(--cf-ink-soft)" }}>
          Who can reach this panel. Promotion applies to an existing account — it doesn&apos;t
          create one.
        </p>
      </div>

      {/* ── grant ── */}
      <div className="cf-panel cf-raised p-5">
        <label htmlFor="admin-search" className="cf-meta">
          Grant admin
        </label>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div ref={boxRef} className="relative flex-1">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                style={{ color: "var(--cf-ink-soft)" }}
                aria-hidden
              />
              <input
                id="admin-search"
                type="text"
                role="combobox"
                aria-expanded={isOpen}
                aria-controls="admin-candidates"
                aria-autocomplete="list"
                autoComplete="off"
                placeholder="Search by name or email"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  /* Editing the text abandons the pick — otherwise the button
                     would still grant to whoever was chosen before. */
                  setPicked(null);
                  setIsOpen(true);
                }}
                onFocus={() => !picked && setIsOpen(true)}
                className="h-10 w-full border px-3 pl-9 text-[13px] outline-none"
                style={{
                  borderColor: picked ? "var(--cf-orange)" : "var(--cf-line-strong)",
                  background: "#fff",
                  paddingRight: picked || query ? "2.25rem" : undefined,
                }}
              />
              {(picked || query) && (
                <button
                  type="button"
                  onClick={clearPick}
                  aria-label="Clear"
                  className="absolute top-1/2 right-2 -translate-y-1/2 p-1 transition-opacity hover:opacity-60"
                >
                  <X className="size-4" style={{ color: "var(--cf-ink-soft)" }} />
                </button>
              )}
            </div>

            {isOpen && !picked && query.trim().length >= 2 && (
              <ul
                id="admin-candidates"
                role="listbox"
                className="absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto border bg-white"
                style={{ borderColor: "var(--cf-line-strong)" }}
              >
                {isSearching && candidates.length === 0 && (
                  <li className="px-3 py-3 text-[12px]" style={{ color: "var(--cf-ink-soft)" }}>
                    Searching…
                  </li>
                )}

                {!isSearching && candidates.length === 0 && (
                  <li className="px-3 py-3 text-[12px]" style={{ color: "var(--cf-ink-soft)" }}>
                    Nobody matches — or they already have access.
                  </li>
                )}

                {candidates.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => choose(c)}
                      className="w-full border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-(--cf-cream-2)"
                      style={{ borderBottomColor: "var(--cf-line)" }}
                    >
                      <p className="truncate text-[13px] font-medium">{c.name || c.email}</p>
                      <p className="truncate text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
                        {c.email}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            /* Nothing to grant until somebody has actually been chosen from the
               list — a typed address that matched nobody is not a target. */
            disabled={isAdding || !picked}
            onClick={onAdd}
            className="cf-btn cf-press h-10 shrink-0 gap-1.5 px-4 text-[11px] font-bold tracking-[0.16em] uppercase disabled:opacity-50"
          >
            {picked ? <Check className="size-4" /> : <UserPlus className="size-4" />}
            {isAdding ? "Granting…" : "Grant admin"}
          </button>
        </div>

        <p className="mt-3 text-[12px]" style={{ color: "var(--cf-ink-soft)" }}>
          {picked
            ? `${picked.name || picked.email} will be able to reach this panel.`
            : "Only people who have already signed up appear here — with a password or with Google, either works."}
        </p>
      </div>

      {/* ── list ── */}
      <div className="cf-panel cf-raised">
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderBottomColor: "var(--cf-line)" }}
        >
          <p className="cf-meta">
            {isLoading ? "Loading…" : `${admins.length} with access`}
          </p>
        </div>

        <ul className="divide-y" style={{ borderColor: "var(--cf-line)" }}>
          {admins.map((a) => {
            const isSelf = a.id === userInfo?.id;
            const isSuper = a.role === "superadmin";
            return (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                {isSuper ? (
                  <ShieldCheck className="size-4 shrink-0" style={{ color: "var(--cf-orange)" }} />
                ) : (
                  <ShieldCheck
                    className="size-4 shrink-0"
                    style={{ color: "var(--cf-ink-soft)" }}
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {a.name || a.email}
                    {isSelf && (
                      <span className="cf-meta ml-2" style={{ color: "var(--cf-ink-soft)" }}>
                        you
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: "var(--cf-ink-soft)" }}>
                    {a.email}
                  </p>
                </div>

                <span className="cf-meta shrink-0" style={{ color: "var(--cf-ink-soft)" }}>
                  {a.role}
                </span>

                {/* A superadmin is deliberately not removable here, and neither
                    are you — both are refused server-side too, so this is the
                    explanation rather than the enforcement. */}
                {isSuper || isSelf ? (
                  <span
                    className="cf-meta w-24 shrink-0 text-right"
                    style={{ color: "var(--cf-ink-soft)" }}
                    title={
                      isSelf
                        ? "You can't remove your own access"
                        : "Superadmins are changed in the database"
                    }
                  >
                    —
                  </span>
                ) : (
                  <button
                    disabled={isRemoving}
                    onClick={() => onRemove(a.id, a.email)}
                    className="cf-btn-outline h-8 w-24 shrink-0 gap-1.5 px-3 text-[10px] font-bold tracking-[0.16em] uppercase disabled:opacity-50"
                  >
                    <ShieldOff className="size-3.5" />
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
