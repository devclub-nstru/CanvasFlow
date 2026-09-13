import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* redis.js builds live ioredis connections at import time and throws outright
 * when REDIS_URL is missing, so it is replaced before anything imports it. */
const redis = { exists: vi.fn() };
vi.mock("../src/core/database/redis.js", () => ({
  redis,
  createSubscriber: vi.fn(),
  closeRedis: vi.fn(),
}));

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("../src/core/logger/logger.js", () => ({ logger, default: logger }));

const { parseCookies, extractToken, verifyHS256JWT, isSessionRevoked } = await import(
  "../src/core/auth/jwt.js"
);

const SECRET = process.env.JWT_SECRET;

function sign(payload, secret = SECRET) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const head = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;
  const signature = crypto.createHmac("sha256", secret).update(head).digest("base64url");
  return `${head}.${signature}`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

/* ─── parseCookies ─────────────────────────────────────────────────────── */

describe("parseCookies", () => {
  it("returns nothing for an absent or empty header", () => {
    expect(parseCookies("")).toEqual({});
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies(undefined)).toEqual({});
  });

  it("splits a normal cookie header", () => {
    expect(parseCookies("a=1; b=2")).toEqual({ a: "1", b: "2" });
  });

  it("tolerates missing spaces and stray padding", () => {
    expect(parseCookies("  a = 1 ;b=2  ")).toEqual({ a: "1", b: "2" });
  });

  it("keeps everything after the first equals sign in the value", () => {
    expect(parseCookies("token=a=b=c")).toEqual({ token: "a=b=c" });
  });

  it("percent-decodes the value", () => {
    expect(parseCookies("greeting=hello%20world")).toEqual({ greeting: "hello world" });
  });

  it("skips entries with no equals sign", () => {
    expect(parseCookies("justaflag; a=1")).toEqual({ a: "1" });
  });

  it("skips entries with an empty name", () => {
    expect(parseCookies("=orphan; a=1")).toEqual({ a: "1" });
  });

  it("lets a later duplicate win", () => {
    expect(parseCookies("a=1; a=2")).toEqual({ a: "2" });
  });
});

/* ─── extractToken ─────────────────────────────────────────────────────── */

describe("extractToken", () => {
  it("prefers a bearer token", () => {
    expect(extractToken({ authorization: "Bearer abc", cookie: "cf_jwt=from-cookie" })).toBe("abc");
  });

  it("ignores an authorization header that is not a bearer token", () => {
    expect(extractToken({ authorization: "Basic abc", cookie: "cf_jwt=from-cookie" })).toBe(
      "from-cookie",
    );
  });

  it("reads the cf_jwt cookie the API sets", () => {
    expect(extractToken({ cookie: "cf_jwt=abc" })).toBe("abc");
  });

  it("still reads the pre-migration better-auth cookie", () => {
    expect(extractToken({ cookie: "better-auth.session_token=legacy" })).toBe("legacy");
  });

  it("prefers cf_jwt when both cookies are present", () => {
    expect(
      extractToken({ cookie: "better-auth.session_token=legacy; cf_jwt=current" }),
    ).toBe("current");
  });

  it("returns null when there is nothing to read", () => {
    expect(extractToken({})).toBeNull();
    expect(extractToken({ cookie: "" })).toBeNull();
    expect(extractToken({ cookie: "unrelated=1" })).toBeNull();
  });
});

/* ─── verifyHS256JWT ───────────────────────────────────────────────────── */

