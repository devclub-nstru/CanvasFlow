/**
 * One source of truth for everything a crawler or a language model reads:
 * the sitemap, robots rules, canonical URLs, JSON-LD, and /llms.txt all
 * derive from the values here rather than repeating them.
 */

/* The public origin. Falls back to localhost so a dev build still produces
 * absolute URLs instead of throwing — production sets the real value.
 *
 * `||`, not `??`, and trimmed first. A Docker build arg that is declared but
 * passed no value arrives as an empty string rather than undefined, so `??`
 * lets "" through — and `new URL("")` in layout.tsx's metadataBase throws
 * ERR_INVALID_URL during page collection, failing the whole build. That is a
 * deploy whose only fault is an environment variable nobody filled in yet, so
 * it has to degrade to the fallback instead of exploding. */
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const SITE_URL = (configuredSiteUrl || "http://localhost:3000").replace(/\/$/, "");

/* Degrading quietly is the wrong half of the trade: the build survives, and
 * every canonical, sitemap entry and OG tag then tells crawlers the site lives
 * at localhost. Server-side only, so it lands in the build log where whoever
 * ran the deploy will see it, rather than in visitors' consoles. */
if (!configuredSiteUrl && process.env.NODE_ENV === "production" && typeof window === "undefined") {
  console.warn(
    "[seo] NEXT_PUBLIC_SITE_URL is not set. Canonical URLs, the sitemap, OG tags and " +
      `JSON-LD will all be built from ${SITE_URL}. Set it in the deployment environment ` +
      "and rebuild the web image — it is inlined at build time, so a runtime value is " +
      "too late.",
  );
}

export const SITE_NAME = "CanvasFlow";

export const SITE_TAGLINE = "A canvas-first form builder that reads its own results.";

export const SITE_DESCRIPTION =
  "Build forms on an open canvas, split them into segments, branch on the answers, and read every response in the same place you built the question. Thirteen field types, access you control, CSV export, and live Menti sessions.";

/** Absolute URL for a path — canonical tags and JSON-LD both need one. */
export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export interface PublicPage {
  path: string;
  title: string;
  /** One line, used in the sitemap's siblings and in /llms.txt. */
  summary: string;
  /** Relative weight for the sitemap. */
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
}

/**
 * Every page we want indexed. Anything not listed here is either private
 * (the dashboard), someone else's data (a live form), or a transient session
 * (a Menti room) — see app/robots.ts.
 */
export const PUBLIC_PAGES: PublicPage[] = [
  {
    path: "/",
    title: "CanvasFlow — canvas-first form builder",
    summary:
      "What CanvasFlow is, what the builder looks like, and what you get back once people start answering.",
    priority: 1,
    changeFrequency: "monthly",
  },
  {
    path: "/docs",
    title: "Docs",
    summary:
      "The complete guide, in twenty sections: the builder, field types, segments, branching, layouts, publishing, access control, collaborators, responses and export, and live Menti sessions.",
    priority: 0.9,
    changeFrequency: "monthly",
  },
  {
    path: "/learn-more",
    title: "Learn more",
    summary:
      "Every capability in one pass — field types, segments and branching, layouts, file uploads, access control, analytics, collaboration, and Menti.",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/about",
    title: "About",
    summary: "Why CanvasFlow exists, the principles behind it, and who it is built for.",
    priority: 0.6,
    changeFrequency: "yearly",
  },
  {
    path: "/menti/join",
    title: "Join a live session",
    summary: "Where an audience enters a join code to answer a live Menti presentation.",
    priority: 0.5,
    changeFrequency: "yearly",
  },
  {
    path: "/privacy",
    title: "Privacy policy",
    summary:
      "What is stored for account holders and for people answering a form, what is deliberately not collected, how long it is kept, and how to get it back.",
    priority: 0.4,
    changeFrequency: "yearly",
  },
];

/** Paths no crawler should index: private, per-user, or per-session. */
export const DISALLOWED_PATHS = [
  "/dashboard",
  "/forms/", // live forms belong to users, not to search results
  "/auth/",
  "/signIn",
  "/signUp",
  "/forgotPassword",
  "/resetPassword",
  "/menti/", // individual presentation + session routes
  "/api/",
];

/** Product capabilities, stated once and reused by JSON-LD and /llms.txt. */
export const FEATURES = [
  "Canvas or outline form builder",
  "Thirteen field types, including file upload",
  "Segments and conditional branching",
  "Four question layouts",
  "Access control: require sign-in, restrict by email domain, one response per person",
  "Response summaries, per-question views, and CSV export",
  "Collaborators with viewer, editor, and owner roles",
  "Menti — live polls, word clouds, scales, and quizzes",
];
