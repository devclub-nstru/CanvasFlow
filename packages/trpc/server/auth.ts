import express, { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "@repo/database";
import {
  eq,
  and,
  lt,
  usersTable,
  accountsTable,
  sessionsTable,
  verificationsTable,
  pendingSignupsTable,
  SelectUser,
} from "@repo/database";
import type { UserRole } from "@repo/database/models/auth";
import { isRedisConfigured, redisKey, redisReady } from "@repo/redis";
import { sendMail, passwordResetMail, signupCodeMail, isMailConfigured } from "@repo/services/mail";
import { recordSignup } from "@repo/observability";

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

const SCRYPT_N = 32768; // 2^15 — CPU/memory cost
const SCRYPT_R = 8; // block size
const SCRYPT_P = 1; // parallelisation
const SCRYPT_KEYLEN = 64;

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
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("hex"), key.toString("hex")].join(
    "$",
  );
}

function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

interface VerifyResult {
  valid: boolean;
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
  dummyPasswordHashPromise ??= hashPassword(crypto.randomBytes(32).toString("hex"));
  return dummyPasswordHashPromise;
}

async function burnPasswordVerification(password: string): Promise<void> {
  try {
    await verifyPassword(password, await dummyPasswordHash());
  } catch {}
}

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

class SuspendedAccountError extends Error {
  readonly reason: string | null;

