import { httpLink, httpBatchStreamLink } from "@repo/trpc/client";
import { env } from "~/env.js";

interface CreateTRPCHttpBatchClientClientOpts {
  enableStreaming?: boolean;
}

export const createTRPCHttpBatchClientClient = (opts?: CreateTRPCHttpBatchClientClientOpts) => {
  const c = opts?.enableStreaming ? httpBatchStreamLink : httpLink;

  let url = env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc";
  if (url && !url.endsWith("/trpc")) {
    url = `${url.replace(/\/$/, "")}/trpc`;
  }

  return c({
    url,
    fetch(fetchUrl, options) {
      return fetch(fetchUrl, {
        ...options,
        credentials: "include",
      });
    },
  });
};
