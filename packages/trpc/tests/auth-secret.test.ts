import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

/* authSecret memoises its answer, so every case needs a freshly evaluated
 * module rather than a fresh call. */
async function loadAuth(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import("@repo/trpc/server/auth");
}

const snapshot = { ...process.env };

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...snapshot };
  vi.restoreAllMocks();
});

describe("authSecret", () => {
  it("returns the configured JWT_SECRET", async () => {
    const secret = "a".repeat(40);
    const { authSecret } = await loadAuth({ JWT_SECRET: secret, NODE_ENV: "test" });
    expect(authSecret()).toBe(secret);
  });

  it("trims surrounding whitespace", async () => {
    const secret = "b".repeat(40);
    const { authSecret } = await loadAuth({ JWT_SECRET: `  ${secret}  `, NODE_ENV: "test" });
    expect(authSecret()).toBe(secret);
  });

  it("falls back to BETTER_AUTH_SECRET", async () => {
    const secret = "c".repeat(40);
    const { authSecret } = await loadAuth({
      JWT_SECRET: undefined,
      BETTER_AUTH_SECRET: secret,
      NODE_ENV: "test",
    });
    expect(authSecret()).toBe(secret);
  });

  it("caches the answer, so a later environment change is ignored", async () => {
    const secret = "d".repeat(40);
    const { authSecret } = await loadAuth({ JWT_SECRET: secret, NODE_ENV: "test" });
    expect(authSecret()).toBe(secret);

    process.env.JWT_SECRET = "e".repeat(40);
    expect(authSecret()).toBe(secret);
  });

  it("refuses to start production without a secret", async () => {
    const { authSecret } = await loadAuth({
      JWT_SECRET: undefined,
      BETTER_AUTH_SECRET: undefined,
      NODE_ENV: "production",
    });
    expect(() => authSecret()).toThrow(/JWT_SECRET/);
  });

  it("assertAuthSecret is the boot-time form of the same check", async () => {
    const { assertAuthSecret } = await loadAuth({
      JWT_SECRET: undefined,
      BETTER_AUTH_SECRET: undefined,
      NODE_ENV: "production",
    });
    expect(() => assertAuthSecret()).toThrow(/JWT_SECRET/);
  });

  it("assertAuthSecret is silent when a secret is configured", async () => {
    const { assertAuthSecret } = await loadAuth({
      JWT_SECRET: "f".repeat(40),
      NODE_ENV: "production",
    });
    expect(() => assertAuthSecret()).not.toThrow();
  });

  it("falls back to a loud development secret outside production", async () => {
    const { authSecret } = await loadAuth({
      JWT_SECRET: undefined,
      BETTER_AUTH_SECRET: undefined,
      NODE_ENV: "development",
    });
    expect(authSecret()).toBe("canvasflow-development-only-insecure-secret");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("JWT_SECRET is not set"));
  });

  it("warns about the development secret only once", async () => {
    const { authSecret } = await loadAuth({
      JWT_SECRET: undefined,
      BETTER_AUTH_SECRET: undefined,
      NODE_ENV: "development",
    });
    authSecret();
    authSecret();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("warns about a short secret but still uses it", async () => {
    const { authSecret } = await loadAuth({ JWT_SECRET: "too-short", NODE_ENV: "test" });
    expect(authSecret()).toBe("too-short");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("9 characters"));
  });

  it("does not warn about a secret of the recommended length", async () => {
    const { authSecret } = await loadAuth({ JWT_SECRET: "g".repeat(32), NODE_ENV: "test" });
    authSecret();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
