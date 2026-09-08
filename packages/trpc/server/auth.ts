import express, { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "@repo/database";
import { eq, and, lt, usersTable, accountsTable, sessionsTable, SelectUser } from "@repo/database";
import { isRedisConfigured, redisKey, redisReady } from "@repo/redis";

/* ── Signing secret ────────────────────────────────────────────────────────
 *
 * Every token this module mints or verifies is signed with this one value.
 * It used to fall back to a hardcoded literal, which meant a deployment that
 * forgot to set the variable would happily accept tokens forged by anyone who
 * had read the source. There is no safe default for a signing key, so in
 * production a missing secret is a startup error rather than a silent
 * downgrade.
 *
 * Resolution is lazy and cached: `apps/web` pulls the router type through this
 * module, and a throw at import time would break the build rather than the
 * misconfigured deployment.
 */

const DEV_ONLY_SECRET = "canvasflow-development-only-insecure-secret";
const MIN_RECOMMENDED_LENGTH = 32;

let cachedSecret: string | null = null;
let warnedAboutDevSecret = false;
let warnedAboutShortSecret = false;

export function authSecret(): string {
  if (cachedSecret) return cachedSecret;

  const configured = (process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "").trim();

  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET (or BETTER_AUTH_SECRET) is not set. Sessions are signed with this " +
          "value, so there is no safe default — generate one with `openssl rand -base64 32` " +
          "and add it to the environment before starting the API.",
      );
    }

    if (!warnedAboutDevSecret) {
      warnedAboutDevSecret = true;
      console.warn(
        "[auth] JWT_SECRET is not set — falling back to a well-known development secret. " +
          "Tokens signed with it are forgeable by anyone. Never run this outside local dev.",
      );
    }

    cachedSecret = DEV_ONLY_SECRET;
    return cachedSecret;
  }

  if (configured.length < MIN_RECOMMENDED_LENGTH && !warnedAboutShortSecret) {
    warnedAboutShortSecret = true;
    console.warn(
      `[auth] the configured signing secret is ${configured.length} characters; ` +
        `${MIN_RECOMMENDED_LENGTH} or more is recommended (\`openssl rand -base64 32\`).`,
    );
  }

  cachedSecret = configured;
  return cachedSecret;
}

/* Called from the API's boot path so a production process with no secret dies
 * on startup instead of on the first sign-in attempt. */
export function assertAuthSecret(): void {
  authSecret();
}

// Cookie parser utility for server side
function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieString) return cookies;
  cookieString.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts[0]?.trim();
    if (name) {
      cookies[name] = decodeURIComponent(parts.slice(1).join("=").trim());
    }
  });
  return cookies;
}

/* ── Password hashing ──────────────────────────────────────────────────────
 *
 * Was PBKDF2-SHA512 at 10,000 iterations. That was reasonable a decade ago and
 * is roughly twenty times too weak now — current guidance for PBKDF2-SHA512 is
 * on the order of 210,000 — so a leaked `account` table would be cracked far
 * faster than it should be.
 *
 * New hashes use scrypt, which is memory-hard and therefore much more
 * expensive to attack with GPUs than any iteration count of PBKDF2. It is in
 * Node's own crypto module, so this costs no new dependency.
 *
 * The algorithm and its parameters are stored in the hash string rather than
 * being implied by the code. That is what makes the next change to these
 * numbers a one-line edit instead of another migration: a stored hash always
 * carries the parameters it was produced with.
 *
 *   scrypt$<N>$<r>$<p>$<saltHex>$<keyHex>
 *
 * Legacy PBKDF2 hashes (`<saltHex>:<keyHex>`, no prefix) are still verified,
 * and re-hashed to scrypt on the owner's next successful sign-in, so existing
 * users migrate without being asked to do anything.
 */

const SCRYPT_N = 32768; // 2^15 — CPU/memory cost
const SCRYPT_R = 8; // block size
const SCRYPT_P = 1; // parallelisation
const SCRYPT_KEYLEN = 64;

/* scrypt needs roughly 128 * N * r bytes (~33 MB at these parameters), which
 * exceeds Node's 32 MB default and would otherwise throw. */
const SCRYPT_MAXMEM = 96 * 1024 * 1024;

