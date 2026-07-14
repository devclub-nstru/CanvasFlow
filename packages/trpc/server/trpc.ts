import { initTRPC, TRPCError } from "@trpc/server";
import { OpenApiMeta } from "trpc-to-openapi";

import { createContext } from "./context";
import { auth } from "./auth";

export const tRPCContext = initTRPC.meta<OpenApiMeta>().context<typeof createContext>().create({});

export const router = tRPCContext.router;

export const publicProcedure = tRPCContext.procedure;

export const authenticatedProcedure = tRPCContext.procedure.use(async (options) => {
  const { ctx } = options;
  const tStart = Date.now();

  const session = await auth.api.getSession({
    headers: new Headers(ctx.req.headers as Record<string, string>),
  });
  const tSession = Date.now() - tStart;

  if (!session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User is not logged in",
    });
  }

  const tInner = Date.now();
  const result = await options.next({
    ctx: {
      ...ctx,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
    },
  });
  const tInnerMs = Date.now() - tInner;

  // Server-Timing header lets us read these from the browser DevTools
  // without trying to read the dev-server's TUI. Comma-separated entries
  // per the W3C spec.
  try {
    const h = new Headers();
    h.set("Server-Timing", `auth;dur=${tSession}, inner;dur=${tInnerMs}`);
    (ctx as any).setHeaders?.(h);
  } catch {
    /* noop — header may already be sent */
  }

  return result;
});

/**
 * Procedure that requires Pro+ or Business tier.
 * Fetches the user's plan from DB and throws FORBIDDEN for Free and Pro users.
 */
export const proAuthenticatedProcedure = authenticatedProcedure.use(async (options) => {
  const { ctx } = options;

  // Import eq from @repo/database to avoid drizzle version mismatch
  const { eq: dbEq, usersTable: users } = await import("@repo/database");
  const { db: database } = await import("@repo/database");

  const rows = await database
    .select({ plan: users.plan })
    .from(users)
    .where(dbEq(users.id, ctx.user.id));

  const plan = rows[0]?.plan ?? "Free";
  const hasDetailedAnalytics = plan === "Pro+" || plan === "Business";

  if (!hasDetailedAnalytics) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Upgrade to Pro+ or Business to access detailed analytics",
    });
  }

  return options.next({
    ctx: {
      ...ctx,
      user: { ...ctx.user, plan },
    },
  });
});
