import type { Metadata } from "next";

/* A presentation is someone's live session, not a page to rank. Disallowed in
 * robots.txt as well; this is the header that also covers a URL a crawler
 * reached by a link rather than by crawling the tree. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PresentationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
