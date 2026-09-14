import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/* Home-screen icon. Apple does not honour transparency, so this is drawn on
 * an opaque ground rather than relying on the page background. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1d29",
        color: "#f0f0f0",
        fontSize: 112,
        fontWeight: 700,
        fontFamily: "sans-serif",
      }}
    >
      C
    </div>,
    size,
  );
}
