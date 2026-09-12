import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

/* A real HTTP server carrying the auth router.
 *
 * The auth surface is Express, not tRPC — sign-up, verification, sign-in and
 * sign-out are route handlers that set cookies — so the only honest way to test
 * them end to end is to speak HTTP to them. Deliberately mounted without the
 * rate limiters from apps/api/src/server.ts: those have their own coverage in
 * apps/api/tests/auth-http.test.ts, and here they would just throttle the
 * suite.
 */

export interface TestServer {
  url: string;
  close(): Promise<void>;
}

export async function startAuthServer(): Promise<TestServer> {
  const express = (await import("express")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const { authRouter } = await import("@repo/trpc/server/auth");

  const app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(express.json({ limit: "16kb" }));
  app.use("/api/auth", authRouter);

  const server: Server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export interface HttpResult<T = Record<string, unknown>> {
  status: number;
  body: T;
  cookies: string[];
}

export async function post<T = Record<string, unknown>>(
  server: TestServer,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<HttpResult<T>> {
  const response = await fetch(`${server.url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    redirect: "manual",
  });

  return {
    status: response.status,
    body: (await response.json().catch(() => ({}))) as T,
    cookies: response.headers.getSetCookie?.() ?? [],
  };
}

export async function get<T = Record<string, unknown>>(
  server: TestServer,
  path: string,
  headers: Record<string, string> = {},
): Promise<HttpResult<T>> {
  const response = await fetch(`${server.url}${path}`, { headers, redirect: "manual" });

  return {
    status: response.status,
    body: (await response.json().catch(() => ({}))) as T,
    cookies: response.headers.getSetCookie?.() ?? [],
  };
}

/** Pulls one cookie's value out of a Set-Cookie list. */
export function cookieValue(cookies: string[], name: string): string | null {
  const entry = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!entry) return null;
  const value = entry.split(";")[0]?.slice(name.length + 1) ?? "";
  return value === "" ? null : value;
}

/** The Cookie header a browser would send back. */
export function cookieHeader(cookies: string[], name: string): string {
  return `${name}=${cookieValue(cookies, name) ?? ""}`;
}
