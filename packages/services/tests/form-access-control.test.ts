import { beforeEach, describe, expect, it, vi } from "vitest";

/* The permission layer of the form service.
 *
 * `getFormPermissions` and `canReadFormBundle` are pure. The `require*` helpers
 * are not — they read two rows from Postgres — so the query builder is replaced
 * with a fake that hands back whatever rows the test queued. The point is to
 * pin the *decisions* (which role may do what, and what an archived form
 * forbids), not the SQL. */

const rows: unknown[][] = [];

/** A chainable stand-in for Drizzle's builder; awaiting it shifts one result. */
function queryBuilder(): unknown {
  const handler: ProxyHandler<() => void> = {
    get(_target, property) {
      if (property === "then") {
        const next = rows.shift() ?? [];
        return (resolve: (value: unknown) => void) => resolve(next);
      }
      if (typeof property === "symbol") return undefined;
      return () => builder;
    },
    apply: () => builder,
  };
  const builder = new Proxy(function noop() {}, handler);
  return builder;
}

vi.mock("@repo/database", () => {
  const table = new Proxy({}, { get: () => undefined });
  return {
    db: { select: () => queryBuilder(), insert: () => queryBuilder(), update: () => queryBuilder(), delete: () => queryBuilder() },
    default: { select: () => queryBuilder() },
    eq: vi.fn(),
    and: vi.fn(),
    gte: vi.fn(),
    count: vi.fn(),
    sql: vi.fn(),
    usersTable: table,
  };
});

const {
  canReadFormBundle,
  checkFormAccess,
  getFormPermissions,
  requireEditor,
  requireNotArchived,
  requireOwner,
  requireViewer,
} = await import("@repo/services/form");

const FORM = "form-1";
const USER = "user-1";

/** Queue the rows the next database reads will see. */
function queue(...results: unknown[][]): void {
  rows.length = 0;
  rows.push(...results);
}

const accessRow = (ownerId: string, collaboratorRole: string | null = null) => [
  { ownerId, collaboratorRole },
];
const archivedRow = (isArchived: boolean) => [{ isArchived }];

beforeEach(() => {
  rows.length = 0;
});

/* ─── getFormPermissions ───────────────────────────────────────────────── */

describe("getFormPermissions — owner", () => {
  const permissions = getFormPermissions("owner");

  it("can do everything on a live form", () => {
    expect(permissions).toEqual({
      builder: { canView: true, canEdit: true },
      analytics: { canView: true },
      responses: { canView: true },
      settings: { canDelete: true, canPublish: true, canArchive: true, canShare: true },
    });
  });
});

describe("getFormPermissions — editor", () => {
  const permissions = getFormPermissions("editor");

  it("can build and publish but not delete, archive or share", () => {
    expect(permissions.builder).toEqual({ canView: true, canEdit: true });
    expect(permissions.settings.canPublish).toBe(true);
    expect(permissions.settings.canDelete).toBe(false);
    expect(permissions.settings.canArchive).toBe(false);
    expect(permissions.settings.canShare).toBe(false);
  });

  it("can read analytics and responses", () => {
    expect(permissions.analytics.canView).toBe(true);
    expect(permissions.responses.canView).toBe(true);
  });
});

describe("getFormPermissions — viewer", () => {
  const permissions = getFormPermissions("viewer");

  it("can read results but never open the builder", () => {
    expect(permissions.analytics.canView).toBe(true);
    expect(permissions.responses.canView).toBe(true);
    expect(permissions.builder).toEqual({ canView: false, canEdit: false });
  });

  it("has no settings rights at all", () => {
    expect(Object.values(permissions.settings).every((allowed) => allowed === false)).toBe(true);
  });
});

describe("getFormPermissions — no role", () => {
  it("grants nothing", () => {
    const permissions = getFormPermissions(null);
    const everything = [
      ...Object.values(permissions.builder),
      ...Object.values(permissions.analytics),
      ...Object.values(permissions.responses),
      ...Object.values(permissions.settings),
    ];
    expect(everything.every((allowed) => allowed === false)).toBe(true);
  });
});

describe("getFormPermissions — archived forms", () => {
  it("freezes the builder for everyone, owner included", () => {
    for (const role of ["owner", "editor", "viewer"] as const) {
      const permissions = getFormPermissions(role, true);
      expect(permissions.builder.canEdit, role).toBe(false);
      expect(permissions.builder.canView, role).toBe(false);
    }
  });

  it("still lets anyone with a role read the results", () => {
    for (const role of ["owner", "editor", "viewer"] as const) {
      expect(getFormPermissions(role, true).analytics.canView, role).toBe(true);
      expect(getFormPermissions(role, true).responses.canView, role).toBe(true);
    }
  });

  it("leaves the owner able to unarchive, and nothing else", () => {
    const settings = getFormPermissions("owner", true).settings;
    expect(settings.canArchive).toBe(true);
    expect(settings.canDelete).toBe(false);
    expect(settings.canPublish).toBe(false);
    expect(settings.canShare).toBe(false);
  });

  it("defaults to treating a form as live", () => {
    expect(getFormPermissions("owner")).toEqual(getFormPermissions("owner", false));
  });
});

/* ─── canReadFormBundle ────────────────────────────────────────────────── */

