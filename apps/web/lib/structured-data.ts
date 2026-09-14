import { FEATURES, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "./seo";

/** The organisation behind the product, referenced by the other graphs. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "DevClub NST",
    url: SITE_URL,
    logo: absoluteUrl("/logo.svg"),
    email: "softwaredevg.club@rishihood.edu.in",
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

/**
 * The product itself. `offers` at price 0 is what makes a free tool eligible
 * for the free-application treatment rather than being read as price-unknown.
 */
export function softwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Form Builder",
    operatingSystem: "Any — runs in a web browser",
    browserRequirements: "Requires JavaScript and a modern browser",
    featureList: FEATURES,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function faqPageSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

/** Breadcrumbs for a second-level page, e.g. Home → Docs. */
export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function techArticleSchema({
  headline,
  description,
  path,
}: {
  headline: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline,
    description,
    url: absoluteUrl(path),
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}
