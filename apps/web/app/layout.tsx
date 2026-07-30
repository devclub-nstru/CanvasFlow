import type { Metadata } from "next";
import localFont from "next/font/local";
import { Fraunces, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { GlobalProviders } from "~/providers/global";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

// Display serif — used for landing headlines (close to Daylight's editorial serif).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

// Clean modern sans — body & UI (close to Daylight's Aeonik-style sans).
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

// Editorial italic accent inside the landing headlines
// ("…for when you want to click around.", "No ceremony.").
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CanvasFlow",
  description: "Form Builder",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${inter.variable} ${jbMono.variable} ${instrumentSerif.variable}`}
      >
        <GlobalProviders>{children}</GlobalProviders>
      </body>
    </html>
  );
}