const LEGACY_PBKDF2_ITERATIONS = 10000;
const LEGACY_PBKDF2_KEYLEN = 64;
const LEGACY_PBKDF2_DIGEST = "sha512";

function scryptHash(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
      (err, derivedKey) => (err ? reject(err) : resolve(derivedKey)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scryptHash(password, salt);
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("hex"),
    key.toString("hex"),
  ].join("$");
}

/* Fixed-time comparison of two hex digests. Lengths are not secret — they are
 * fixed by the parameters — but a mismatch must not throw out of
 * timingSafeEqual. */
function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

interface VerifyResult {
  valid: boolean;
  /* True when the stored hash used an algorithm or parameters weaker than the
   * current ones. The caller has the plaintext at that moment and nowhere
   * else, so this is the only opportunity to upgrade it. */
  needsRehash: boolean;
}

export async function verifyPassword(password: string, stored: string): Promise<VerifyResult> {
  if (!stored) return { valid: false, needsRehash: false };

  if (stored.startsWith("scrypt$")) {
    const [, nRaw, rRaw, pRaw, saltHex, keyHex] = stored.split("$");
    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);

    if (!N || !r || !p || !saltHex || !keyHex) return { valid: false, needsRehash: false };

    const derived = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(
        password,
        Buffer.from(saltHex, "hex"),
        keyHex.length / 2,
        { N, r, p, maxmem: SCRYPT_MAXMEM },
        (err, key) => (err ? reject(err) : resolve(key)),
      );
    }).catch(() => null);

    if (!derived) return { valid: false, needsRehash: false };

    const valid = digestsMatch(derived.toString("hex"), keyHex);

    /* Verified against parameters weaker than today's defaults — upgrade it. */
    const stale = N < SCRYPT_N || r < SCRYPT_R || p < SCRYPT_P;
    return { valid, needsRehash: valid && stale };
  }

  /* Legacy PBKDF2: "<saltHex>:<keyHex>". */
  const [salt, key] = stored.split(":");
  if (!salt || !key) return { valid: false, needsRehash: false };

  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      LEGACY_PBKDF2_ITERATIONS,
      LEGACY_PBKDF2_KEYLEN,
      LEGACY_PBKDF2_DIGEST,
      (err, derivedKey) => (err ? reject(err) : resolve(derivedKey)),
    );
  }).catch(() => null);

  if (!derived) return { valid: false, needsRehash: false };

  const valid = digestsMatch(derived.toString("hex"), key);
  return { valid, needsRehash: valid };
}

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 200;

const COMMON_PASSWORDS = new Set([
  "123456789012",
  "changeme1234",
  "password1234",
  "qwertyuiop12",
  "administrator",
  "letmein12345",
  "welcome12345",
  "iloveyou1234",
  "password123!",
  "canvasflow123",
]);

export function validatePassword(password: unknown, email?: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  }

  if (password.trim().length < MIN_PASSWORD_LENGTH) {
    return "Password cannot be mostly whitespace";
  }

  const lowered = password.toLowerCase();

  if (COMMON_PASSWORDS.has(lowered)) {
    return "That password is too common — choose something less predictable";
  }

  /* A single repeated character reaches any length requirement without adding
   * any real difficulty. */
  if (new Set(password).size <= 2) {
    return "Password must use more than a couple of distinct characters";
  }

  if (typeof email === "string" && email.includes("@")) {
    const localPart = email.split("@")[0]?.toLowerCase();
    if (localPart && localPart.length >= 4 && lowered.includes(localPart)) {
      return "Password must not contain your email address";
    }
  }

  return null;
}

let dummyPasswordHashPromise: Promise<string> | null = null;

function dummyPasswordHash(): Promise<string> {
  /* Lazy, so importing this module does not spend ~100ms of scrypt on a hash
   * that a process may never need — the OpenAPI generator and the type-only
   * consumers among them. Memoised, so the cost is paid at most once. */
  dummyPasswordHashPromise ??= hashPassword(crypto.randomBytes(32).toString("hex"));
  return dummyPasswordHashPromise;
}

async function burnPasswordVerification(password: string): Promise<void> {
  try {
    /* Uses the same scrypt parameters as a real verification, so the cost is
     * genuinely equivalent and not merely similar. */
    await verifyPassword(password, await dummyPasswordHash());
  } catch {
  }
}

