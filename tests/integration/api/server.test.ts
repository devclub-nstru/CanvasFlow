import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/* The real apps/api/src/server.ts, booted.
 *
 * Every other HTTP test in this suite mounts a hand-built Express app that
 * *mirrors* server.ts — deliberately, so a rate-limit test is not also a test
 * of CORS. The gap that leaves is the wiring itself: middleware order, the
 * origin allow-list, the body limits, and the REST surface trpc-to-openapi
 * generates alongside the tRPC one. A procedure reachable at /trpc but broken
 * at /api would pass everything written so far.
 *
 * server.ts exports the app without listening; index.ts does that. So this
 * boots the genuine article and speaks HTTP to it. */

/* The factory is hoisted above every import, so it cannot close over a
 * top-level variable — build the stub inside it. Nothing here asserts on the
 * logger; it is mocked only to keep server.ts's boot chatter out of the run. */
vi.mock("@repo/logger", () => {
  const stub = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { logger: stub, default: stub };
});

/* Static imports: vi.mock is hoisted above them by Vitest, and nothing here
 * needs environment set between imports the way the upload test does. */
import { resetDatabase, teardownDatabase } from "../helpers/db";
import { closeRedis, resetRedis } from "../helpers/redis";
import { makeForm, makeSession, makeUser, type TestUser } from "../helpers/factories";
import { app } from "../../../apps/api/src/server";

let server: Server;
let base: string;
let owner: TestUser;

async function call(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; headers: Headers; body: unknown; text: string }> {
  const response = await fetch(`${base}${path}`, { redirect: "manual", ...init });
  const text = await response.text();

  let body: unknown = undefined;
  try {
    body = JSON.parse(text);
  } catch {
    /* Not every endpoint answers JSON — /docs serves HTML. */
  }

  return { status: response.status, headers: response.headers, body, text };
}

/** A Cookie header carrying a live session for `user`. */
async function cookieFor(user: TestUser): Promise<string> {
  const { token } = await makeSession(user);
  return `cf_jwt=${token}`;
}

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(() => resolve(null)));
  await closeRedis();
  await teardownDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  owner = await makeUser({ name: "Owner" });
  vi.clearAllMocks();
});

/* ─── It is alive ──────────────────────────────────────────────────────── */

describe("the liveness surface", () => {
  it("answers at the root", async () => {
    const result = await call("/");
    expect(result.status).toBe(200);
  });

  it("reports healthy without touching a dependency", async () => {
    const result = await call("/health");
    expect(result.status).toBe(200);
  });

  it("reports readiness by actually checking Postgres and Redis", async () => {
    const result = await call("/ready");

    expect(result.status, "both services are up in this suite").toBe(200);
    expect(result.body).toMatchObject({ ready: true });
  });

  it("never lets a readiness answer be cached", async () => {
    const result = await call("/ready");
    expect(result.headers.get("cache-control")).toBe("no-store");
  });

  it("lists the configured OAuth providers", async () => {
    const result = await call("/api/auth/providers");
    expect(result.body).toMatchObject({ providers: expect.arrayContaining(["google"]) });
  });
});

/* ─── Both spellings of the same router ────────────────────────────────── */

describe("the tRPC surface", () => {
  it("serves a public procedure", async () => {
    const result = await call("/trpc/health.getHealth");

    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).toContain("healthy");
  });

  it("refuses an authenticated procedure with no session", async () => {
    const result = await call("/trpc/form.listFormsByUserId");

    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.text).toMatch(/not logged in/i);
  });

  it("serves an authenticated procedure to a real session cookie", async () => {
    await makeForm(owner, { title: "Mine" });

    const result = await call("/trpc/form.listFormsByUserId", {
      headers: { cookie: await cookieFor(owner) },
    });

    expect(result.status).toBe(200);
    expect(result.text).toContain("Mine");
  });
});

