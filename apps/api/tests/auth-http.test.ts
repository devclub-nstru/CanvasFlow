import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { Request } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/* The HTTP half of the auth hardening suite, ported from the hand-rolled
 * tests/auth-hardening.test.mts harness.
 *
 * These are not unit tests: they stand a real Express app up on a real port and
 * mirror the mounting order of apps/api/src/server.ts, because the findings
 * they cover are about *mounting* — a limiter that the REST spelling of a
 * procedure skipped, and one whose identity a caller could rotate at will.
 * Neither is visible from the limiter in isolation.
 *
 * Postgres is never reached: every path exercised here is either a redirect or
 * a rejection that happens before the handler runs. */

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

const { authRouter } = await import("@repo/trpc/server/auth");
const { leakyBucketRateLimiter } = await import("../src/lib/rate-limiter");

let server: Server;
let base: string;

beforeAll(async () => {
  const express = (await import("express")).default;
  const cookieParser = (await import("cookie-parser")).default;

  const app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser());

  /* Mirrors the CREDENTIAL_PATHS mount in server.ts: a per-address limiter and
   * a per-account one, so neither rotating addresses nor rotating accounts
   * escapes on its own. */
  app.use(
    ["/api/auth/signin/email", "/api/auth/sign-in/email"],
    express.json({ limit: "16kb" }),
    leakyBucketRateLimiter({ bucketName: "t-ip", max: 5, windowMs: 60_000, identify: "ip" }),
    leakyBucketRateLimiter({
      bucketName: "t-acct",
      max: 3,
      windowMs: 60_000,
      identify: (req: Request) => {
        const email = (req.body as { email?: unknown } | undefined)?.email;
        if (typeof email !== "string") return null;
        const normalised = email.trim().toLowerCase();
        return normalised ? `account:${normalised}` : null;
      },
    }),
  );

  /* Mirrors the EMAIL_SENDING_PATHS mount. */
  app.use(
    ["/api/auth/forgot-password"],
    express.json({ limit: "16kb" }),
    leakyBucketRateLimiter({ bucketName: "t-mail-ip", max: 3, windowMs: 60_000, identify: "ip" }),
  );

  app.use("/api/auth", authRouter);

  /* Both spellings of the same procedure, sharing one client-identity limiter. */
  app.use(
    ["/trpc/form.submitForm", "/api/forms/submitForm"],
    leakyBucketRateLimiter({ bucketName: "t-client", max: 3, windowMs: 60_000, ipFloorFactor: 2 }),
  );
  app.use(["/trpc/form.submitForm", "/api/forms/submitForm"], (_req, res) => res.json({ ok: true }));

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

/* ─── OAuth flow ───────────────────────────────────────────────────────── */

describe("GET /api/auth/login/google", () => {
  async function begin(redirect: string) {
    const response = await fetch(
      `${base}/api/auth/login/google?redirect=${encodeURIComponent(redirect)}`,
      { redirect: "manual" },
    );
    const location = response.headers.get("location") ?? "";
    const setCookies = response.headers.getSetCookie?.() ?? [];
    return {
      location,
      state: new URL(location).searchParams.get("state") ?? "",
      stateCookie: setCookies.find((c) => c.startsWith("cf_oauth_state=")) ?? "",
      redirectCookie: setCookies.find((c) => c.startsWith("cf_oauth_redirect=")) ?? "",
    };
  }

  it("redirects to Google", async () => {
    const { location } = await begin("/dashboard");
    expect(location.startsWith("https://accounts.google.com/")).toBe(true);
  });

  it("sends an opaque, high-entropy nonce as the state, not the redirect", async () => {
    const { state } = await begin("https://evil.example");
    expect(state).not.toContain("evil.example");
    expect(state.length).toBeGreaterThanOrEqual(32);
  });

  it("uses a fresh nonce for every attempt", async () => {
    const [first, second] = await Promise.all([begin("/dashboard"), begin("/dashboard")]);
    expect(first.state).not.toBe(second.state);
  });

  it("stores the state in an HttpOnly, SameSite=Lax cookie", async () => {
    const { stateCookie } = await begin("/dashboard");
    expect(stateCookie).toBeTruthy();
    expect(stateCookie).toMatch(/HttpOnly/i);
    expect(stateCookie).toMatch(/SameSite=Lax/i);
  });

  it("neutralises a hostile redirect at the point of entry", async () => {
    const { redirectCookie } = await begin("https://evil.example");
    const stored = decodeURIComponent(redirectCookie);
    expect(stored).not.toContain("evil.example");
    expect(stored).toContain("app.canvasflow.test/dashboard");
  });

  it("keeps a legitimate redirect", async () => {
    const { redirectCookie } = await begin("/forms/abc");
    expect(decodeURIComponent(redirectCookie)).toContain("/forms/abc");
  });
});

describe("GET /api/auth/callback/google", () => {
  async function nonce(): Promise<string> {
    const response = await fetch(`${base}/api/auth/login/google?redirect=%2Fdashboard`, {
      redirect: "manual",
    });
    const cookie = (response.headers.getSetCookie?.() ?? []).find((c) =>
      c.startsWith("cf_oauth_state="),
    );
    return cookie?.split("=")[1]?.split(";")[0] ?? "";
  }

  async function callback(query: string, cookie?: string) {
    const response = await fetch(`${base}/api/auth/callback/google?${query}`, {
      redirect: "manual",
      ...(cookie ? { headers: { cookie } } : {}),
    });
    return response.headers.get("location") ?? "";
  }

  it("rejects a forged state", async () => {
    const state = await nonce();
    const location = await callback(
      "code=abc&state=forged-value",
      `cf_oauth_state=${state}; cf_oauth_redirect=${encodeURIComponent("https://evil.example")}`,
    );
    expect(location).toContain("oauth_state_mismatch");
    expect(location).not.toContain("evil.example");
  });

  it("rejects a callback that arrives without the browser's cookie", async () => {
    const state = await nonce();
    expect(await callback(`code=abc&state=${state}`)).toContain("oauth_state_mismatch");
  });

  it("never honours a tampered redirect cookie, even with a matching state", async () => {
    const state = await nonce();
    const location = await callback(
      `code=abc&state=${state}`,
      `cf_oauth_state=${state}; cf_oauth_redirect=${encodeURIComponent("https://evil.example/x")}`,
    );
    expect(location).not.toContain("evil.example");
  });
});

/* ─── Credential rate limiting ─────────────────────────────────────────── */

describe("credential endpoints", () => {
  async function signIn(
    path: string,
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
  ): Promise<number> {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    return response.status;
  }

  it("throttles a single address working through many accounts", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 9; i++) {
      statuses.push(
        await signIn("/api/auth/signin/email", {
          email: `user${i}@x.com`,
          password: "whatever-long-enough",
        }),
      );
    }

    expect(statuses).toContain(429);
    expect(statuses.slice(-3).every((s) => s === 429)).toBe(true);
    /* GCRA with capacity N admits a burst of N+1: the first request finds an
     * empty bucket and is not itself charged. */
    expect(statuses.filter((s) => s !== 429).length).toBeLessThanOrEqual(6);
  });

  it("throttles many addresses working through a single account", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      statuses.push(
        await signIn(
          "/api/auth/sign-in/email",
          { email: "victim@x.com", password: "guess-attempt-here" },
          { "x-forwarded-for": `203.0.113.${i}` },
        ),
      );
    }

    expect(statuses, "the limit follows the account under attack").toContain(429);
    expect(statuses.slice(-2).every((s) => s === 429)).toBe(true);
    expect(statuses.filter((s) => s !== 429).length).toBeLessThanOrEqual(4);
  });

  it("cannot be reset by rotating the cookie or the bearer token", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        await signIn(
          "/api/auth/signin/email",
          { email: `rot${i}@x.com`, password: "whatever-long-enough" },
          {
            cookie: `cf_visitor_id=${crypto.randomUUID()}`,
            authorization: `Bearer ${crypto.randomUUID()}`,
          },
        ),
      );
    }

    /* The per-address bucket is already exhausted by the earlier cases in this
     * file, and no caller-supplied identifier can clear it. */
    expect(statuses.every((s) => s === 429)).toBe(true);
  });
});

