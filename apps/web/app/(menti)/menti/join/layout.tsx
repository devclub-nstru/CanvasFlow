import type { Metadata } from "next";

import { absoluteUrl } from "~/lib/seo";

/* The join page itself is interactive, so its metadata lives here — a layout
 * is a server component even when the page it wraps is not. */
export const metadata: Metadata = {
  title: "Join a live session",
  description:
    "Enter your join code to answer a live CanvasFlow presentation — polls, word clouds, scales, and quizzes, answered from your phone.",
  alternates: { canonical: absoluteUrl("/menti/join") },
  openGraph: {
    type: "website",
    title: "Join a live session",
    description: "Enter your join code to answer a live CanvasFlow presentation.",
    url: absoluteUrl("/menti/join"),
  },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
