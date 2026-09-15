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

  try {
    const h = new Headers();
    h.set("Server-Timing", `auth;dur=${tSession}, inner;dur=${tInnerMs}`);
    (ctx as any).setHeaders?.(h);
  } catch {}

  return result;
});

const ADMIN_ROLES = ["admin", "superadmin"] as const;

export const adminProcedure = tRPCContext.procedure.use(async (options) => {
  const { ctx } = options;

  const session = await auth.api.getSession({
    headers: new Headers(ctx.req.headers as Record<string, string>),
  });

  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "User is not logged in" });
  }

  const role = (session.user as { role?: string }).role;

  if (!ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }

  return options.next({
    ctx: {
      ...ctx,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: role as (typeof ADMIN_ROLES)[number],
      },
    },
  });
});

/* Granting and revoking admin is a superadmin-only power.
 *
 * Kept separate from adminProcedure rather than checked inline: an admin who
 * could promote other admins could promote themselves out of any restriction
 * you later put on the role, so the two tiers have to be distinct gates, not
 * one gate with a flag.
 *
 * Nothing in the app grants "superadmin" — it is set by hand in the database.
 * That is deliberate: the set of people who can mint admins should change only
 * by someone with database access. */
export const superAdminProcedure = tRPCContext.procedure.use(async (options) => {
  const { ctx } = options;

  const session = await auth.api.getSession({
    headers: new Headers(ctx.req.headers as Record<string, string>),
  });

  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "User is not logged in" });
  }

  const role = (session.user as { role?: string }).role;

  if (role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Superadmin access required" });
  }

  return options.next({
    ctx: {
      ...ctx,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: "superadmin" as const,
      },
    },
  });
});