describe("canReadFormBundle", () => {
  it("lets anyone read a published form", () => {
    const form = { isArchived: false, isPublished: true };
    for (const role of ["owner", "editor", "viewer", null] as const) {
      expect(canReadFormBundle(form, role), String(role)).toBe(true);
    }
  });

  it("lets only the builders read an unpublished form", () => {
    const form = { isArchived: false, isPublished: false };
    expect(canReadFormBundle(form, "owner")).toBe(true);
    expect(canReadFormBundle(form, "editor")).toBe(true);
    expect(canReadFormBundle(form, "viewer")).toBe(false);
    expect(canReadFormBundle(form, null)).toBe(false);
  });

  it("closes an archived form to everyone, published or not", () => {
    for (const isPublished of [true, false]) {
      for (const role of ["owner", "editor", "viewer", null] as const) {
        expect(canReadFormBundle({ isArchived: true, isPublished }, role)).toBe(false);
      }
    }
  });
});

/* ─── checkFormAccess ──────────────────────────────────────────────────── */

describe("checkFormAccess", () => {
  it("returns null for a form that does not exist", async () => {
    queue([]);
    await expect(checkFormAccess(FORM, USER)).resolves.toBeNull();
  });

  it("recognises the owner", async () => {
    queue(accessRow(USER));
    await expect(checkFormAccess(FORM, USER)).resolves.toBe("owner");
  });

  it("recognises a collaborator's role", async () => {
    queue(accessRow("someone-else", "editor"));
    await expect(checkFormAccess(FORM, USER)).resolves.toBe("editor");

    queue(accessRow("someone-else", "viewer"));
    await expect(checkFormAccess(FORM, USER)).resolves.toBe("viewer");
  });

  it("prefers ownership over a collaborator row", async () => {
    queue(accessRow(USER, "viewer"));
    await expect(checkFormAccess(FORM, USER)).resolves.toBe("owner");
  });

  it("returns null for a stranger", async () => {
    queue(accessRow("someone-else", null));
    await expect(checkFormAccess(FORM, USER)).resolves.toBeNull();
  });
});

/* ─── requireNotArchived ───────────────────────────────────────────────── */

describe("requireNotArchived", () => {
  it("passes for a live form", async () => {
    queue(archivedRow(false));
    await expect(requireNotArchived(FORM)).resolves.toBeUndefined();
  });

  it("throws for an archived form", async () => {
    queue(archivedRow(true));
    await expect(requireNotArchived(FORM)).rejects.toThrow("Form is archived");
  });

  it("passes for a form that no longer exists, leaving the caller to 404", async () => {
    queue([]);
    await expect(requireNotArchived(FORM)).resolves.toBeUndefined();
  });
});

/* ─── require* ─────────────────────────────────────────────────────────── */

describe("requireOwner", () => {
  it("passes for the owner of a live form", async () => {
    queue(accessRow(USER), archivedRow(false));
    await expect(requireOwner(FORM, USER)).resolves.toBeUndefined();
  });

  it.each(["editor", "viewer"])("refuses a %s", async (role) => {
    queue(accessRow("someone-else", role));
    await expect(requireOwner(FORM, USER)).rejects.toThrow("Unauthorized: Owner access required");
  });

  it("refuses a stranger", async () => {
    queue(accessRow("someone-else", null));
    await expect(requireOwner(FORM, USER)).rejects.toThrow("Unauthorized: Owner access required");
  });

  it("refuses the owner of an archived form by default", async () => {
    queue(accessRow(USER), archivedRow(true));
    await expect(requireOwner(FORM, USER)).rejects.toThrow("Form is archived");
  });

  it("lets the owner through on an archived form when the caller opts in", async () => {
    /* This is how unarchiving works: the only operation an archived form still
     * accepts from its owner. */
    queue(accessRow(USER));
    await expect(requireOwner(FORM, USER, true)).resolves.toBeUndefined();
  });
});

describe("requireEditor", () => {
  it.each(["owner", "editor"])("passes for a %s on a live form", async (role) => {
    queue(role === "owner" ? accessRow(USER) : accessRow("someone-else", "editor"), archivedRow(false));
    await expect(requireEditor(FORM, USER)).resolves.toBeUndefined();
  });

  it("refuses a viewer", async () => {
    queue(accessRow("someone-else", "viewer"));
    await expect(requireEditor(FORM, USER)).rejects.toThrow("Unauthorized: Editor access required");
  });

  it("refuses a stranger", async () => {
    queue(accessRow("someone-else", null));
    await expect(requireEditor(FORM, USER)).rejects.toThrow("Unauthorized: Editor access required");
  });

  it("refuses everyone on an archived form, however senior", async () => {
    queue(accessRow(USER), archivedRow(true));
    await expect(requireEditor(FORM, USER)).rejects.toThrow("Form is archived");
  });
});

describe("requireViewer", () => {
  it.each(["owner", "editor", "viewer"])("passes for a %s", async (role) => {
    queue(role === "owner" ? accessRow(USER) : accessRow("someone-else", role));
    await expect(requireViewer(FORM, USER)).resolves.toBeUndefined();
  });

  it("refuses a stranger", async () => {
    queue(accessRow("someone-else", null));
    await expect(requireViewer(FORM, USER)).rejects.toThrow("Unauthorized: Viewer access required");
  });

  it("does not consult the archive flag, so results stay readable", async () => {
    queue(accessRow(USER));
    await expect(requireViewer(FORM, USER)).resolves.toBeUndefined();
  });
});
