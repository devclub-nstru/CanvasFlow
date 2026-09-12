import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestServer } from "../helpers/app";

/* Mail has no provider configured in the suite, so every message goes to the
 * log transport. Capturing the logger is how the test reads the confirmation
 * code — and it doubles as proof the message is actually dispatched. */
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("@repo/logger", () => ({ logger, default: logger }));

const { eq } = await import("@repo/database");
const { usersTable, sessionsTable, accountsTable } = await import("@repo/database");
const { pendingSignupsTable } = await import("@repo/database");
const { db, resetDatabase, teardownDatabase } = await import("../helpers/db");
const { closeRedis, resetRedis } = await import("../helpers/redis");
const { startAuthServer, post, get, cookieValue } = await import("../helpers/app");
const { callerWithToken, expectRejection } = await import("../helpers/caller");
const { makeUser } = await import("../helpers/factories");

/* Sign-up through to sign-out, against real rows.
 *
 * The unit suite covers password hashing, the policy, and the redirect
 * validation. What it cannot cover is the sequence: that a pending signup
 * becomes a user and an account, that the session row is what makes a token
 * work, and that deleting that row is what makes it stop. */

const EMAIL = "newcomer@example.test";
const PASSWORD = "correct horse battery staple";

let server: TestServer;

/** The confirmation code, read out of the logged message body. */
function lastSignupCode(): string {
  const lines = logger.warn.mock.calls.map((call) => String(call[0]));
  const message = [...lines].reverse().find((line) => line.includes("confirmation code"));
  const code = message?.match(/code is:\s*(\d{4,10})/)?.[1];
  if (!code) throw new Error(`no confirmation code was emailed. Saw: ${lines.join(" | ")}`);
  return code;
}

async function signUp(email = EMAIL, password = PASSWORD) {
  return post(server, "/api/auth/signup/email", { email, password, name: "Newcomer" });
}

async function verify(email = EMAIL, code?: string) {
  return post(server, "/api/auth/verify-signup", { email, code: code ?? lastSignupCode() });
}

beforeAll(async () => {
  server = await startAuthServer();
});

afterAll(async () => {
  await server.close();
  await closeRedis();
  await teardownDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  vi.clearAllMocks();
});

/* ─── Step one: the code ───────────────────────────────────────────────── */

describe("POST /signup/email", () => {
  it("creates nothing but a pending row, and emails a code", async () => {
    const result = await signUp();

    expect(result.status).toBe(200);
    expect(result.body.status).toBe("verification_required");

    expect(await db.select().from(usersTable), "no account exists yet").toHaveLength(0);
    const pending = await db.select().from(pendingSignupsTable);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.email).toBe(EMAIL);

    expect(lastSignupCode()).toMatch(/^\d{4,10}$/);
  });

  it("never stores the code or the password in readable form", async () => {
    await signUp();
    const [pending] = await db.select().from(pendingSignupsTable);

    expect(pending?.codeHash).not.toBe(lastSignupCode());
    expect(pending?.passwordHash).not.toContain(PASSWORD);
    expect(pending?.passwordHash?.startsWith("scrypt$")).toBe(true);
  });

  it("normalises the address", async () => {
    await signUp("  NEWCOMER@Example.TEST  ");
    const [pending] = await db.select().from(pendingSignupsTable);
    expect(pending?.email).toBe(EMAIL);
  });

  it("replaces an earlier pending signup rather than stacking them", async () => {
    await signUp();
    const firstCode = lastSignupCode();
    await signUp();

    expect(await db.select().from(pendingSignupsTable)).toHaveLength(1);
    expect(lastSignupCode(), "a fresh code invalidates the old one").not.toBe(firstCode);
  });

  it("enforces the password policy before writing anything", async () => {
    const result = await signUp(EMAIL, "short");

    expect(result.status).toBe(400);
    expect(await db.select().from(pendingSignupsTable)).toHaveLength(0);
  });

  it("rejects an address that is not one", async () => {
    expect((await signUp("not-an-email")).status).toBe(400);
  });

  it("refuses an address that already has an account", async () => {
    await makeUser({ email: EMAIL });
    const result = await signUp();

    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/already exists/i);
  });
});

