/* Regression tests for the auth and rate-limiting fixes.
 *
 *   findings 05 / 06  credential rate limits, password policy, OAuth state
 *                     and redirect validation
 *   findings 07 / 08  the cookie-rotation limiter bypass, and the REST
 *                     surface that skipped limiting entirely
 *   finding  09       scrypt hashing with transparent migration off PBKDF2
 *
 * Run with: pnpm --filter @repo/api test   (tsx, already a devDependency)
 *
 * Hermetic: REDIS_URL is blanked so the limiter uses its in-process fallback,
 * which makes budgets deterministic. Postgres is intentionally unreachable —
 * sign-in requests are expected to 500 once they pass the limiter, and the
 * assertions only ever look at whether a 429 came first.
 */

process.env.NODE_ENV = "production";
process.env.REDIS_URL = "";
process.env.JWT_SECRET = "test-secret-that-is-long-enough-to-pass-checks";
process.env.WEB_URL = "https://app.canvasflow.test";
process.env.TRUSTED_ORIGINS = "https://alt.canvasflow.test";
process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5999/nope";
process.env.GOOGLE_CLIENT_ID = "dummy-google-id";
process.env.GOOGLE_CLIENT_SECRET = "dummy-google-secret";

const AUTH = "/Users/dittyamaity/Desktop/CanvasFlow/packages/trpc/server/auth.ts";
const { safeRedirectTarget, validatePassword, hashPassword, verifyPassword, authRouter } =
  await import(AUTH);
