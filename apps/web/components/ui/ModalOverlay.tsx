"use client";

import React from "react";
import { createPortal } from "react-dom";

/**
 * Full-page modal backdrop that actually covers the whole page.
 *
 * The `.cf-scrim` class alone cannot do this from inside a dashboard page.
 * `app/dashboard/layout.tsx` wraps page content in `<main className="relative
 * z-10">`, and a positioned element with a z-index establishes a stacking
 * context — so a scrim rendered inside `<main>` has its `z-index: 50` resolved
 * *within* that z-10 context. `DashboardNav` is a sibling of `<main>` at z-40,
 * which means it outranks the entire subtree no matter how high the scrim
 * climbs. Raising the number is not a fix; the scrim has to leave the subtree.
 *
 * Hence the portal to `document.body`, where the z-index competes at the top
 * level and the nav is covered like everything else.
 *
 * Dialogs rendered from the layout itself (create form) sit outside `<main>`
 * already and never had this problem. The delete-form dialog on the sketches
 * page does have it, and can be moved onto this component the same way.
 *
 * No mount guard is needed: callers render this only in response to a click,
 * so it is never reached during SSR.
 */
export function ModalOverlay({
  onDismiss,
  children,
}: {
  /** Click-outside handler. Omit to make the backdrop inert. */
  onDismiss?: () => void;
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{
        // Heavier than `.cf-scrim`'s 2px: the page behind should read as
        // out of reach, not merely tinted.
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        background: "rgba(16, 16, 20, 0.55)",
      }}
      // Dismiss only on the backdrop itself. Without the target check, a click
      // that starts inside the dialog and drifts onto the backdrop — selecting
      // text, for instance — would close it.
      onClick={onDismiss ? (e) => e.target === e.currentTarget && onDismiss() : undefined}
    >
      {children}
    </div>,
    document.body,
  );
}
