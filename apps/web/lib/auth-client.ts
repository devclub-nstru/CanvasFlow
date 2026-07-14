import { createAuthClient } from "better-auth/react";
import { env } from "~/env.js";

let baseURL = env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
if (baseURL.endsWith("/trpc")) {
  baseURL = baseURL.replace(/\/trpc$/, "");
}

export const authClient = createAuthClient({
  baseURL: baseURL + "/api/auth",
  fetchOptions: {
    credentials: "include",
  },
});
