import React from "react";
import Noise from "~/components/Noise";

export default function MentiRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-(--cf-cream) text-(--cf-ink) font-sans antialiased">
      <Noise />
      {children}
    </div>
  );
}