const { leakyBucketRateLimiter } = await import(
  "/Users/dittyamaity/Desktop/CanvasFlow/apps/api/src/lib/rate-limiter.ts"
);

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}\n         got:      ${actual}\n         expected: ${expected}`);
  }
}

const DASH = "https://app.canvasflow.test/dashboard";

// ════════════════════════════════════════════════════════════════════════
console.log("\n#6 safeRedirectTarget — open redirect");
console.log("\n [attacker-supplied targets must all fall back to the dashboard]");
check("absolute foreign origin", safeRedirectTarget("https://evil.example"), DASH);
check("foreign origin w/ path", safeRedirectTarget("https://evil.example/steal?x=1"), DASH);
check("protocol-relative //", safeRedirectTarget("//evil.example"), DASH);
check("protocol-relative /\\", safeRedirectTarget("/\\evil.example"), DASH);
check("javascript: scheme", safeRedirectTarget("javascript:alert(1)"), DASH);
check("data: scheme", safeRedirectTarget("data:text/html,<script>1</script>"), DASH);
check("CRLF header splitting", safeRedirectTarget("/dash\r\nSet-Cookie: a=b"), DASH);
check("NUL byte", safeRedirectTarget("/dash\0evil"), DASH);
check("empty string", safeRedirectTarget(""), DASH);
check("non-string", safeRedirectTarget(undefined), DASH);
check("object", safeRedirectTarget({ toString: () => "https://evil.example" }), DASH);
check("lookalike subdomain", safeRedirectTarget("https://app.canvasflow.test.evil.example"), DASH);
check("userinfo trick", safeRedirectTarget("https://app.canvasflow.test@evil.example"), DASH);

console.log("\n [legitimate targets must be preserved]");
check(
  "relative path",
  safeRedirectTarget("/dashboard/sketches"),
  "https://app.canvasflow.test/dashboard/sketches",
);
check(
  "relative w/ query",
  safeRedirectTarget("/auth/callback?redirect=%2Fforms"),
  "https://app.canvasflow.test/auth/callback?redirect=%2Fforms",
);
check(
  "own origin absolute",
  safeRedirectTarget("https://app.canvasflow.test/auth/callback"),
  "https://app.canvasflow.test/auth/callback",
);
check(
  "TRUSTED_ORIGINS entry",
  safeRedirectTarget("https://alt.canvasflow.test/x"),
  "https://alt.canvasflow.test/x",
);

// ════════════════════════════════════════════════════════════════════════
console.log("\n#5 validatePassword — password policy");
console.log("\n [must be rejected]");
for (const [name, pw] of [
  ["single char", "a"],
  ["8 chars", "abcdefgh"],
  ["11 chars", "abcdefghijk"],
  ["empty", ""],
  ["whitespace padded", "   ab   "],
  ["repeated char", "aaaaaaaaaaaaaaa"],
  ["two distinct chars", "ababababababab"],
  ["common password", "password1234"],
  ["over max length", "a1B".repeat(100)],
] as [string, string][]) {
  check(name, typeof validatePassword(pw, "x@y.com"), "string");
}
check("contains email", typeof validatePassword("dittyamaity-extra", "dittyamaity@x.com"), "string");
check("non-string", typeof validatePassword(12345678901234, "x@y.com"), "string");

console.log("\n [must be accepted]");
check("12 char mixed", validatePassword("correct-horse-battery", "x@y.com"), null);
check("exactly 12", validatePassword("Th1s1sFine!x", "x@y.com"), null);
check("passphrase", validatePassword("a quiet room with books", "x@y.com"), null);
check("short local part ignored", validatePassword("abc-strong-passphrase", "abc@x.com"), null);

// ════════════════════════════════════════════════════════════════════════
console.log("\n#9 Password hashing — scrypt with transparent migration");

const PW = "correct-horse-battery-staple";
const stored = await hashPassword(PW);

check("new hashes use scrypt", stored.startsWith("scrypt$"), true);
check("parameters are stored in the hash", stored.split("$").length, 6);
check("stored hash is not the plaintext", stored.includes(PW), false);

const good = await verifyPassword(PW, stored);
check("correct password verifies", good.valid, true);
check("a current hash needs no rehash", good.needsRehash, false);
check("wrong password is rejected", (await verifyPassword("wrong-password-x", stored)).valid, false);

/* Two hashes of the same password must differ — otherwise the salt is not
 * doing its job and the table is rainbow-table-able. */
check("hashes are salted", (await hashPassword(PW)) === stored, false);

/* A legacy PBKDF2-SHA512/10k hash, in the exact format the old code wrote. */
const crypto = await import("node:crypto");
const legacySalt = crypto.randomBytes(16).toString("hex");
const legacyKey = crypto
  .pbkdf2Sync(PW, legacySalt, 10000, 64, "sha512")
  .toString("hex");
const legacyHash = `${legacySalt}:${legacyKey}`;

const legacy = await verifyPassword(PW, legacyHash);
check("legacy PBKDF2 hashes still verify", legacy.valid, true);
check("legacy hashes are flagged for rehash", legacy.needsRehash, true);
check(
  "wrong password against a legacy hash is rejected",
  (await verifyPassword("wrong-password-x", legacyHash)).valid,
  false,
);
check(
  "a rejected legacy password is not flagged for rehash",
  (await verifyPassword("wrong-password-x", legacyHash)).needsRehash,
  false,
);

console.log("\n [malformed stored hashes must not throw]");
for (const [name, bad] of [
  ["empty", ""],
  ["no separator", "garbage"],
  ["scrypt prefix only", "scrypt$"],
  ["scrypt bad params", "scrypt$0$0$0$aa$bb"],
  ["legacy half", `${legacySalt}:`],
] as [string, string][]) {
  const result = await verifyPassword(PW, bad).catch(() => "THREW");
  check(name, result === "THREW" ? "THREW" : result.valid, false);
}

// ════════════════════════════════════════════════════════════════════════
// Live server, mirroring apps/api/src/server.ts mounting order.
// ════════════════════════════════════════════════════════════════════════
const express = (await import("express")).default;
const cookieParser = (await import("cookie-parser")).default;

const app = express();
app.set("trust proxy", 1);
app.use(cookieParser());

const CREDENTIAL_PATHS = ["/api/auth/signin/email", "/api/auth/sign-in/email"];
app.use(
  CREDENTIAL_PATHS,
  express.json({ limit: "16kb" }),
  leakyBucketRateLimiter({ bucketName: "t-ip", max: 5, windowMs: 60_000, identify: "ip" }),
  leakyBucketRateLimiter({
    bucketName: "t-acct",
    max: 3,
    windowMs: 60_000,
    identify: (req: any) => {
      const email = req.body?.email;
      if (typeof email !== "string") return null;
      const n = email.trim().toLowerCase();
      return n ? `account:${n}` : null;
    },
  }),
);
app.use("/api/auth", authRouter);

/* A "client"-identity limiter, which is the mode findings 07 covers, mounted on
 * both the tRPC and the REST spelling of the same procedure — finding 08. */
app.use(
  ["/trpc/form.submitForm", "/api/forms/submitForm"],
  leakyBucketRateLimiter({ bucketName: "t-client", max: 3, windowMs: 60_000, ipFloorFactor: 2 }),
);
app.use(["/trpc/form.submitForm", "/api/forms/submitForm"], (_req, res) => res.json({ ok: true }));

const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const port = (server.address() as any).port;
const base = `http://127.0.0.1:${port}`;

