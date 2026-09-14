import { ImageResponse } from "next/og";

import { SITE_NAME, SITE_TAGLINE } from "~/lib/seo";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Generated at build time, so the card never falls out of step with the
 * product name or tagline. Placed at the app root, which means every route
 * that does not define its own image inherits this one. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f0f0f0",
        padding: "72px 80px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 20, height: 20, background: "#2d5cf6" }} />
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#1a1d29",
          }}
        >
          {SITE_NAME}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "#1a1d29",
            maxWidth: 900,
          }}
        >
          {SITE_TAGLINE}
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            lineHeight: 1.4,
            color: "#5b6070",
            maxWidth: 860,
          }}
        >
          Thirteen field types, segments and branching, and every response in the same place you
          built the question.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          borderTop: "2px solid #1a1d29",
          paddingTop: 24,
          fontSize: 24,
          color: "#1a1d29",
        }}
      >
        Build it. Share it. Read it.
      </div>
    </div>,
    size,
  );
}
