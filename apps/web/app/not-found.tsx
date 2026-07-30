import type { Metadata } from "next";

import Navbar from "~/components/Navbar";
import Noise from "~/components/Noise";
import { NotFoundPanel } from "~/components/NotFoundPanel";
import { VerticalScale } from "~/components/Scale";

export const metadata: Metadata = {
  title: "Page not found · CanvasFlow",
};

export default function NotFound() {
  return (
    <div className="hex-theme hex-paper relative flex min-h-screen flex-col">
      <Noise />

      <div className="pointer-events-none absolute inset-0 hidden md:block">
        <VerticalScale className="absolute inset-y-0 left-0" />
        <VerticalScale className="absolute inset-y-0 right-0" />
      </div>

      <Navbar />

      <main className="relative flex flex-1 items-center overflow-hidden">
        <div className="hex-hero-paper" aria-hidden />

        {/* Crop marks, matching the hero on every other public page. */}
        <div
          className="hex-corner top-6 left-4 hidden sm:block md:left-6"
          style={{ borderRight: 0, borderBottom: 0 }}
        />
        <div
          className="hex-corner top-6 right-4 hidden sm:block md:right-6"
          style={{ borderLeft: 0, borderBottom: 0 }}
        />
        <div
          className="hex-corner bottom-6 left-4 hidden sm:block md:left-6"
          style={{ borderRight: 0, borderTop: 0 }}
        />
        <div
          className="hex-corner bottom-6 right-4 hidden sm:block md:right-6"
          style={{ borderLeft: 0, borderTop: 0 }}
        />

        <NotFoundPanel />
      </main>
    </div>
  );
}
