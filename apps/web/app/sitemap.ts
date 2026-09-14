import type { MetadataRoute } from "next";

import { PUBLIC_PAGES, absoluteUrl } from "~/lib/seo";

/**
 * Only the marketing and reference pages. User forms are deliberately absent:
 * enumerating them here would publish every live form URL in one file.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