// OAuth helper for Google / GitHub
/* Raised when a provider asserts an address that already belongs to a
 * CanvasFlow user but has not been verified by that provider. */
class UnverifiedOAuthEmailError extends Error {
  constructor(provider: string) {
    super(
      `Your ${provider} account's email address is not verified, and an account ` +
        `already exists with that address. Verify it with ${provider}, or sign in ` +
        `with your password instead.`,
    );
    this.name = "UnverifiedOAuthEmailError";
  }
}

/* ── OAuth identity linking ────────────────────────────────────────────────
 *
 * This used to look up an existing user by email and link the new provider
 * account to it with no check that the provider had verified that address.
 * Email is being used here as proof of identity, so an unverified assertion
 * from a provider was enough to take over the matching CanvasFlow account.
 *
 * Linking to an existing user now requires a verified address. An unverified
 * one can still create a *new* account — there is nothing to take over in that
 * case — but it can never attach itself to one that already exists.
 */
async function findOrCreateOAuthUser(info: {
  email: string;
  name: string;
  image: string | null;
  provider: string;
  providerAccountId: string;
  emailVerified: boolean;
}): Promise<SelectUser> {
  // 1. Check if account already exists
  const existingAccounts = await db
    .select()
    .from(accountsTable)
    .where(
      and(
        eq(accountsTable.providerId, info.provider),
        eq(accountsTable.accountId, info.providerAccountId)
      )
    );
  const existingAccount = existingAccounts[0];

  if (existingAccount) {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, existingAccount.userId));
    if (users[0]) return users[0];
  }

  // 2. Check if user with email exists
  const usersByEmail = await db.select().from(usersTable).where(eq(usersTable.email, info.email));
  let user = usersByEmail[0];

  if (user && !info.emailVerified) {
    /* The dangerous case: an unverified address matching an existing account.
     * Refuse rather than link. */
    throw new UnverifiedOAuthEmailError(info.provider);
  }

  if (!user) {
    // Create new user
    const userId = crypto.randomUUID();
    const insertedUsers = await db.insert(usersTable).values({
      id: userId,
      email: info.email,
      name: info.name || "",
      image: info.image || null,
      /* Reflects what the provider actually asserted. It used to be hardcoded
       * true for every OAuth signup regardless. */
      emailVerified: info.emailVerified,
    }).returning();
    user = insertedUsers[0];
  }

  if (!user) {
    throw new Error("Failed to find or create user");
  }

  // 3. Create link account record
  await db.insert(accountsTable).values({
    id: crypto.randomUUID(),
    userId: user.id,
    accountId: info.providerAccountId,
    providerId: info.provider,
  });

  return user;
}

const OAUTH_STATE_COOKIE = "cf_oauth_state";
const OAUTH_REDIRECT_COOKIE = "cf_oauth_redirect";
const OAUTH_FLOW_MAX_AGE_MS = 10 * 60 * 1000;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/* Where the browser goes when no valid destination survives validation. */
function defaultWebOrigin(): string {
  return trimTrailingSlash(process.env.WEB_URL || "http://localhost:3000");
}

function allowedRedirectOrigins(): Set<string> {
  const candidates = [
    process.env.WEB_URL,
    ...(process.env.TRUSTED_ORIGINS || "").split(","),
  ];

  const origins = new Set<string>();

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      /* Not a URL. Ignore it rather than letting a malformed entry widen or
       * break the allow-list. */
    }
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:3001");
  }

  return origins;
}