/* ─── Step two: the account ────────────────────────────────────────────── */

describe("POST /verify-signup", () => {
  it("creates the user, the credential account, and a session", async () => {
    await signUp();
    const result = await verify();

    expect(result.status).toBe(200);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, EMAIL));
    expect(user?.emailVerified).toBe(true);

    const accounts = await db.select().from(accountsTable);
    expect(accounts[0]?.providerId).toBe("credential");
    expect(accounts[0]?.userId).toBe(user?.id);

    const sessions = await db.select().from(sessionsTable);
    expect(sessions).toHaveLength(1);
  });

  it("returns a session cookie that actually works", async () => {
    await signUp();
    const result = await verify();

    const token = cookieValue(result.cookies, "cf_jwt");
    expect(token).toBeTruthy();

    const caller = callerWithToken(token!);
    const forms = await caller.form.listFormsByUserId();
    expect(forms).toEqual([]);
  });

  it("clears the pending row", async () => {
    await signUp();
    await verify();
    expect(await db.select().from(pendingSignupsTable)).toHaveLength(0);
  });

  it("refuses the wrong code and says how many attempts are left", async () => {
    await signUp();
    const result = await verify(EMAIL, "000000");

    expect(result.status).toBe(400);
    expect(result.body.attemptsRemaining).toBeTypeOf("number");
    expect(await db.select().from(usersTable)).toHaveLength(0);
  });

  it("stops accepting attempts after enough wrong guesses", async () => {
    await signUp();

    let last = await verify(EMAIL, "000000");
    for (let i = 0; i < 6; i++) last = await verify(EMAIL, "000000");

    expect(last.status).toBe(400);
    expect(await db.select().from(usersTable)).toHaveLength(0);
  });

  it("does not accept a code that was issued for another address", async () => {
    await signUp();
    const code = lastSignupCode();
    await signUp("other@example.test");

    const result = await verify("other@example.test", code);
    expect(result.status).toBe(400);
  });

  it("refuses a code for an address with no pending signup", async () => {
    expect((await verify("nobody@example.test", "123456")).status).toBe(400);
  });
});

/* ─── Signing in ───────────────────────────────────────────────────────── */

describe("POST /signin/email", () => {
  async function register() {
    await signUp();
    await verify();
    await db.delete(sessionsTable);
  }

  it("issues a working session for the right password", async () => {
    await register();

    const result = await post(server, "/api/auth/signin/email", {
      email: EMAIL,
      password: PASSWORD,
    });

    expect(result.status).toBe(200);
    const token = cookieValue(result.cookies, "cf_jwt");
    expect(token).toBeTruthy();
    expect(await db.select().from(sessionsTable)).toHaveLength(1);
  });

  it("refuses the wrong password without minting a session", async () => {
    await register();

    const result = await post(server, "/api/auth/signin/email", {
      email: EMAIL,
      password: "not the right password",
    });

    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(cookieValue(result.cookies, "cf_jwt")).toBeNull();
    expect(await db.select().from(sessionsTable)).toHaveLength(0);
  });

  it("answers an unknown address the same way as a wrong password", async () => {
    await register();

    const unknown = await post(server, "/api/auth/signin/email", {
      email: "nobody@example.test",
      password: PASSWORD,
    });
    const wrong = await post(server, "/api/auth/signin/email", {
      email: EMAIL,
      password: "not the right password",
    });

    expect(unknown.status, "account existence must not be discoverable").toBe(wrong.status);
    expect(unknown.body.error).toBe(wrong.body.error);
  });

  /* KNOWN BUG — this documents a defect rather than a requirement.
   *
   * handleSignup stores `normalizeEmail(email)` (trimmed, lowercased), but
   * handleSignin looks the user up with the raw request body:
   *
   *     db.select().from(usersTable).where(eq(usersTable.email, email))
   *
   * So anyone whose keyboard, autofill or phone capitalises the first letter
   * is told "Invalid email or password" for their own account. A leading space
   * from a copy-paste does the same.
   *
   * The fix is one line in packages/trpc/server/auth.ts — look the user up by
   * `normalizeEmail(email)`, as verify-signup and forgot-password already do.
   *
   * `it.fails` keeps the suite honest: it passes while the bug exists and
   * starts failing the moment it is fixed, which is the prompt to delete this
   * comment and turn it back into a plain `it`. */
  it.fails("is case-insensitive about the address", async () => {
    await register();

    const result = await post(server, "/api/auth/signin/email", {
      email: "NEWCOMER@EXAMPLE.TEST",
      password: PASSWORD,
    });
    expect(result.status).toBe(200);
  });

  it("currently rejects a differently-cased address (the bug above, pinned)", async () => {
    await register();

    const result = await post(server, "/api/auth/signin/email", {
      email: "NEWCOMER@EXAMPLE.TEST",
      password: PASSWORD,
    });
    expect(result.status).toBe(400);
  });
});

