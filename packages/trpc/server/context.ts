import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Request } from "express";

export interface TRPCCtxUser {
  id: string;
  email: string;
  name: string;
}

export interface TRPCContext {
  req: Request;
  setHeaders: (headers: Headers) => void;

  user?: TRPCCtxUser;
}

export async function createContext({
  req,
  res,
}: CreateExpressContextOptions): Promise<TRPCContext> {
  const ctx: TRPCContext = {
    req,
    setHeaders: (headers: Headers) => {
      headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") {
          res.append("Set-Cookie", value);
        } else {
          res.setHeader(key, value);
        }
      });
    },
    user: undefined,
  };

  return ctx;
}
export type Context = Awaited<ReturnType<typeof createContext>>;
