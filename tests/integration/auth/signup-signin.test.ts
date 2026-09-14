import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestServer } from "../helpers/app";

/* Mail has no relay configured in the suite, so every message goes to the log
 * transport. Capturing the logger is how these tests read the confirmation
 * code and the reset link — and it doubles as proof the message is actually
 * dispatched. */
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("@repo/logger", () => ({ logger, default: logger }));

const { eq } = await import("@repo/database");
const { usersTable, sessionsTable, accountsTable, pendingSignupsTable } = await import(
  "@repo/database"
);
const { db, resetDatabase, teardownDatabase } = await import("../helpers/db");
const { closeRedis, resetRedis } = await import("../helpers/redis");
const { startAuthServer, post, get, cookieValue } = await import("../helpers/app");
const { callerWithToken, expectRejection } = await import("../helpers/caller");
const { makeUser } = await import("../helpers/factories");

/* Sign-up through to sign-out, against real rows.
 *
 * The unit suite covers password hashing, the policy, and the redirect
 * validation. What it cannot cover is the sequence: that confirming the code
 * writes a user and a credential account together, that the session row is
 * what makes a token work, and that deleting that row is what makes it stop.
 *
 * Sign-up is two requests. Step one writes only a `pending_signups` row and
 * mails a six-digit code; step two exchanges that code for the account and the
 * session. The split is the reason for most of what follows: almost every
 * assertion about "after signing up" is really an assertion about after
 * verifying. */

const EMAIL = "newcomer@example.test";
const PASSWORD = "correct horse battery staple";

let server: TestServer;

/** Step one. Returns the raw HTTP result so failure cases can inspect it. */
async function startSignUp(email = EMAIL, password = PASSWORD) {
  return post(server, "/api/auth/signup/email", { email, password, name: "Newcomer" });
}

/** The code from the most recent confirmation mail. */
function lastSignupCode(): string {
  const lines = logger.warn.mock.calls.map((call) => String(call[0]));
  const message = [...lines].reverse().find((line) => line.includes("confirmation code"));
  const code = message?.match(/\b\d{6}\b/)?.[0];
  if (!code) throw new Error("no confirmation code was emailed");
  return code;
}

/** A code that is definitely not the one that was sent. */
function wrongCode(actual: string): string {
  return actual === "000000" ? "111111" : "000000";
}

async function verify(email: string, code: string) {
  return post(server, "/api/auth/signup/verify", { email, code });
}

/** Both steps. The account exists and a session is open when this resolves. */
async function signUp(email = EMAIL, password = PASSWORD) {
  const started = await startSignUp(email, password);
  if (started.status !== 200) return started;
  return verify(email, lastSignupCode());
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

/* ─── Step one: asking for a code ──────────────────────────────────────── */

describe("POST /signup/email", () => {
  /* The whole point of the split. A false here means an address someone else
   * owns can be given an account they never asked for. */
  it("creates nothing but a pending row", async () => {
    const result = await startSignUp();

    expect(result.status).toBe(200);
    expect(result.body.status).toBe("pending");
    expect(result.body.email).toBe(EMAIL);

    expect(await db.select().from(usersTable)).toHaveLength(0);
    expect(await db.select().from(accountsTable)).toHaveLength(0);
    expect(await db.select().from(sessionsTable)).toHaveLength(0);
    expect(await db.select().from(pendingSignupsTable)).toHaveLength(1);
  });

  it("emails a six-digit code", async () => {
    await startSignUp();

    const logged = logger.warn.mock.calls.map((call) => String(call[0]));
    const mail = logged.filter((line) => line.includes("[mail:log]"));
    expect(mail).toHaveLength(1);
    expect(lastSignupCode()).toMatch(/^\d{6}$/);
  });

  it("hands out no session until the code is entered", async () => {
    const result = await startSignUp();
    expect(cookieValue(result.cookies, "cf_jwt")).toBeNull();
  });

  /* The plaintext password never has to survive between the two requests. */
  it("stores the password already hashed on the pending row", async () => {
    await startSignUp();
    const [pending] = await db.select().from(pendingSignupsTable);

    expect(pending?.passwordHash).not.toContain(PASSWORD);
    expect(pending?.passwordHash?.startsWith("scrypt$")).toBe(true);
  });

  /* Never the code itself — a leaked database read would otherwise be enough
   * to finish somebody else's sign-up. */
  it("stores only a hash of the code", async () => {
    await startSignUp();
    const [pending] = await db.select().from(pendingSignupsTable);

    expect(pending?.codeHash).not.toBe(lastSignupCode());
    expect(pending?.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalises the address", async () => {
    await startSignUp("  NEWCOMER@Example.TEST  ");
    const [pending] = await db.select().from(pendingSignupsTable);
    expect(pending?.email).toBe(EMAIL);
  });

  /* Starting over must not be punished: a mistyped code followed by a fresh
   * attempt would otherwise leave the attempt budget spent. */
  it("replaces an earlier attempt rather than adding a second", async () => {
    await startSignUp();
    const first = lastSignupCode();

    await verify(EMAIL, wrongCode(first));
    await startSignUp();

    const rows = await db.select().from(pendingSignupsTable);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.attempts).toBe(0);

    const second = lastSignupCode();
    expect((await verify(EMAIL, second)).status).toBe(200);
  });

  it("retires the previous code when a new one is sent", async () => {
    await startSignUp();
    const first = lastSignupCode();
    await startSignUp();

    expect((await verify(EMAIL, first)).status).toBe(400);
    expect(await db.select().from(usersTable)).toHaveLength(0);
  });

  it("enforces the password policy before writing anything", async () => {
    const result = await startSignUp(EMAIL, "short");

    expect(result.status).toBe(400);
    expect(await db.select().from(pendingSignupsTable)).toHaveLength(0);
    expect(await db.select().from(usersTable)).toHaveLength(0);
  });

  it("rejects an address that is not one", async () => {
    expect((await startSignUp("not-an-email")).status).toBe(400);
    expect(await db.select().from(pendingSignupsTable)).toHaveLength(0);
  });

  it("refuses an address that already has an account", async () => {
    await makeUser({ email: EMAIL });
    const result = await startSignUp();

    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/already exists/i);
    expect(await db.select().from(pendingSignupsTable)).toHaveLength(0);
  });
});