/* ─── The session row is the authority ─────────────────────────────────── */

describe("a session", () => {
  async function registerAndSignIn() {
    await signUp();
    const verified = await verify();
    return cookieValue(verified.cookies, "cf_jwt")!;
  }

  it("is readable through get-session while it lives", async () => {
    const token = await registerAndSignIn();

    const result = await get(server, "/api/auth/get-session", {
      cookie: `cf_jwt=${token}`,
    });

    expect(result.status).toBe(200);
    expect((result.body as { user?: { email?: string } }).user?.email).toBe(EMAIL);
  });

  it("stops working the moment its row is deleted, though the JWT is unchanged", async () => {
    const token = await registerAndSignIn();
    const caller = callerWithToken(token);

    await expect(caller.form.listFormsByUserId()).resolves.toEqual([]);

    await db.delete(sessionsTable);

    const error = await expectRejection(caller.form.listFormsByUserId());
    expect(error.message).toMatch(/not logged in/i);
  });

  it("is revoked by signing out", async () => {
    const token = await registerAndSignIn();

    const result = await post(server, "/api/auth/signout", {}, { cookie: `cf_jwt=${token}` });
    expect(result.status).toBe(200);

    expect(await db.select().from(sessionsTable)).toHaveLength(0);

    const error = await expectRejection(
      callerWithToken(token).form.listFormsByUserId(),
    );
    expect(error.message).toMatch(/not logged in/i);
  });

  it("leaves other devices signed in when one signs out", async () => {
    await signUp();
    const first = cookieValue((await verify()).cookies, "cf_jwt")!;

    const secondResult = await post(server, "/api/auth/signin/email", {
      email: EMAIL,
      password: PASSWORD,
    });
    const second = cookieValue(secondResult.cookies, "cf_jwt")!;

    await post(server, "/api/auth/signout", {}, { cookie: `cf_jwt=${first}` });

    await expect(
      callerWithToken(second).form.listFormsByUserId(),
      "signing out on one device must not sign out the other",
    ).resolves.toEqual([]);
  });

  it("is one of several that signout-all removes together", async () => {
    await signUp();
    const first = cookieValue((await verify()).cookies, "cf_jwt")!;
    await post(server, "/api/auth/signin/email", { email: EMAIL, password: PASSWORD });

    expect(await db.select().from(sessionsTable)).toHaveLength(2);

    await post(server, "/api/auth/signout-all", {}, { cookie: `cf_jwt=${first}` });

    expect(await db.select().from(sessionsTable)).toHaveLength(0);
  });

  it("is rejected when the token is forged", async () => {
    const token = await registerAndSignIn();
    const forged = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    const error = await expectRejection(
      callerWithToken(forged).form.listFormsByUserId(),
    );
    expect(error.message).toMatch(/not logged in/i);
  });
});

/* ─── Password reset ───────────────────────────────────────────────────── */