export function safeRedirectTarget(raw: unknown): string {
  const fallback = `${defaultWebOrigin()}/dashboard`;

  if (typeof raw !== "string") return fallback;

  const value = raw.trim();
  if (!value) return fallback;

  /* CR/LF or a NUL in a Location header is a response-splitting attempt. */
  if (/[\r\n\0]/.test(value)) return fallback;

  if (value.startsWith("/")) {
    if (value[1] === "/" || value[1] === "\\") return fallback;
    try {
      return new URL(value, defaultWebOrigin()).toString();
    } catch {
      return fallback;
    }
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fallback;
    if (!allowedRedirectOrigins().has(parsed.origin)) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function oauthCookieOptions() {
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: OAUTH_FLOW_MAX_AGE_MS,
    path: "/api/auth",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}

function beginOAuthFlow(res: express.Response, requestedRedirect: unknown): string {
  const nonce = crypto.randomBytes(32).toString("base64url");
  const target = safeRedirectTarget(requestedRedirect);

  res.cookie(OAUTH_STATE_COOKIE, nonce, oauthCookieOptions());
  res.cookie(OAUTH_REDIRECT_COOKIE, target, oauthCookieOptions());

  return nonce;
}

function clearOAuthCookies(res: express.Response): void {
  const { maxAge: _maxAge, ...rest } = oauthCookieOptions();
  res.clearCookie(OAUTH_STATE_COOKIE, rest);
  res.clearCookie(OAUTH_REDIRECT_COOKIE, rest);
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function consumeOAuthFlow(
  req: express.Request,
  res: express.Response,
  stateFromProvider: unknown,
): string | null {
  const cookies = parseCookies(req.headers.cookie || "");
  const expected = cookies[OAUTH_STATE_COOKIE];
  const storedRedirect = cookies[OAUTH_REDIRECT_COOKIE];

  clearOAuthCookies(res);

  if (!expected || typeof stateFromProvider !== "string") return null;
  if (!constantTimeEquals(expected, stateFromProvider)) return null;

  return safeRedirectTarget(storedRedirect);
}

function oauthFailureRedirect(reason: string): string {
  return `${defaultWebOrigin()}/signIn?error=${encodeURIComponent(reason)}`;
}


/* ── Server-side sessions ──────────────────────────────────────────────────
 *
 * Sessions were stateless 7-day JWTs. `handleSignout` cleared the cookie and
 * nothing else, so the token itself stayed valid for the remainder of its life
 * — there was no "sign out everywhere", and the only response to a stolen
 * token was rotating JWT_SECRET, which signs every user out at once.
 *
 * Each token now carries a `sid` naming a row in `sessions` (a table that
 * already existed in the schema, with the right indexes, and was never used).
 * Verification requires that row to exist and still be current, so deleting it
 * revokes the token immediately.
 *
 * Two costs are worth stating plainly:
 *
 *   1. One indexed primary-key read is added to every authenticated request.
 *      That is the price of revocability without a refresh-token flow.
 *
 *   2. Tokens minted before this change carry no `sid` and are rejected, so
 *      deploying it signs existing users out once. A grace period was
 *      considered and rejected: it would leave a window of exactly the tokens
 *      this change exists to be able to revoke.
 *
 * apps/menti verifies the same tokens and has no Postgres access, so a
 * revocation is also published to a short-lived Redis denylist that it checks.
 * Redis is already a hard requirement for both services.
 */

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/* Deliberately not built with menti's redisKey(), which inserts a "menti"
 * segment. This key is shared between the two services, so both construct it
 * from the bare prefix — see sharedRedisKey in apps/menti/src/core/env/env.js. */
function revocationKey(sessionId: string): string {
  return redisKey("auth", "revoked", sessionId);
}

/* Best-effort: the Postgres row is the authority, and this only exists so
 * menti stops honouring the token too. A Redis failure must not prevent a
 * sign-out from succeeding, so it is logged rather than thrown. */
async function publishRevocation(sessionId: string, expiresAt: Date): Promise<void> {
  if (!isRedisConfigured()) return;

  /* TTL matches the token's own remaining life. Past that the JWT `exp` check
   * rejects it anyway, so the entry has nothing left to say. */
  const remainingMs = expiresAt.getTime() - Date.now();
  if (remainingMs <= 0) return;

  try {
    const client = await redisReady();
    if (!client) return;
    await client.set(revocationKey(sessionId), "1", "PX", Math.ceil(remainingMs));
  } catch (err) {
    console.warn(
      `[auth] could not publish revocation for session ${sessionId}: ` +
        `${err instanceof Error ? err.message : err}`,
    );
  }
}

interface IssuedSession {
  token: string;
  sessionId: string;
  expiresAt: Date;
}

/* Mints a token and the row that backs it. */
async function issueSession(
  user: { id: string; email: string; name: string },
  req: express.Request,
): Promise<IssuedSession> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, sid: sessionId },
    authSecret(),
    { expiresIn: "7d" },
  );

  await db.insert(sessionsTable).values({
    id: sessionId,
    userId: user.id,
    /* The raw token is never stored — a leaked `sessions` table would
     * otherwise be a set of usable bearer credentials. The hash is enough to
     * satisfy the column's unique constraint and to look a session up by
     * token if that is ever needed. */
    token: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt,
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  /* Opportunistic cleanup of this user's expired rows, so the table does not
   * grow without bound. Cheap: covered by sessions_user_id_idx, and it runs
   * only on the comparatively rare sign-in path. */
  db.delete(sessionsTable)
    .where(and(eq(sessionsTable.userId, user.id), lt(sessionsTable.expiresAt, new Date())))
    .catch(() => {
      /* Housekeeping only — never worth failing a sign-in over. */
    });

  return { token, sessionId, expiresAt };
}

/* True when the session behind this token is still live. */
async function sessionIsActive(sessionId: unknown): Promise<boolean> {
  if (typeof sessionId !== "string" || !sessionId) return false;

  const rows = await db
    .select({ expiresAt: sessionsTable.expiresAt })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);

  const row = rows[0];
  if (!row) return false;

  return row.expiresAt.getTime() > Date.now();
}

/* Revokes one session. */
async function revokeSession(sessionId: string): Promise<void> {
  const rows = await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .returning({ expiresAt: sessionsTable.expiresAt });

  const row = rows[0];
  if (row) await publishRevocation(sessionId, row.expiresAt);
}

/* Revokes every session belonging to a user — "sign out everywhere", and the
 * response to a compromised account. */
async function revokeAllSessionsForUser(userId: string): Promise<number> {
  const rows = await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .returning({ id: sessionsTable.id, expiresAt: sessionsTable.expiresAt });

  await Promise.allSettled(rows.map((row) => publishRevocation(row.id, row.expiresAt)));

  return rows.length;
}

export const authRouter = Router();

authRouter.use(express.json());

// Helper for cookie options
const getCookieOptions = () => {
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
};

/* One place that knows where a bearer token can arrive from. The same three
 * lines were repeated in /get-session, auth.api.getSession, and now sign-out. */
function readSessionToken(req: express.Request): string | undefined {
  const cookies = parseCookies(req.headers.cookie || "");
  const authHeader = req.headers.authorization || "";

  if (cookies["cf_jwt"]) return cookies["cf_jwt"];
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);
  return undefined;
}

