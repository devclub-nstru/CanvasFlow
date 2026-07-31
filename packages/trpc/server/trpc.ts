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