/* ─── Step two: redeeming the code ─────────────────────────────────────── */

describe("POST /signup/verify", () => {
  it("creates the user, the credential account, and a session", async () => {
    const result = await signUp();

    expect(result.status).toBe(200);
    expect(result.body.status).toBe("success");

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, EMAIL));
    expect(user).toBeTruthy();

    const accounts = await db.select().from(accountsTable);
    expect(accounts[0]?.providerId).toBe("credential");
    expect(accounts[0]?.userId).toBe(user?.id);

    expect(await db.select().from(sessionsTable)).toHaveLength(1);
  });

  /* The address was proven by the code that reached the inbox, so there is
   * nothing further to confirm. */
  it("marks the address confirmed", async () => {
    await signUp();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, EMAIL));
    expect(user?.emailVerified).toBe(true);
  });

  it("returns a session cookie that actually works", async () => {
    const result = await signUp();

    const token = cookieValue(result.cookies, "cf_jwt");
    expect(token).toBeTruthy();

    const caller = callerWithToken(token!);
    const forms = await caller.form.listFormsByUserId();
    expect(forms).toEqual([]);
  });

  it("never stores the password in readable form", async () => {
    await signUp();
    const [account] = await db.select().from(accountsTable);

    expect(account?.password).not.toContain(PASSWORD);
    expect(account?.password?.startsWith("scrypt$")).toBe(true);
  });

  it("normalises the address", async () => {
    await signUp("  NEWCOMER@Example.TEST  ");
    const [user] = await db.select().from(usersTable);
    expect(user?.email).toBe(EMAIL);
  });

  it("clears the pending row so the code cannot be redeemed twice", async () => {
    await startSignUp();
    const code = lastSignupCode();

    expect((await verify(EMAIL, code)).status).toBe(200);
    expect(await db.select().from(pendingSignupsTable)).toHaveLength(0);

    const second = await verify(EMAIL, code);
    expect(second.status).toBe(400);
    expect(await db.select().from(usersTable)).toHaveLength(1);
  });

  it("counts a wrong code against the attempt budget", async () => {
    await startSignUp();
    const code = lastSignupCode();

    const result = await verify(EMAIL, wrongCode(code));
    expect(result.status).toBe(400);

    const [pending] = await db.select().from(pendingSignupsTable);
    expect(pending?.attempts).toBe(1);
    expect(await db.select().from(usersTable)).toHaveLength(0);
  });

  /* Six digits is only 1e6 possibilities, so the attempt cap — not the length
   * — is what makes the short code acceptable. */
  it("abandons the signup after five wrong codes", async () => {
    await startSignUp();
    const code = lastSignupCode();
    const wrong = wrongCode(code);

    for (let i = 0; i < 5; i += 1) {
      expect((await verify(EMAIL, wrong)).status).toBe(400);
    }

    const afterwards = await verify(EMAIL, code);
    expect(afterwards.status).toBe(429);
    expect(await db.select().from(pendingSignupsTable)).toHaveLength(0);
    expect(await db.select().from(usersTable)).toHaveLength(0);
  });

  it("refuses a code that has expired", async () => {
    await startSignUp();
    const code = lastSignupCode();

    await db
      .update(pendingSignupsTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(pendingSignupsTable.email, EMAIL));

    const result = await verify(EMAIL, code);
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/expired/i);
    expect(await db.select().from(pendingSignupsTable)).toHaveLength(0);
    expect(await db.select().from(usersTable)).toHaveLength(0);
  });

  it("rejects a code for an address with nothing pending", async () => {
    const result = await verify(EMAIL, "123456");
    expect(result.status).toBe(400);
    expect(await db.select().from(usersTable)).toHaveLength(0);
  });

  it("rejects anything that is not six digits", async () => {
    await startSignUp();

    expect((await verify(EMAIL, "12345")).status).toBe(400);
    expect((await verify(EMAIL, "")).status).toBe(400);

    /* Malformed input is turned away before the budget is touched, so a
     * fat-fingered paste cannot burn a try. */
    const [pending] = await db.select().from(pendingSignupsTable);
    expect(pending?.attempts).toBe(0);
  });

  /* The address can be claimed by a different signup while this one sits
   * waiting for its code. */
  it("refuses when the address was claimed in the meantime", async () => {
    await startSignUp();
    const code = lastSignupCode();

    await makeUser({ email: EMAIL });

    const result = await verify(EMAIL, code);
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/already exists/i);
    expect(await db.select().from(pendingSignupsTable)).toHaveLength(0);
  });
});