/* Clearing options must match the setting options exactly or the browser keeps
 * the cookie, so both sign-out paths go through this. */
function clearSessionCookies(res: express.Response): void {
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

  res.clearCookie("cf_jwt", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
  res.clearCookie("cf_session", {
    secure: true,
    sameSite: "none",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
}

const getSessionCookieOptions = () => {
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  return {
    secure: true,
    sameSite: "none" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
};

// Signup
const handleSignup = async (req: express.Request, res: express.Response) => {
  const { email, password, name, fullName } = req.body;
  const userName = name || fullName;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }

  const passwordProblem = validatePassword(password, email);
  if (passwordProblem) {
    res.status(400).json({ error: passwordProblem });
    return;
  }

  try {
    const existingUsers = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existingUsers.length > 0) {
      res.status(400).json({ error: "User already exists" });
      return;
    }

    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID();

    await db.insert(usersTable).values({
      id: userId,
      email: email,
      name: userName || "",
      emailVerified: false,
    });

    await db.insert(accountsTable).values({
      id: crypto.randomUUID(),
      userId: userId,
      accountId: email,
      providerId: "credential",
      password: hashedPassword,
    });

    const { token } = await issueSession(
      { id: userId, email, name: userName || "" },
      req,
    );

    res.cookie("cf_jwt", token, getCookieOptions());
    res.cookie("cf_session", "1", getSessionCookieOptions());

    res.json({ status: "success", user: { id: userId, email, name: userName } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to sign up" });
  }
};

authRouter.post("/signup/email", handleSignup);
authRouter.post("/sign-up/email", handleSignup);

// Signin
const handleSignin = async (req: express.Request, res: express.Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
    const user = users[0];
    if (!user) {
      /* Spend the same time a real verification would — see
       * burnPasswordVerification. */
      await burnPasswordVerification(password);
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    const accounts = await db.select().from(accountsTable).where(
      and(
        eq(accountsTable.userId, user.id),
        eq(accountsTable.providerId, "credential")
      )
    );
    const account = accounts[0];
    if (!account || !account.password) {
      /* The address exists but signed up through a social provider. Same
       * message and same cost as an unknown address, so this does not reveal
       * which accounts exist or how they were created. */
      await burnPasswordVerification(password);
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    const { valid, needsRehash } = await verifyPassword(password, account.password);
    if (!valid) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    /* Transparent upgrade. This is the only moment the plaintext is available,
     * so a hash left on the old algorithm here stays on it forever. Awaited
     * rather than fire-and-forget so a failure is logged rather than lost, but
     * a failure must not cost the user their sign-in — they authenticated
     * correctly, and the old hash still works. */
    if (needsRehash) {
      try {
        await db
          .update(accountsTable)
          .set({ password: await hashPassword(password), updatedAt: new Date() })
          .where(eq(accountsTable.id, account.id));
      } catch (rehashErr) {
        console.warn(
          `[auth] password rehash failed for account ${account.id}: ` +
            `${rehashErr instanceof Error ? rehashErr.message : rehashErr}`,
        );
      }
    }

    const { token } = await issueSession(
      { id: user.id, email: user.email, name: user.name },
      req,
    );

    res.cookie("cf_jwt", token, getCookieOptions());
    res.cookie("cf_session", "1", getSessionCookieOptions());

    res.json({ status: "success", user: { id: user.id, email: user.email, name: user.name } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to sign in" });
  }
};

authRouter.post("/signin/email", handleSignin);
authRouter.post("/sign-in/email", handleSignin);

// Signout
const handleSignout = async (req: express.Request, res: express.Response) => {
  /* Clearing the cookie is not revocation — the bearer token is still valid
   * until it expires, and anyone holding a copy keeps using it. Delete the
   * row too, which is what actually ends the session. */
  const token = readSessionToken(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, authSecret()) as any;
      if (typeof decoded?.sid === "string") {
        const all = req.body?.allDevices === true || req.query.allDevices === "true";
        if (all && typeof decoded.id === "string") {
          await revokeAllSessionsForUser(decoded.id);
        } else {
          await revokeSession(decoded.sid);
        }
      }
    } catch {
      /* Expired or unparseable: there is nothing to revoke, and the cookies
       * are cleared below regardless. Signing out must always succeed. */
    }
  }

  clearSessionCookies(res);
  res.json({ status: "success" });
};

authRouter.post("/signout", (req, res) => void handleSignout(req, res));
authRouter.post("/sign-out", (req, res) => void handleSignout(req, res));

/* Explicit "sign out everywhere". Also the remediation path for a token the
 * user believes has been stolen — previously there was none short of rotating
 * JWT_SECRET, which signs out every user of the product at once. */
const handleSignoutAll = async (req: express.Request, res: express.Response) => {
  const token = readSessionToken(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, authSecret()) as any;
      if (typeof decoded?.id === "string") await revokeAllSessionsForUser(decoded.id);
    } catch {
      /* Nothing to revoke. */
    }
  }

  clearSessionCookies(res);
  res.json({ status: "success" });
};

authRouter.post("/signout-all", (req, res) => void handleSignoutAll(req, res));
authRouter.post("/sign-out-all", (req, res) => void handleSignoutAll(req, res));

// Get Session
authRouter.get("/get-session", async (req, res) => {
  const token = readSessionToken(req);

  if (!token) {
    res.json({ session: null, user: null });
    return;
  }

  try {
    const secret = authSecret();
    const decoded = jwt.verify(token, secret) as any;

    /* A valid signature is no longer sufficient — the session behind it must
     * still exist. This is what makes sign-out and "sign out everywhere"
     * actually take effect. */
    if (!(await sessionIsActive(decoded.sid))) {
      res.json({ session: null, user: null });
      return;
    }

    res.json({
      session: {
        id: decoded.sid,
        userId: decoded.id,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
      },
      user: {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        image: decoded.image || null,
      },
    });
  } catch (err) {
    res.json({ session: null, user: null });
  }
});

// Providers endpoint (matches existing setup)
authRouter.get("/providers", (req, res) => {
  const providers = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.push("google");
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) providers.push("github");
  res.json({ providers, baseURL: process.env.BETTER_AUTH_URL || "not set" });
});

// Social Login Initialization
const handleSocialLogin = (provider: "google" | "github") => {
  return (req: express.Request, res: express.Response) => {
    const baseUrl = process.env.BASE_URL || "https://api.canvasflow.devclubxnst.online";
    const callbackUrl = `${baseUrl}/api/auth/callback/${provider}`;

    /* `state` is a nonce, not the destination. The destination is validated
     * here and stored in a cookie — see beginOAuthFlow. */
    const state = beginOAuthFlow(res, req.query.redirect ?? req.query.callbackURL);

    if (provider === "google") {
      const googleUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: callbackUrl,
        response_type: "code",
        scope: "openid email profile",
        state,
      }).toString();
      res.redirect(googleUrl);
    } else {
      const githubUrl = "https://github.com/login/oauth/authorize?" + new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID!,
        redirect_uri: callbackUrl,
        scope: "user:email",
        state,
      }).toString();
      res.redirect(githubUrl);
    }
  };
};

