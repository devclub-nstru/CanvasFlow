import type { Metadata } from "next";

/* A live form belongs to the person who built it. Indexing one would publish
 * their questions — and, through the search cache, potentially more. Kept out
 * of the index regardless of how a crawler found the URL. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return children;
}
