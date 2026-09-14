import type { Metadata } from "next";

import LandingPage from "~/components/landing/LandingPage";
import { FAQS } from "~/lib/landing-content";
import { JsonLd } from "~/components/seo/JsonLd";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, absoluteUrl } from "~/lib/seo";
import { faqPageSchema, softwareApplicationSchema } from "~/lib/structured-data";

/* This route is a server component purely so it can own its metadata and
 * structured data — the page itself is interactive and lives in
 * components/landing/LandingPage.tsx. */
export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — ${SITE_TAGLINE}`,
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
  },
};

export default function Page() {
  return (
    <>
      <LandingPage />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqPageSchema(FAQS)} />
    </>
  );
}