describe("the REST surface generated alongside it", () => {
  it("serves the same health check at its REST path", async () => {
    const result = await call("/api/health");

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ status: "healthy" });
  });

  it("serves an authenticated procedure with the same cookie", async () => {
    await makeForm(owner, { title: "Mine" });

    const result = await call("/api/forms/listFormsByUserId", {
      headers: { cookie: await cookieFor(owner) },
    });

    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).toContain("Mine");
  });

  it("refuses the REST spelling without a session too", async () => {
    const result = await call("/api/forms/listFormsByUserId");
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it("accepts a mutation as a POST with a JSON body", async () => {
    const result = await call("/api/forms/createForm", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: await cookieFor(owner) },
      body: JSON.stringify({ title: "Made over REST", slug: "made-over-rest" }),
    });

    expect(result.status).toBeLessThan(300);
    expect(JSON.stringify(result.body)).toMatch(/[0-9a-f-]{36}/);
  });

  it("publishes a document describing itself", async () => {
    const result = await call("/openapi.json");
    const document = result.body as { paths?: Record<string, unknown>; info?: { title?: string } };

    expect(result.status).toBe(200);
    expect(document.info?.title).toBe("CanvasFlow OpenAPI");
    expect(Object.keys(document.paths ?? {}).length).toBeGreaterThan(0);
  });

  it("describes the health route in that document", async () => {
    const result = await call("/openapi.json");
    const document = result.body as { paths: Record<string, unknown> };
    expect(Object.keys(document.paths)).toContain("/health");
  });
});

/* ─── Cross-origin ─────────────────────────────────────────────────────── */

describe("the origin allow-list", () => {
  it("lets the local web app through with credentials", async () => {
    const result = await call("/health", { headers: { origin: "http://localhost:3000" } });

    expect(result.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(result.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("lets an origin named in TRUSTED_ORIGINS through", async () => {
    const result = await call("/health", {
      headers: { origin: "https://alt.canvasflow.test" },
    });
    expect(result.headers.get("access-control-allow-origin")).toBe("https://alt.canvasflow.test");
  });

  it("does not echo an origin it has never heard of", async () => {
    const result = await call("/health", { headers: { origin: "https://evil.test" } });

    expect(result.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("still answers a same-origin request that sends no Origin at all", async () => {
    const result = await call("/health");
    expect(result.status).toBe(200);
  });

  it("answers a preflight for an allowed origin", async () => {
    const result = await call("/trpc/form.createForm", {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    expect(result.status).toBeLessThan(300);
    expect(result.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });

  it("exposes the headers the browser needs to read", async () => {
    const result = await call("/health", { headers: { origin: "http://localhost:3000" } });
    const exposed = result.headers.get("access-control-expose-headers") ?? "";

    expect(exposed).toContain("Set-Cookie");
    expect(exposed).toContain("Server-Timing");
  });
});

/* ─── Limits and failure modes ─────────────────────────────────────────── */

describe("request limits", () => {
  it("refuses a body over the 200kb ceiling", async () => {
    const result = await call("/api/forms/createForm", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: await cookieFor(owner) },
      body: JSON.stringify({ title: "x".repeat(300_000), slug: "big" }),
    });

    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it("holds credential endpoints to a much tighter 16kb", async () => {
    const result = await call("/api/auth/signin/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.test", password: "x".repeat(20_000) }),
    });

    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it("mounts the upload router, limits and all", async () => {
    const result = await call("/uploads/limits");

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      maxMb: expect.any(Number),
      image: expect.any(Number),
      video: expect.any(Number),
      raw: expect.any(Number),
    });
  });
});

describe("when something goes wrong", () => {
  it("answers 404 for a path nothing is mounted on", async () => {
    const result = await call("/no-such-route");
    expect(result.status).toBe(404);
  });

  it("answers 404 for a procedure that does not exist", async () => {
    const result = await call("/trpc/form.noSuchProcedure");
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it("answers a validation failure as structured JSON, not an HTML page", async () => {
    const result = await call("/trpc/form.getForm?input=" + encodeURIComponent('{"id":"nope"}'), {
      headers: { cookie: await cookieFor(owner) },
    });

    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.body, "a client can act on JSON; it cannot act on an error page").toBeDefined();
    expect(result.text).not.toContain("<html");
  });

  it("never leaks a secret or a connection string in an error", async () => {
    /* Not a stack-trace assertion: tRPC deliberately includes one outside
     * production, and this suite runs with NODE_ENV=test. What must never
     * appear at any NODE_ENV is credentials. */
    const result = await call("/trpc/form.getForm?input=" + encodeURIComponent('{"id":"nope"}'), {
      headers: { cookie: await cookieFor(owner) },
    });

    expect(result.text).not.toContain(process.env.JWT_SECRET!);
    expect(result.text).not.toContain("postgresql://");
    expect(result.text).not.toContain("redis://");
  });
});