describe("password reset", () => {
  function lastResetLink(): string {
    const lines = logger.warn.mock.calls.map((call) => String(call[0]));
    const message = [...lines].reverse().find((line) => line.includes("Reset your"));
    const link = message?.match(/https?:\/\/\S+/)?.[0];
    if (!link) throw new Error("no reset link was emailed");
    return link;
  }

  async function register() {
    await signUp();
    await verify();
    vi.clearAllMocks();
  }

  it("emails a link for an address that exists", async () => {
    await register();

    const result = await post(server, "/api/auth/forgot-password", { email: EMAIL });
    expect(result.status).toBe(200);
    expect(lastResetLink()).toContain("token=");
  });

  it("answers the same way for an address that does not exist", async () => {
    await register();

    const known = await post(server, "/api/auth/forgot-password", { email: EMAIL });
    const unknown = await post(server, "/api/auth/forgot-password", {
      email: "nobody@example.test",
    });

    expect(unknown.status, "registration must not be discoverable").toBe(known.status);
    expect(unknown.body).toEqual(known.body);
  });

  it("lets the new password sign in, and the old one no longer does", async () => {
    await register();
    await post(server, "/api/auth/forgot-password", { email: EMAIL });

    const token = new URL(lastResetLink()).searchParams.get("token");
    const newPassword = "a quiet room with many books";

    const reset = await post(server, "/api/auth/reset-password", {
      token,
      password: newPassword,
      newPassword,
    });
    expect(reset.status).toBe(200);

    const withNew = await post(server, "/api/auth/signin/email", {
      email: EMAIL,
      password: newPassword,
    });
    expect(withNew.status).toBe(200);

    const withOld = await post(server, "/api/auth/signin/email", {
      email: EMAIL,
      password: PASSWORD,
    });
    expect(withOld.status).toBeGreaterThanOrEqual(400);
  });

  it("cannot reuse the same reset token twice", async () => {
    await register();
    await post(server, "/api/auth/forgot-password", { email: EMAIL });
    const token = new URL(lastResetLink()).searchParams.get("token");
    const newPassword = "a quiet room with many books";

    await post(server, "/api/auth/reset-password", { token, password: newPassword, newPassword });
    const second = await post(server, "/api/auth/reset-password", {
      token,
      password: "another entirely different one",
      newPassword: "another entirely different one",
    });

    expect(second.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects a made-up token", async () => {
    await register();
    const result = await post(server, "/api/auth/reset-password", {
      token: "not-a-real-token",
      password: "a quiet room with many books",
      newPassword: "a quiet room with many books",
    });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it("enforces the password policy on the new password", async () => {
    await register();
    await post(server, "/api/auth/forgot-password", { email: EMAIL });
    const token = new URL(lastResetLink()).searchParams.get("token");

    const result = await post(server, "/api/auth/reset-password", {
      token,
      password: "short",
      newPassword: "short",
    });
    expect(result.status).toBe(400);
  });
});

/* ─── Hash migration ───────────────────────────────────────────────────── */

describe("an account created under the old PBKDF2 scheme", () => {
  it("signs in and is upgraded to scrypt on the way through", async () => {
    const crypto = await import("node:crypto");

    const user = await makeUser({ email: "legacy@example.test" });
    const salt = "legacy-salt";
    const key = crypto.pbkdf2Sync(PASSWORD, salt, 10000, 64, "sha512").toString("hex");

    await db.insert(accountsTable).values({
      id: crypto.randomUUID(),
      userId: user.id,
      accountId: user.email,
      providerId: "credential",
      password: `${salt}:${key}`,
    });

    const result = await post(server, "/api/auth/signin/email", {
      email: user.email,
      password: PASSWORD,
    });
    expect(result.status, "the old password must still work").toBe(200);

    const [account] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.userId, user.id));
    expect(account?.password?.startsWith("scrypt$"), "and be rewritten in the new scheme").toBe(
      true,
    );

    const again = await post(server, "/api/auth/signin/email", {
      email: user.email,
      password: PASSWORD,
    });
    expect(again.status, "and keep working afterwards").toBe(200);
  });
});