authRouter.get("/login/google", handleSocialLogin("google"));
authRouter.get("/login/github", handleSocialLogin("github"));

// Unified Better Auth compatibility endpoints
authRouter.get("/login/social", (req, res) => {
  const provider = req.query.provider as string;

  if (provider === "google" || provider === "github") {
    const baseUrl = process.env.BASE_URL || "https://api.canvasflow.devclubxnst.online";
    const callbackUrl = `${baseUrl}/api/auth/callback/${provider}`;

    const state = beginOAuthFlow(res, req.query.callbackURL ?? req.query.redirect);

    const redirectUrl = provider === "google"
      ? "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          redirect_uri: callbackUrl,
          response_type: "code",
          scope: "openid email profile",
          state,
        }).toString()
      : "https://github.com/login/oauth/authorize?" + new URLSearchParams({
          client_id: process.env.GITHUB_CLIENT_ID!,
          redirect_uri: callbackUrl,
          scope: "user:email",
          state,
        }).toString();
    res.redirect(redirectUrl);
  } else {
    res.status(400).send("Unsupported provider");
  }
});

// Google Callback
authRouter.get("/callback/google", async (req, res) => {
  const code = req.query.code as string;

  /* Ties this callback to the browser that started the flow and yields the
   * validated destination. Checked before the code is exchanged so a replayed
   * or forged callback costs nothing. */
  const redirectTo = consumeOAuthFlow(req, res, req.query.state);
  if (!redirectTo) {
    res.redirect(oauthFailureRedirect("oauth_state_mismatch"));
    return;
  }

  if (!code) {
    res.redirect(oauthFailureRedirect("oauth_code_missing"));
    return;
  }

  try {
    const baseUrl = process.env.BASE_URL || "https://api.canvasflow.devclubxnst.online";
    const callbackUrl = `${baseUrl}/api/auth/callback/google`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      res.status(400).send("Failed to exchange authorization code for Google tokens");
      return;
    }

    const { access_token } = await tokenRes.json() as any;
    const userRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userRes.ok) {
      res.status(400).send("Failed to fetch Google user info");
      return;
    }

    const googleUser = await userRes.json() as any;

    if (!googleUser.email) {
      res.redirect(oauthFailureRedirect("oauth_email_missing"));
      return;
    }

    const user = await findOrCreateOAuthUser({
      email: googleUser.email,
      name: googleUser.name,
      image: googleUser.picture,
      provider: "google",
      providerAccountId: googleUser.sub,
      /* Google reports this on the userinfo endpoint. It was previously
       * ignored entirely, and every Google signup was recorded as verified. */
      emailVerified: googleUser.email_verified === true,
    });

    const { token } = await issueSession(
      { id: user.id, email: user.email, name: user.name },
      req,
    );

    res.cookie("cf_jwt", token, getCookieOptions());
    res.cookie("cf_session", "1", getSessionCookieOptions());

    res.redirect(redirectTo);
  } catch (err: any) {
    /* A refused link is a user-facing outcome, not a server fault: send them
     * back to sign-in with a reason the page can explain. */
    if (err instanceof UnverifiedOAuthEmailError) {
      res.redirect(oauthFailureRedirect("oauth_email_unverified"));
      return;
    }
    res.status(500).send(err.message || "Failed to process Google OAuth callback");
  }
});