/* ─── Client identity and the address floor ────────────────────────────── */

describe("a client-identity limiter", () => {
  it("throttles a caller that invents a new visitor cookie per request", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const response = await fetch(`${base}/trpc/form.submitForm`, {
        method: "POST",
        headers: { cookie: `cf_visitor_id=${crypto.randomUUID()}` },
      });
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
    expect(statuses.slice(-3).every((s) => s === 429)).toBe(true);
    /* Capacity 3 with an ipFloorFactor of 2: the address may spend 6, plus the
     * uncharged first request, however many identities it invents. */
    expect(statuses.filter((s) => s !== 429).length).toBeLessThanOrEqual(7);
  });

  it("holds a single well-behaved client to the tighter per-client limit", async () => {
    const cookie = `cf_visitor_id=${crypto.randomUUID()}`;
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const response = await fetch(`${base}/api/forms/submitForm`, {
        method: "POST",
        headers: { cookie, "x-forwarded-for": "198.51.100.7" },
      });
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s !== 429).length).toBeLessThanOrEqual(4);
  });
});

describe("the REST and tRPC spellings of one procedure", () => {
  it("share a budget, so neither is a way around the other", async () => {
    const seen: Array<{ path: string; status: number }> = [];

    for (let i = 0; i < 10; i++) {
      const path = i % 2 === 0 ? "/trpc/form.submitForm" : "/api/forms/submitForm";
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.42" },
      });
      seen.push({ path, status: response.status });
    }

    expect(seen.some((entry) => entry.status === 429)).toBe(true);

    const restTail = seen.filter((entry) => entry.path === "/api/forms/submitForm").slice(-2);
    expect(
      restTail.every((entry) => entry.status === 429),
      "the REST spelling is throttled too, not just tRPC",
    ).toBe(true);
  });
});
