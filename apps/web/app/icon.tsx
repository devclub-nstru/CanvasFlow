import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/* A PNG favicon alongside the SVG one, for the clients that ignore SVG. */
export default function Icon() {
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
        fontSize: 40,
        fontWeight: 700,
        fontFamily: "sans-serif",
      }}
    >
      C
    </div>,
    size,
  );
}
