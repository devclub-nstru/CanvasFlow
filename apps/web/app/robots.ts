import type { MetadataRoute } from "next";

import { DISALLOWED_PATHS, PUBLIC_PAGES, SITE_URL, absoluteUrl } from "~/lib/seo";

/**
 * Crawl rules.
 *
 * The disallow list is the important half. `/forms/` holds live forms that
 * belong to users, not to us — an indexed form URL is a privacy failure, not
 * a traffic win — and `/dashboard` is per-account. Middleware already
 * redirects signed-out visitors away from the dashboard, but a redirect is
 * not a crawl directive: without this file a crawler still requests the URL
 * and may index whatever it is sent to.
 *
 * AI crawlers are allowed the same public pages as everyone else, so an
 * assistant asked to recommend a form builder can actually read what
 * CanvasFlow does. To opt out of AI training instead, add the agents named
 * below to the disallow list. Note that Google-Extended governs AI training
 * only and has no effect on ordinary Search ranking, so blocking it costs
 * nothing in search visibility.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

/*
 * Public pages that sit *under* a disallowed prefix need an explicit allow:
 * /menti/join is a landing page, but /menti/ as a whole is per-session. Both
 * Google and Bing resolve a conflict by the most specific rule, so listing the
 * longer allow alongside the shorter disallow keeps the join page crawlable
 * without opening up the session routes.
 */
const allow = [
  "/",
  ...PUBLIC_PAGES.map((page) => page.path).filter((path) =>
    DISALLOWED_PATHS.some((blocked) => path.startsWith(blocked)),
  ),
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow,
        disallow: DISALLOWED_PATHS,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow,
        disallow: DISALLOWED_PATHS,
      })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