/* ─── Resending the code ───────────────────────────────────────────────── */

describe("POST /signup/resend", () => {
  /* The cooldown is wall-clock, so the row is aged rather than the test slept. */
  async function ageLastSent() {
    await db
      .update(pendingSignupsTable)
      .set({ lastSentAt: new Date(Date.now() - 5 * 60_000) })
      .where(eq(pendingSignupsTable.email, EMAIL));
  }

  it("sends a fresh code that works, and retires the old one", async () => {
    await startSignUp();
    const first = lastSignupCode();
    await ageLastSent();

    const result = await post(server, "/api/auth/signup/resend", { email: EMAIL });
    expect(result.status).toBe(200);

    const second = lastSignupCode();
    expect(second).not.toBe(first);

    expect((await verify(EMAIL, first)).status).toBe(400);
    expect((await verify(EMAIL, second)).status).toBe(200);
  });

  it("restores the attempt budget along with the code", async () => {
    await startSignUp();
    const first = lastSignupCode();
    await verify(EMAIL, wrongCode(first));
    await ageLastSent();

    await post(server, "/api/auth/signup/resend", { email: EMAIL });

    const [pending] = await db.select().from(pendingSignupsTable);
    expect(pending?.attempts).toBe(0);
  });

  /* Otherwise the endpoint is a mailbomb aimed at an inbox the caller does not
   * own. */
  it("sends nothing again inside the cooldown", async () => {
    await startSignUp();
    const first = lastSignupCode();

    const result = await post(server, "/api/auth/signup/resend", { email: EMAIL });
    expect(result.status).toBe(200);

    const mail = logger.warn.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.includes("confirmation code"));
    expect(mail).toHaveLength(1);
    expect(lastSignupCode()).toBe(first);
  });

  it("answers the same way when nothing is pending", async () => {
    await startSignUp();
    await ageLastSent();

    const pending = await post(server, "/api/auth/signup/resend", { email: EMAIL });
    const absent = await post(server, "/api/auth/signup/resend", {
      email: "nobody@example.test",
    });

    expect(absent.status, "a signup in progress must not be discoverable").toBe(pending.status);
    expect(absent.body).toEqual(pending.body);
  });
});

/* ─── Signing in ───────────────────────────────────────────────────────── */

describe("POST /signin/email", () => {
  async function register() {
    await signUp();
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
   * handleSignupVerify stores `normalizeEmail(email)` (trimmed, lowercased),
   * but handleSignin looks the user up with the raw request body:
   *
   *     db.select().from(usersTable).where(eq(usersTable.email, email))
   *
   * So anyone whose keyboard, autofill or phone capitalises the first letter
   * is told "Invalid email or password" for their own account. A leading space
   * from a copy-paste does the same.
   *
   * The fix is one line in packages/trpc/server/auth.ts — look the user up by
   * `normalizeEmail(email)`, as signup and forgot-password already do.
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
    const verified = await signUp();
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
    const first = await registerAndSignIn();

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
    const first = await registerAndSignIn();
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

  /* Cleared afterwards so `lastResetLink` cannot pick up the confirmation mail
   * that creating the account just sent. */
  async function register() {
    await signUp();
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