// GitHub Callback
authRouter.get("/callback/github", async (req, res) => {
  const code = req.query.code as string;

  const redirectTo = consumeOAuthFlow(req, res, req.query.state);
  if (!redirectTo) {
    res.redirect(oauthFailureRedirect("oauth_state_mismatch"));
    return;
  }

  if (!code) {
    res.redirect(oauthFailureRedirect("oauth_code_missing"));
    return;
  }

  try {
    const baseUrl = process.env.BASE_URL || "https://api.canvasflow.devclubxnst.online";
    const callbackUrl = `${baseUrl}/api/auth/callback/github`;
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok) {
      res.status(400).send("Failed to exchange authorization code for GitHub token");
      return;
    }

    const { access_token } = await tokenRes.json() as any;
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "User-Agent": "CanvasFlow-API"
      },
    });

    if (!userRes.ok) {
      res.status(400).send("Failed to fetch GitHub profile");
      return;
    }

    const githubUser = await userRes.json() as any;

    /* The address on the public profile carries no verification status, so it
     * cannot be trusted for identity — the previous code used it directly when
     * present, and fell back to `emails[0]` regardless of its `verified` flag
     * when it was not. Always ask /user/emails, and only accept an entry
     * GitHub itself reports as verified. */
    let email: string | undefined;
    let emailVerified = false;

    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "User-Agent": "CanvasFlow-API"
      },
    });

    if (emailsRes.ok) {
      const emails = await emailsRes.json() as any[];

      /* Prefer the verified primary, then any verified address. */
      const verified =
        emails.find((e: any) => e.primary && e.verified) ??
        emails.find((e: any) => e.verified);

      if (verified) {
        email = verified.email;
        emailVerified = true;
      } else {
        /* Nothing verified. Still usable for a brand-new account, which
         * findOrCreateOAuthUser allows, but it will refuse to attach to an
         * existing one. */
        const fallback = emails.find((e: any) => e.primary) ?? emails[0];
        email = fallback?.email ?? githubUser.email ?? undefined;
      }
    } else {
      email = githubUser.email ?? undefined;
    }

    if (!email) {
      res.redirect(oauthFailureRedirect("oauth_email_missing"));
      return;
    }

    const user = await findOrCreateOAuthUser({
      email,
      name: githubUser.name || githubUser.login,
      image: githubUser.avatar_url,
      provider: "github",
      providerAccountId: githubUser.id.toString(),
      emailVerified,
    });

    const { token } = await issueSession(
      { id: user.id, email: user.email, name: user.name },
      req,
    );

    res.cookie("cf_jwt", token, getCookieOptions());
    res.cookie("cf_session", "1", getSessionCookieOptions());

    res.redirect(redirectTo);
  } catch (err: any) {
    /* A refused link is a user-facing outcome, not a server fault: send them
     * back to sign-in with a reason the page can explain. */
    if (err instanceof UnverifiedOAuthEmailError) {
      res.redirect(oauthFailureRedirect("oauth_email_unverified"));
      return;
    }
    res.status(500).send(err.message || "Failed to process GitHub OAuth callback");
  }
});

// Mock Auth object matching better-auth signature for compatibility
export const auth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const cookieHeader = headers.get("cookie") || "";
      const authHeader = headers.get("authorization") || "";

      const cookies = parseCookies(cookieHeader);
      let token = cookies["cf_jwt"];
      if (!token && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }

      if (!token) return null;

      try {
        const secret = authSecret();
        const decoded = jwt.verify(token, secret) as any;
        if (!decoded || !decoded.id) return null;

        /* The revocation check for every authenticated tRPC procedure, since
         * authenticatedProcedure resolves its user through here. A token whose
         * session row is gone is no longer a session.
         *
         * Tokens minted before server-side sessions existed have no `sid` and
         * fail this check, so deploying signs those users out once — see the
         * note on the session layer above. */
        if (!(await sessionIsActive(decoded.sid))) return null;

        return {
          session: {
            id: decoded.sid,
            userId: decoded.id,
            expiresAt: new Date(decoded.exp * 1000),
          },
          user: {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            image: decoded.image || null,
          },
        };
      } catch (err) {
        return null;
      }
    }
  }
};

export type Auth = typeof auth;
export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;