  constructor(reason: string | null) {
    super("This account is suspended.");
    this.name = "SuspendedAccountError";
    this.reason = reason;
  }
}

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
        eq(accountsTable.accountId, info.providerAccountId),
      ),
    );
  const existingAccount = existingAccounts[0];

  if (existingAccount) {
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, existingAccount.userId));
    if (users[0]?.suspendedAt) throw new SuspendedAccountError(users[0].suspendedReason);
    if (users[0]) return users[0];
  }

  // 2. Check if user with email exists
  const usersByEmail = await db.select().from(usersTable).where(eq(usersTable.email, info.email));
  let user = usersByEmail[0];

  if (user?.suspendedAt) throw new SuspendedAccountError(user.suspendedReason);

  if (user && !info.emailVerified) {
    throw new UnverifiedOAuthEmailError(info.provider);
  }

  if (!user) {
    // Create new user
    const userId = crypto.randomUUID();
    const insertedUsers = await db
      .insert(usersTable)
      .values({
        id: userId,
        email: info.email,
        name: info.name || "",
        image: info.image || null,
        emailVerified: info.emailVerified,
      })
      .returning();
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

function apiBaseUrl(): string {
  return trimTrailingSlash(process.env.BASE_URL || "https://api.canvasflow.devclubxnst.online");
}

let warnedAboutWebOrigin = false;

function defaultWebOrigin(): string {
  const configured = process.env.WEB_URL?.trim();

  if (!configured) {
    if (process.env.NODE_ENV === "production" && !warnedAboutWebOrigin) {
      warnedAboutWebOrigin = true;
      console.error(
        "[auth] WEB_URL is not set. Password-reset and email-confirmation links " +
          "are being built against http://localhost:3000 and will not work for " +
          "anyone. Set WEB_URL to the web app's public origin.",
      );
    }
    return "http://localhost:3000";
  }

  return trimTrailingSlash(configured);
}

function allowedRedirectOrigins(): Set<string> {
  const candidates = [process.env.WEB_URL, ...(process.env.TRUSTED_ORIGINS || "").split(",")];

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

const AUTH_NOTICE_MAX_AGE_MS = 2 * 60 * 1000;

function setAuthNotice(res: express.Response, message: string): void {
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  res.cookie("cf_auth_notice", message, {
    maxAge: AUTH_NOTICE_MAX_AGE_MS,
    secure: true,
    sameSite: "none" as const,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
}

function oauthFailureRedirect(reason: string): string {
  return `${defaultWebOrigin()}/signIn?error=${encodeURIComponent(reason)}`;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function revocationKey(sessionId: string): string {
  return redisKey("auth", "revoked", sessionId);
}

async function publishRevocation(sessionId: string, expiresAt: Date): Promise<void> {
  if (!isRedisConfigured()) return;
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
    token: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt,
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  db.delete(sessionsTable)
    .where(and(eq(sessionsTable.userId, user.id), lt(sessionsTable.expiresAt, new Date())))
    .catch(() => {
      /* Housekeeping only — never worth failing a sign-in over. */
    });

  return { token, sessionId, expiresAt };
}

/* How stale `last_seen_at` is allowed to get before it is rewritten.
 *
 * resolveActiveSession runs on every authenticated request, so writing each
 * time would add a row update to every API call in the app just to move a
 * timestamp by milliseconds. An hour is plenty for daily/weekly/monthly counts
 * and turns this into roughly one write per active user per hour. */
const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000;

function touchLastSeen(userId: string, current: Date | null): void {
  if (current && Date.now() - current.getTime() < LAST_SEEN_REFRESH_MS) return;

  /* Not awaited: whether a session is valid does not depend on this, and a
   * failed bookkeeping write must never turn into a failed request. */
  db.update(usersTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(usersTable.id, userId))
    .catch(() => {
      /* Best effort — a missed tick costs one user one hour of presence. */
    });
}

async function resolveActiveSession(
  sessionId: unknown,
): Promise<{ userId: string; role: UserRole } | null> {
  if (typeof sessionId !== "string" || !sessionId) return null;

  const rows = await db
    .select({
      expiresAt: sessionsTable.expiresAt,
      userId: sessionsTable.userId,
      role: usersTable.role,
      suspendedAt: usersTable.suspendedAt,
      lastSeenAt: usersTable.lastSeenAt,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;

  if (row.suspendedAt) return null;

  touchLastSeen(row.userId, row.lastSeenAt);

  return { userId: row.userId, role: row.role };
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

export async function revokeAllSessionsForUser(userId: string): Promise<number> {
  const rows = await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .returning({ id: sessionsTable.id, expiresAt: sessionsTable.expiresAt });

  await Promise.allSettled(rows.map((row) => publishRevocation(row.id, row.expiresAt)));

  return rows.length;
}

type VerificationPurpose = "password-reset";

const RESET_TTL_MS = 60 * 60 * 1000;

function verificationIdentifier(purpose: VerificationPurpose, userId: string): string {
  return `${purpose}:${userId}`;
}

function hashVerificationToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function issueVerificationToken(
  purpose: VerificationPurpose,
  userId: string,
  ttlMs: number,
): Promise<string> {
  const identifier = verificationIdentifier(purpose, userId);

  await db.delete(verificationsTable).where(eq(verificationsTable.identifier, identifier));

  const raw = crypto.randomBytes(32).toString("base64url");
  const now = new Date();

  await db.insert(verificationsTable).values({
    id: crypto.randomUUID(),
    identifier,
    value: hashVerificationToken(raw),
    expiresAt: new Date(now.getTime() + ttlMs),
    createdAt: now,
    updatedAt: now,
  });

  return raw;
}

async function consumeVerificationToken(
  purpose: VerificationPurpose,
  raw: unknown,
): Promise<string | null> {
  if (typeof raw !== "string" || !raw) return null;

  const rows = await db
    .select({
      id: verificationsTable.id,
      identifier: verificationsTable.identifier,
      expiresAt: verificationsTable.expiresAt,
    })
    .from(verificationsTable)
    .where(eq(verificationsTable.value, hashVerificationToken(raw)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  await db.delete(verificationsTable).where(eq(verificationsTable.id, row.id));

  const prefix = `${purpose}:`;
  /* A verification token must not be redeemable as a reset token. */
  if (!row.identifier.startsWith(prefix)) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;

  return row.identifier.slice(prefix.length) || null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function dispatchMail(message: Parameters<typeof sendMail>[0]): void {
  void sendMail(message).catch(() => {});
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

function readSessionToken(req: express.Request): string | undefined {
  const cookies = parseCookies(req.headers.cookie || "");
  const authHeader = req.headers.authorization || "";

  if (cookies["cf_jwt"]) return cookies["cf_jwt"];
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);
  return undefined;
}

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


const SIGNUP_CODE_TTL_MS = 15 * 60 * 1000;
const SIGNUP_CODE_MAX_ATTEMPTS = 5;
const SIGNUP_RESEND_COOLDOWN_MS = 60 * 1000;

function generateSignupCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashSignupCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function normalizeSignupCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}

/* Step one. */
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

  const normalizedEmail = normalizeEmail(email);

  const passwordProblem = validatePassword(password, normalizedEmail);
  if (passwordProblem) {
    res.status(400).json({ error: passwordProblem });
    return;
  }

  if (!isMailConfigured() && process.env.NODE_ENV === "production") {
    console.error("[auth] signup blocked: mail transport is not configured");
    res.status(503).json({
      error: "Sign-ups are temporarily unavailable. Please try again later.",
    });
    return;
  }

  try {
    const existingUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (existingUsers.length > 0) {
      res.status(400).json({ error: "User already exists" });
      return;
    }

    const code = generateSignupCode();
    const now = new Date();
    const passwordHash = await hashPassword(password);

    await db
      .insert(pendingSignupsTable)
      .values({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        name: userName || "",
        passwordHash,
        codeHash: hashSignupCode(code),
        attempts: 0,
        expiresAt: new Date(now.getTime() + SIGNUP_CODE_TTL_MS),
        lastSentAt: now,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: pendingSignupsTable.email,
        set: {
          name: userName || "",
          passwordHash,
          codeHash: hashSignupCode(code),
          attempts: 0,
          expiresAt: new Date(now.getTime() + SIGNUP_CODE_TTL_MS),
          lastSentAt: now,
        },
      });

    dispatchMail(signupCodeMail(normalizedEmail, code, SIGNUP_CODE_TTL_MS / 60_000));
    recordSignup("started");

    res.json({
      status: "pending",
      email: normalizedEmail,
      expiresInMinutes: SIGNUP_CODE_TTL_MS / 60_000,
    });
  } catch (err: any) {
    console.error(`[auth] signup failed: ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ error: "Failed to start the sign-up" });
  }
};

/* Step two — the code is checked and the account is created here. */
const handleSignupVerify = async (req: express.Request, res: express.Response) => {
  const rawEmail = req.body?.email;
  const code = normalizeSignupCode(req.body?.code);

  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  if (!code) {
    res.status(400).json({ error: "Enter the 6-digit code from your email" });
    return;
  }

  const normalizedEmail = normalizeEmail(rawEmail);

  try {
    const rows = await db
      .select()
      .from(pendingSignupsTable)
      .where(eq(pendingSignupsTable.email, normalizedEmail))
      .limit(1);

    const pending = rows[0];

    if (!pending || pending.expiresAt.getTime() <= Date.now()) {
      if (pending) {
        await db.delete(pendingSignupsTable).where(eq(pendingSignupsTable.id, pending.id));
      }
      res.status(400).json({
        error: "That code has expired or was already used. Start the sign-up again.",
      });
      return;
    }

    if (pending.attempts >= SIGNUP_CODE_MAX_ATTEMPTS) {
      await db.delete(pendingSignupsTable).where(eq(pendingSignupsTable.id, pending.id));
      res.status(429).json({
        error: "Too many incorrect codes. Start the sign-up again.",
      });
      return;
    }

    const supplied = hashSignupCode(code);
    const expected = pending.codeHash;
    const matches =
      supplied.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));

    if (!matches) {
      const attempts = pending.attempts + 1;
      await db
        .update(pendingSignupsTable)
        .set({ attempts })
        .where(eq(pendingSignupsTable.id, pending.id));

      recordSignup("rejected");

      const remaining = SIGNUP_CODE_MAX_ATTEMPTS - attempts;
      res.status(400).json({
        error:
          remaining > 0
            ? `That code is not right. ${remaining} ${remaining === 1 ? "try" : "tries"} left.`
            : "Too many incorrect codes. Start the sign-up again.",
      });
      return;
    }

    const claimed = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (claimed.length > 0) {
      await db.delete(pendingSignupsTable).where(eq(pendingSignupsTable.id, pending.id));
      res.status(400).json({ error: "User already exists" });
      return;
    }

    const userId = crypto.randomUUID();

    await db.insert(usersTable).values({
      id: userId,
      email: normalizedEmail,
      name: pending.name || "",
      emailVerified: true,
    });

    await db.insert(accountsTable).values({
      id: crypto.randomUUID(),
      userId,
      accountId: normalizedEmail,
      providerId: "credential",
      password: pending.passwordHash,
    });

    await db.delete(pendingSignupsTable).where(eq(pendingSignupsTable.id, pending.id));

    const { token } = await issueSession(
      { id: userId, email: normalizedEmail, name: pending.name || "" },
      req,
    );

    res.cookie("cf_jwt", token, getCookieOptions());
    res.cookie("cf_session", "1", getSessionCookieOptions());

    recordSignup("verified");

    res.json({
      status: "success",
      user: { id: userId, email: normalizedEmail, name: pending.name || "" },
    });
  } catch (err: any) {
    console.error(`[auth] signup verify failed: ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ error: "Failed to confirm the code" });
  }
};

/* Resend — a new code for a signup already in progress. */
const handleSignupResend = async (req: express.Request, res: express.Response) => {
  const rawEmail = req.body?.email;

  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const normalizedEmail = normalizeEmail(rawEmail);

  const acknowledge = () =>
    res.json({
      status: "success",
      message: "If that sign-up is still open, a new code is on its way.",
    });

  try {
    const rows = await db
      .select()
      .from(pendingSignupsTable)
      .where(eq(pendingSignupsTable.email, normalizedEmail))
      .limit(1);

    const pending = rows[0];
    if (!pending || pending.expiresAt.getTime() <= Date.now()) return acknowledge();

    if (Date.now() - pending.lastSentAt.getTime() < SIGNUP_RESEND_COOLDOWN_MS) {
      return acknowledge();
    }

    const code = generateSignupCode();
    const now = new Date();

    await db
      .update(pendingSignupsTable)
      .set({
        codeHash: hashSignupCode(code),
        attempts: 0,
        expiresAt: new Date(now.getTime() + SIGNUP_CODE_TTL_MS),
        lastSentAt: now,
      })
      .where(eq(pendingSignupsTable.id, pending.id));

    dispatchMail(signupCodeMail(normalizedEmail, code, SIGNUP_CODE_TTL_MS / 60_000));

    return acknowledge();
  } catch (err) {
    console.error(`[auth] signup resend failed: ${err instanceof Error ? err.message : err}`);
    return acknowledge();
  }
};

export async function resendSignupCodeFor(
  pendingId: string,
): Promise<{ sent: boolean; reason: string | null; email: string | null }> {
  const rows = await db
    .select()
    .from(pendingSignupsTable)
    .where(eq(pendingSignupsTable.id, pendingId))
    .limit(1);

  const pending = rows[0];
  if (!pending) return { sent: false, reason: "That signup is no longer pending.", email: null };

  if (pending.expiresAt.getTime() <= Date.now()) {
    return {
      sent: false,
      reason: "That signup already expired — delete it so they can start again.",
      email: pending.email,
    };
  }

  if (Date.now() - pending.lastSentAt.getTime() < SIGNUP_RESEND_COOLDOWN_MS) {
    const wait = Math.ceil(
      (SIGNUP_RESEND_COOLDOWN_MS - (Date.now() - pending.lastSentAt.getTime())) / 1000,
    );
    return { sent: false, reason: `A code went out moments ago — try again in ${wait}s.`, email: pending.email };
  }

  const code = generateSignupCode();
  const now = new Date();

  await db
    .update(pendingSignupsTable)
    .set({
      codeHash: hashSignupCode(code),
      attempts: 0,
      expiresAt: new Date(now.getTime() + SIGNUP_CODE_TTL_MS),
      lastSentAt: now,
    })
    .where(eq(pendingSignupsTable.id, pending.id));

  dispatchMail(signupCodeMail(pending.email, code, SIGNUP_CODE_TTL_MS / 60_000));

  return { sent: true, reason: null, email: pending.email };
}

authRouter.post("/signup/email", handleSignup);
authRouter.post("/sign-up/email", handleSignup);

authRouter.post("/signup/verify", handleSignupVerify);
authRouter.post("/sign-up/verify", handleSignupVerify);

authRouter.post("/signup/resend", handleSignupResend);
authRouter.post("/sign-up/resend", handleSignupResend);

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
      await burnPasswordVerification(password);
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    const accounts = await db
      .select()
      .from(accountsTable)
      .where(and(eq(accountsTable.userId, user.id), eq(accountsTable.providerId, "credential")));
    const account = accounts[0];
    if (!account || !account.password) {
      await burnPasswordVerification(password);
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    const { valid, needsRehash } = await verifyPassword(password, account.password);
    if (!valid) {
      res.status(400).json({ error: "Invalid email or password" });
      return;
    }

    if (user.suspendedAt) {
      res.status(403).json({
        error: user.suspendedReason
          ? `This account is suspended: ${user.suspendedReason}`
          : "This account is suspended.",
        reason: user.suspendedReason ?? null,
      });
      return;
    }

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

    const { token } = await issueSession({ id: user.id, email: user.email, name: user.name }, req);

    res.cookie("cf_jwt", token, getCookieOptions());
    res.cookie("cf_session", "1", getSessionCookieOptions());

    res.json({ status: "success", user: { id: user.id, email: user.email, name: user.name } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to sign in" });
  }
};

authRouter.post("/signin/email", handleSignin);
authRouter.post("/sign-in/email", handleSignin);

export async function triggerPasswordReset(
  userId: string,
): Promise<{ sent: boolean; reason: string | null }> {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      suspendedAt: usersTable.suspendedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return { sent: false, reason: "No such account." };
  if (user.suspendedAt) {
    return { sent: false, reason: "That account is suspended — lift the suspension first." };
  }

  const credentials = await db
    .select({ id: accountsTable.id })
    .from(accountsTable)
    .where(and(eq(accountsTable.userId, user.id), eq(accountsTable.providerId, "credential")));

  if (!credentials[0]) {
    return {
      sent: false,
      reason: "They sign in with Google or GitHub — there is no password to reset.",
    };
  }

  const token = await issueVerificationToken("password-reset", user.id, RESET_TTL_MS);
  const link = `${defaultWebOrigin()}/resetPassword?token=${encodeURIComponent(token)}`;
  dispatchMail(passwordResetMail(user.email, link, RESET_TTL_MS / 60_000));

  return { sent: true, reason: null };
}

authRouter.post("/forgot-password", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";

  /* One response for every path below. */
  const acknowledge = () =>
    res.json({
      status: "success",
      message: "If an account exists for that address, a reset link is on its way.",
    });

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return acknowledge();

  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
    const user = users[0];
    if (!user) return acknowledge();

    if (user.suspendedAt) return acknowledge();

    const accounts = await db
      .select({ id: accountsTable.id })
      .from(accountsTable)
      .where(and(eq(accountsTable.userId, user.id), eq(accountsTable.providerId, "credential")));

    if (!accounts[0]) return acknowledge();

    const token = await issueVerificationToken("password-reset", user.id, RESET_TTL_MS);
    const link = `${defaultWebOrigin()}/resetPassword?token=${encodeURIComponent(token)}`;

    dispatchMail(passwordResetMail(user.email, link, RESET_TTL_MS / 60_000));

    return acknowledge();
  } catch (err) {
    console.error(`[auth] forgot-password failed: ${err instanceof Error ? err.message : err}`);
    return acknowledge();
  }
});

authRouter.post("/reset-password", async (req, res) => {
  const { token, password } = req.body ?? {};

  const problem = validatePassword(password);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }

  try {
    const userId = await consumeVerificationToken("password-reset", token);
    if (!userId) {
      res.status(400).json({
        error: "That reset link is invalid or has expired. Request a new one.",
      });
      return;
    }

    const accounts = await db
      .select({ id: accountsTable.id })
      .from(accountsTable)
      .where(and(eq(accountsTable.userId, userId), eq(accountsTable.providerId, "credential")));

    const account = accounts[0];
    if (!account) {
      res.status(400).json({ error: "That reset link is no longer valid." });
      return;
    }

    await db
      .update(accountsTable)
      .set({ password: await hashPassword(password), updatedAt: new Date() })
      .where(eq(accountsTable.id, account.id));

    await revokeAllSessionsForUser(userId);

    res.json({ status: "success", message: "Password updated. Sign in with your new password." });
  } catch (err) {
    console.error(`[auth] reset-password failed: ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ error: "Could not reset the password. Try requesting a new link." });
  }
});

// Signout
const handleSignout = async (req: express.Request, res: express.Response) => {
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

    const active = await resolveActiveSession(decoded.sid);
    if (!active) {
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
        role: active.role,
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
  res.json({ providers });
});

// Social Login Initialization
const handleSocialLogin = (provider: "google" | "github") => {
  return (req: express.Request, res: express.Response) => {
    const callbackUrl = `${apiBaseUrl()}/api/auth/callback/${provider}`;

    const state = beginOAuthFlow(res, req.query.redirect ?? req.query.callbackURL);

    if (provider === "google") {
      const googleUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          redirect_uri: callbackUrl,
          response_type: "code",
          scope: "openid email profile",
          state,
        }).toString();
      res.redirect(googleUrl);
    } else {
      const githubUrl =
        "https://github.com/login/oauth/authorize?" +
        new URLSearchParams({
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
    const callbackUrl = `${apiBaseUrl()}/api/auth/callback/${provider}`;

    const state = beginOAuthFlow(res, req.query.callbackURL ?? req.query.redirect);

    const redirectUrl =
      provider === "google"
        ? "https://accounts.google.com/o/oauth2/v2/auth?" +
          new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            redirect_uri: callbackUrl,
            response_type: "code",
            scope: "openid email profile",
            state,
          }).toString()
        : "https://github.com/login/oauth/authorize?" +
          new URLSearchParams({
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
    const callbackUrl = `${apiBaseUrl()}/api/auth/callback/google`;
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

    const { access_token } = (await tokenRes.json()) as any;
    const userRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userRes.ok) {
      res.status(400).send("Failed to fetch Google user info");
      return;
    }

    const googleUser = (await userRes.json()) as any;

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
      emailVerified: googleUser.email_verified === true,
    });

    const { token } = await issueSession({ id: user.id, email: user.email, name: user.name }, req);

    res.cookie("cf_jwt", token, getCookieOptions());
    res.cookie("cf_session", "1", getSessionCookieOptions());

    res.redirect(redirectTo);
  } catch (err: any) {
    if (err instanceof UnverifiedOAuthEmailError) {
      res.redirect(oauthFailureRedirect("oauth_email_unverified"));
      return;
    }
    if (err instanceof SuspendedAccountError) {
      if (err.reason) setAuthNotice(res, `This account is suspended: ${err.reason}`);
      res.redirect(oauthFailureRedirect("account_suspended"));
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
    const callbackUrl = `${apiBaseUrl()}/api/auth/callback/github`;
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
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

    const { access_token } = (await tokenRes.json()) as any;
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "User-Agent": "CanvasFlow-API",
      },
    });

    if (!userRes.ok) {
      res.status(400).send("Failed to fetch GitHub profile");
      return;
    }

    const githubUser = (await userRes.json()) as any;

    let email: string | undefined;
    let emailVerified = false;

    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "User-Agent": "CanvasFlow-API",
      },
    });

    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as any[];

      /* Prefer the verified primary, then any verified address. */
      const verified =
        emails.find((e: any) => e.primary && e.verified) ?? emails.find((e: any) => e.verified);

      if (verified) {
        email = verified.email;
        emailVerified = true;
      } else {
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

    const { token } = await issueSession({ id: user.id, email: user.email, name: user.name }, req);

    res.cookie("cf_jwt", token, getCookieOptions());
    res.cookie("cf_session", "1", getSessionCookieOptions());

    res.redirect(redirectTo);
  } catch (err: any) {
    if (err instanceof UnverifiedOAuthEmailError) {
      res.redirect(oauthFailureRedirect("oauth_email_unverified"));
      return;
    }
    if (err instanceof SuspendedAccountError) {
      if (err.reason) setAuthNotice(res, `This account is suspended: ${err.reason}`);
      res.redirect(oauthFailureRedirect("account_suspended"));
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

        const active = await resolveActiveSession(decoded.sid);
        if (!active) return null;

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
            role: active.role,
          },
        };
      } catch (err) {
        return null;
      }
    },
  },
};

export type Auth = typeof auth;
export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;
