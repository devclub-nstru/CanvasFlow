import type { Request } from "express";
import { serverRouter } from "@repo/trpc/server";
import type { TRPCContext } from "@repo/trpc/server/context";
import { makeSession, type TestUser } from "./factories";

/* Calls go through the real tRPC router, which means real Zod validation and
 * the real `authenticatedProcedure` guard — that guard reads a cf_jwt cookie
 * off ctx.req.headers, verifies the JWT and checks the sessions row is still
 * live. So a caller built from a genuine session exercises the whole auth path
 * without standing an HTTP server up.
 *
 * What this deliberately skips is the Express middleware stack: rate limiters,
 * body limits, CORS. Those live in apps/api/src/server.ts and are covered at
 * HTTP level by apps/api/tests/auth-http.test.ts. */

function contextFor(cookie?: string): TRPCContext {
  const req = {
    headers: cookie ? { cookie } : {},
    ip: "127.0.0.1",
    cookies: {},
  } as unknown as Request;

  return {
    req,
    setHeaders: () => {},
    user: undefined,
  };
}

export type Caller = ReturnType<typeof serverRouter.createCaller>;

/** A caller carrying a live session for `user`. */
export async function callerFor(user: TestUser): Promise<Caller> {
  const { token } = await makeSession(user);
  return serverRouter.createCaller(contextFor(`cf_jwt=${token}`));
}

/** A caller carrying a specific token — for testing a revoked or forged one. */
export function callerWithToken(token: string): Caller {
  return serverRouter.createCaller(contextFor(`cf_jwt=${token}`));
}

/** A caller with no session at all: a member of the public. */
export function anonymousCaller(): Caller {
  return serverRouter.createCaller(contextFor());
}

/**
 * Asserts a call fails, and returns the error for further inspection.
 *
 * The services throw plain Errors that tRPC wraps, so matching on the message
 * is the honest way to tell "you are not allowed" apart from "that does not
 * exist" — which is itself worth pinning, since the two must stay
 * indistinguishable to a stranger.
 */
export async function expectRejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (err) {
    return err as Error;
  }
  throw new Error("expected the call to be rejected, but it succeeded");
}
