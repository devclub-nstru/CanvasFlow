import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { GlobalProviders } from "~/providers/global";
import { JsonLd } from "~/components/seo/JsonLd";
import { organizationSchema, websiteSchema } from "~/lib/structured-data";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "~/lib/seo";
import FeedbackWidget from "~/components/FeedbackWidget";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-cf",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  /* Every absolute URL Next generates — canonicals, OG images, the sitemap
   * reference — is resolved against this. Without it, relative image paths in
   * metadata are dropped silently and links unfurl with no card. */
  metadataBase: new URL(SITE_URL),

  /* Pages set only their own name; the suffix is applied here so it can never
   * drift page to page. `default` covers routes that set no title at all. */
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "form builder",
    "online forms",
    "survey tool",
    "conditional logic forms",
    "form analytics",
    "live polls",
    "audience response",
  ],
  authors: [{ name: "DevClub NST" }],
  creator: "DevClub NST",
  publisher: "DevClub NST",

  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  /* Icons come from app/icon.tsx and app/apple-icon.tsx; Next emits the link
   * tags for those automatically, so they are not declared here. */
  manifest: "/manifest.webmanifest",

  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f0f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1d29" },
  ],
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://ik.imagekit.io" crossOrigin="" />
        <link rel="dns-prefetch" href="https://ik.imagekit.io" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jbMono.variable} ${instrumentSerif.variable}`}
      >
        <GlobalProviders>
          {children}
          <FeedbackWidget />
        </GlobalProviders>
        <JsonLd data={organizationSchema()} />
        <JsonLd data={websiteSchema()} />

        {/* SpeedInsights reports field Core Web Vitals (LCP, CLS, INP) from
         * real visits; Analytics counts page views. Both load their script and
         * send their beacons under /_vercel/ on this same origin, so the
         * existing `script-src 'self'` and `connect-src 'self'` in
         * next.config.js already cover them — no CSP change is needed.
         *
         * They report only when the app is served by Vercel. Anywhere else the
         * /_vercel/ routes don't exist, the script 404s, and the components sit
         * inert rather than erroring. */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