describe("verifyHS256JWT", () => {
  it("returns the payload of a token signed with the shared secret", () => {
    const token = sign({ sub: "user-1", sessionId: "sess-1" });
    expect(verifyHS256JWT(token)).toMatchObject({ sub: "user-1", sessionId: "sess-1" });
  });

  it("rejects a token signed with a different secret", () => {
    const token = sign({ sub: "user-1" }, "a-completely-different-secret-value");
    expect(verifyHS256JWT(token)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = sign({ sub: "user-1", role: "participant" });
    const [head, , signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "user-1", role: "host" })).toString(
      "base64url",
    );
    expect(verifyHS256JWT(`${head}.${forged}.${signature}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = sign({ sub: "user-1" });
    const [head, payload, signature] = token.split(".");
    const flipped = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
    expect(verifyHS256JWT(`${head}.${payload}.${flipped}`)).toBeNull();
  });

  it.each([
    ["an empty string", ""],
    ["a token with too few parts", "a.b"],
    ["a token with too many parts", "a.b.c.d"],
    ["unstructured junk", "not-a-token"],
  ])("rejects %s", (_label, token) => {
    expect(verifyHS256JWT(token)).toBeNull();
  });

  it("rejects a signature of the wrong length without throwing", () => {
    const token = sign({ sub: "user-1" });
    const [head, payload] = token.split(".");
    expect(() => verifyHS256JWT(`${head}.${payload}.short`)).not.toThrow();
    expect(verifyHS256JWT(`${head}.${payload}.short`)).toBeNull();
  });

  it("rejects a correctly signed token whose payload is not JSON", () => {
    const head = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
    const payload = Buffer.from("not json at all").toString("base64url");
    const signature = crypto
      .createHmac("sha256", SECRET)
      .update(`${head}.${payload}`)
      .digest("base64url");
    expect(verifyHS256JWT(`${head}.${payload}.${signature}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = sign({ sub: "user-1", exp: Math.floor(Date.now() / 1000) - 1 });
    expect(verifyHS256JWT(token)).toBeNull();
  });

  it("accepts a token that has not expired yet", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = sign({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(verifyHS256JWT(token)).toMatchObject({ sub: "user-1" });
  });

  it("rejects a token the instant it expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = sign({ sub: "user-1", exp });
    expect(verifyHS256JWT(token)).not.toBeNull();

    vi.setSystemTime(new Date(exp * 1000));
    expect(verifyHS256JWT(token)).toBeNull();
  });

  it("accepts a token with no expiry, since the API decides the lifetime", () => {
    expect(verifyHS256JWT(sign({ sub: "user-1" }))).toMatchObject({ sub: "user-1" });
  });

  it("honours an explicitly supplied secret", () => {
    const other = "another-secret-long-enough-for-the-test";
    expect(verifyHS256JWT(sign({ sub: "u" }, other), other)).toMatchObject({ sub: "u" });
    expect(verifyHS256JWT(sign({ sub: "u" }, other))).toBeNull();
  });
});

/* ─── isSessionRevoked ─────────────────────────────────────────────────── */

describe("isSessionRevoked", () => {
  it("reports not revoked when there is no session id", async () => {
    await expect(isSessionRevoked(null)).resolves.toBe(false);
    await expect(isSessionRevoked(undefined)).resolves.toBe(false);
    await expect(isSessionRevoked("")).resolves.toBe(false);
    expect(redis.exists).not.toHaveBeenCalled();
  });

  it("reports revoked when the denylist entry exists", async () => {
    redis.exists.mockResolvedValue(1);
    await expect(isSessionRevoked("sess-1")).resolves.toBe(true);
  });

  it("reports not revoked when the entry is absent", async () => {
    redis.exists.mockResolvedValue(0);
    await expect(isSessionRevoked("sess-1")).resolves.toBe(false);
  });

  it("looks the session up under the shared, unprefixed auth namespace", async () => {
    redis.exists.mockResolvedValue(0);
    await isSessionRevoked("sess-1");
    const [key] = redis.exists.mock.calls[0];
    expect(key).toContain("auth:revoked:sess-1");
    expect(key).not.toContain("menti");
  });

  it("fails open on a Redis error, loudly rather than silently", async () => {
    redis.exists.mockRejectedValue(new Error("connection reset"));
    await expect(isSessionRevoked("sess-1")).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("revocation check failed"),
      "connection reset",
    );
  });
});