// ── OAuth flow ─────────────────────────────────────────────────────────
console.log("\n#6 OAuth flow — live server");

const start = await fetch(
  `${base}/api/auth/login/google?redirect=${encodeURIComponent("https://evil.example")}`,
  { redirect: "manual" },
);
const loc = start.headers.get("location") || "";
check("login redirects to Google", loc.startsWith("https://accounts.google.com/"), true);

const stateParam = new URL(loc).searchParams.get("state") || "";
check("state is an opaque nonce, not the redirect", stateParam.includes("evil.example"), false);
check("state is high-entropy (>=32 chars)", stateParam.length >= 32, true);

const setCookies = start.headers.getSetCookie?.() ?? [];
const stateCookie = setCookies.find((c) => c.startsWith("cf_oauth_state="));
const redirCookie = setCookies.find((c) => c.startsWith("cf_oauth_redirect="));
check("state cookie set", Boolean(stateCookie), true);
check("state cookie is HttpOnly", /HttpOnly/i.test(stateCookie || ""), true);
check("state cookie is SameSite=Lax", /SameSite=Lax/i.test(stateCookie || ""), true);
check(
  "hostile redirect neutralised at entry",
  decodeURIComponent(redirCookie || "").includes("evil.example"),
  false,
);
check(
  "redirect cookie holds the safe fallback",
  decodeURIComponent(redirCookie || "").includes("app.canvasflow.test/dashboard"),
  true,
);

const nonce = (stateCookie || "").split("=")[1]?.split(";")[0] ?? "";

const forged = await fetch(`${base}/api/auth/callback/google?code=abc&state=forged-value`, {
  redirect: "manual",
  headers: {
    cookie: `cf_oauth_state=${nonce}; cf_oauth_redirect=${encodeURIComponent("https://evil.example")}`,
  },
});
const forgedLoc = forged.headers.get("location") || "";
check("forged state is rejected", forgedLoc.includes("oauth_state_mismatch"), true);
check("forged state does not reach evil.example", forgedLoc.includes("evil.example"), false);

check(
  "callback without the browser's cookie is rejected",
  (
    await fetch(`${base}/api/auth/callback/google?code=abc&state=${nonce}`, { redirect: "manual" })
  ).headers
    .get("location")
    ?.includes("oauth_state_mismatch"),
  true,
);

const tampered = await fetch(`${base}/api/auth/callback/google?code=abc&state=${nonce}`, {
  redirect: "manual",
  headers: {
    cookie: `cf_oauth_state=${nonce}; cf_oauth_redirect=${encodeURIComponent("https://evil.example/x")}`,
  },
});
check(
  "valid state + tampered redirect cookie never reaches evil.example",
  (tampered.headers.get("location") || "").includes("evil.example"),
  false,
);

// ── Credential rate limiting ───────────────────────────────────────────
console.log("\n#5 Credential rate limiting — live server");

