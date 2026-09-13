import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* auth.ts reaches for the database at import time through `@repo/database`,
 * which builds a pg Pool and opens warm connections the moment it loads. None
 * of the functions under test touch SQL, so the module is replaced wholesale. */
vi.mock("@repo/database", () => {
  const table = new Proxy({}, { get: () => undefined });
  return {
    default: {},
    eq: vi.fn(),
    and: vi.fn(),
    lt: vi.fn(),
    usersTable: table,
    accountsTable: table,
    sessionsTable: table,
    verificationsTable: table,
    pendingSignupsTable: table,
  };
});

const { hashPassword, verifyPassword, validatePassword } = await import(
  "@repo/trpc/server/auth"
);

/* ─── Hashing ──────────────────────────────────────────────────────────── */

function legacyPbkdf2Hash(password: string, salt = "legacy-salt"): string {
  const key = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512");
  return `${salt}:${key.toString("hex")}`;
}

function scryptHashWith(password: string, N: number, r: number, p: number): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, {
    N,
    r,
    p,
    maxmem: 96 * 1024 * 1024,
  });
  return ["scrypt", N, r, p, salt.toString("hex"), key.toString("hex")].join("$");
}

describe("hashPassword", () => {
  it("produces a self-describing scrypt digest", async () => {
    const stored = await hashPassword("correct horse battery staple");
    const [scheme, N, r, p, salt, key] = stored.split("$");

    expect(scheme).toBe("scrypt");
    expect(Number(N)).toBe(32768);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toMatch(/^[0-9a-f]{128}$/);
  });

  it("never repeats a salt, so identical passwords hash differently", async () => {
    const [a, b] = await Promise.all([hashPassword("same password"), hashPassword("same password")]);
    expect(a).not.toBe(b);
  });

  it("never stores the password itself", async () => {
    const stored = await hashPassword("hunter2-hunter2");
    expect(stored).not.toContain("hunter2");
  });
});

describe("verifyPassword — scrypt", () => {
  it("accepts the password it was hashed from", async () => {
    const stored = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", stored)).resolves.toEqual({
      valid: true,
      needsRehash: false,
    });
  });

  it("rejects a different password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong horse battery staple", stored)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });

  it("rejects a tampered digest", async () => {
    const stored = await hashPassword("correct horse battery staple");
    const tampered = `${stored.slice(0, -1)}${stored.endsWith("a") ? "b" : "a"}`;
    const result = await verifyPassword("correct horse battery staple", tampered);
    expect(result.valid).toBe(false);
  });

  it("asks for a rehash when the stored cost is below today's default", async () => {
    const stored = scryptHashWith("weak-params-password", 16384, 8, 1);
    await expect(verifyPassword("weak-params-password", stored)).resolves.toEqual({
      valid: true,
      needsRehash: true,
    });
  });

  it("does not ask for a rehash when the wrong password is supplied to a stale digest", async () => {
    const stored = scryptHashWith("weak-params-password", 16384, 8, 1);
    await expect(verifyPassword("not-the-password", stored)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });

  it.each([
    ["a truncated digest", "scrypt$32768$8$1$abcd"],
    ["a zeroed cost", "scrypt$0$8$1$abcd$abcd"],
    ["an empty salt", "scrypt$32768$8$1$$abcd"],
    ["a non-numeric cost", "scrypt$notanumber$8$1$abcd$abcd"],
  ])("rejects %s without throwing", async (_label, stored) => {
    await expect(verifyPassword("anything", stored)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });
});