const ipStatuses: number[] = [];
for (let i = 0; i < 9; i++) {
  const r = await fetch(`${base}/api/auth/signin/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `user${i}@x.com`, password: "whatever-long-enough" }),
  });
  ipStatuses.push(r.status);
}
console.log(`    ipStatuses: ${JSON.stringify(ipStatuses)}`);
check("per-IP limiter eventually returns 429", ipStatuses.includes(429), true);
check("per-IP limiter blocks the tail", ipStatuses.slice(-3).every((s) => s === 429), true);
/* GCRA with capacity N admits a burst of N+1: the first request finds an empty
 * bucket and is not itself charged. */
check(
  "per-IP limit admits no more than capacity+1",
  ipStatuses.filter((s) => s !== 429).length <= 6,
  true,
);

const acctStatuses: number[] = [];
for (let i = 0; i < 8; i++) {
  const r = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${i}` },
    body: JSON.stringify({ email: "victim@x.com", password: "guess-attempt-here" }),
  });
  acctStatuses.push(r.status);
}
console.log(`    acctStatuses: ${JSON.stringify(acctStatuses)}`);
check("rotating IP against one account still gets limited", acctStatuses.includes(429), true);
check("per-account limit holds at the tail", acctStatuses.slice(-2).every((s) => s === 429), true);
check(
  "per-account limit admits no more than capacity+1",
  acctStatuses.filter((s) => s !== 429).length <= 4,
  true,
);

const cookieRotate: number[] = [];
for (let i = 0; i < 6; i++) {
  const r = await fetch(`${base}/api/auth/signin/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `cf_visitor_id=${crypto.randomUUID()}`,
      authorization: `Bearer ${crypto.randomUUID()}`,
    },
    body: JSON.stringify({ email: `rot${i}@x.com`, password: "whatever-long-enough" }),
  });
  cookieRotate.push(r.status);
}
check(
  "rotating cookie/bearer cannot reset the auth budget",
  cookieRotate.every((s) => s === 429),
  true,
);

// ── Finding 07: the IP floor under "client" identity ───────────────────
console.log("\n#7 Cookie rotation must not reset a client-identity budget");

/* The bypass: a fresh random cf_visitor_id per request used to mean a fresh
 * bucket per request, because the cookie was the whole identity. Capacity is 3
 * with an ipFloorFactor of 2, so the address may spend 6 (+1 burst) before the
 * floor stops it — no matter how many identities it invents. */
const rotated: number[] = [];
for (let i = 0; i < 12; i++) {
  const r = await fetch(`${base}/trpc/form.submitForm`, {
    method: "POST",
    headers: { cookie: `cf_visitor_id=${crypto.randomUUID()}` },
  });
  rotated.push(r.status);
}
console.log(`    rotated: ${JSON.stringify(rotated)}`);
check("rotating the visitor cookie is eventually throttled", rotated.includes(429), true);
check("the IP floor blocks the tail", rotated.slice(-3).every((s) => s === 429), true);
check(
  "rotation buys no more than the IP floor allows",
  rotated.filter((s) => s !== 429).length <= 7,
  true,
);

/* A stable cookie must hit the tighter per-client limit sooner than the floor,
 * which is what makes the floor a floor rather than the only limit. */
const stableCookie = `cf_visitor_id=${crypto.randomUUID()}`;
const stable: number[] = [];
for (let i = 0; i < 8; i++) {
  const r = await fetch(`${base}/api/forms/submitForm`, {
    method: "POST",
    headers: { cookie: stableCookie, "x-forwarded-for": "198.51.100.7" },
  });
  stable.push(r.status);
}
console.log(`    stable: ${JSON.stringify(stable)}`);
check("a single client is still held to the tighter limit", stable.includes(429), true);
check(
  "per-client limit admits no more than capacity+1",
  stable.filter((s) => s !== 429).length <= 4,
  true,
);

// ── Finding 08: REST and tRPC spellings share the limiter ──────────────
console.log("\n#8 The REST spelling must not bypass the limiter");

/* One address, alternating between the two URLs for the same procedure. If the
 * REST path were unlimited, the /api half would keep returning 200 forever. */
const mixed: { path: string; status: number }[] = [];
for (let i = 0; i < 10; i++) {
  const path = i % 2 === 0 ? "/trpc/form.submitForm" : "/api/forms/submitForm";
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.42" },
  });
  mixed.push({ path, status: r.status });
}
const restAfterExhaustion = mixed.filter((m) => m.path === "/api/forms/submitForm").slice(-2);
console.log(`    mixed: ${JSON.stringify(mixed.map((m) => m.status))}`);
check("the shared budget is exhausted", mixed.some((m) => m.status === 429), true);
check(
  "the REST spelling is throttled too, not just tRPC",
  restAfterExhaustion.every((m) => m.status === 429),
  true,
);

server.close();
console.log(`\n${"─".repeat(52)}`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