describe("verifyPassword — legacy PBKDF2 migration", () => {
  it("accepts a password stored under the old scheme", async () => {
    const stored = legacyPbkdf2Hash("legacy password here");
    await expect(verifyPassword("legacy password here", stored)).resolves.toEqual({
      valid: true,
      needsRehash: true,
    });
  });

  it("always asks for a rehash on success, so the account migrates on sign-in", async () => {
    const stored = legacyPbkdf2Hash("legacy password here");
    const { needsRehash } = await verifyPassword("legacy password here", stored);
    expect(needsRehash).toBe(true);
  });

  it("rejects the wrong password against a legacy digest", async () => {
    const stored = legacyPbkdf2Hash("legacy password here");
    await expect(verifyPassword("some other password", stored)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });

  it("survives a round trip through the new scheme after migration", async () => {
    const legacy = legacyPbkdf2Hash("legacy password here");
    const { valid, needsRehash } = await verifyPassword("legacy password here", legacy);
    expect(valid && needsRehash).toBe(true);

    const migrated = await hashPassword("legacy password here");
    await expect(verifyPassword("legacy password here", migrated)).resolves.toEqual({
      valid: true,
      needsRehash: false,
    });
  });
});

describe("verifyPassword — malformed input", () => {
  it.each([
    ["an empty string", ""],
    ["a bare salt with no key", "onlysalt:"],
    ["a bare key with no salt", ":onlykey"],
    ["a string with no separator at all", "garbage"],
  ])("rejects %s", async (_label, stored) => {
    await expect(verifyPassword("anything", stored)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });
});

/* ─── Policy ───────────────────────────────────────────────────────────── */

describe("validatePassword", () => {
  const good = "correct horse battery staple";

  it("accepts a reasonable password", () => {
    expect(validatePassword(good)).toBeNull();
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 12345678901234],
    ["an empty string", ""],
  ])("requires a password — %s", (_label, value) => {
    expect(validatePassword(value)).toBe("Password is required");
  });

  it("enforces a 12 character floor", () => {
    expect(validatePassword("a".repeat(11))).toBe("Password must be at least 12 characters");
    expect(validatePassword("abcdefghijk1")).toBeNull();
  });

  it("enforces a 200 character ceiling", () => {
    expect(validatePassword(`${"abcdef".repeat(34)}x`)).toBe(
      "Password must be at most 200 characters",
    );
  });

  it("rejects a password that is mostly whitespace", () => {
    expect(validatePassword("  abc   def  ")).toBe("Password cannot be mostly whitespace");
  });

  it.each([
    "password1234",
    "changeme1234",
    "qwertyuiop12",
    "administrator",
    "canvasflow123",
  ])("rejects the common password %j", (password) => {
    expect(validatePassword(password)).toBe(
      "That password is too common — choose something less predictable",
    );
  });

  it("matches the common list case-insensitively", () => {
    expect(validatePassword("PASSWORD1234")).toBe(
      "That password is too common — choose something less predictable",
    );
  });

  it("rejects a long password built from one or two characters", () => {
    expect(validatePassword("a".repeat(20))).toBe(
      "Password must use more than a couple of distinct characters",
    );
    expect(validatePassword("ab".repeat(10))).toBe(
      "Password must use more than a couple of distinct characters",
    );
    expect(validatePassword("abc".repeat(10))).toBeNull();
  });

  it("rejects a password containing the email local part", () => {
    expect(validatePassword("alice-loves-cats", "alice@example.com")).toBe(
      "Password must not contain your email address",
    );
  });

  it("matches the local part case-insensitively", () => {
    expect(validatePassword("ALICE-loves-cats", "alice@example.com")).toBe(
      "Password must not contain your email address",
    );
  });

  it("ignores a local part too short to be meaningful", () => {
    expect(validatePassword("bob-loves-cats-x", "bob@example.com")).toBeNull();
  });

  it("ignores the domain half of the address", () => {
    expect(validatePassword("example-com-pass", "alice@example.com")).toBeNull();
  });

  it("ignores a malformed email rather than failing the sign-up", () => {
    expect(validatePassword(good, "not-an-email")).toBeNull();
    expect(validatePassword(good, 42)).toBeNull();
    expect(validatePassword(good, undefined)).toBeNull();
  });
});
