import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isProd = process.env.NODE_ENV === "production";

/**
 * @param {string | undefined} raw
 */
function safeOrigin(raw) {
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function resolveApiOrigins() {
  const fallback = "http://localhost:8000";
  const primary = safeOrigin(process.env.NEXT_PUBLIC_API_URL) ?? fallback;
  const extras = (process.env.NEXT_PUBLIC_API_URLS ?? "")
    .split(",")
    .map((value) => safeOrigin(value.trim()))
    .filter(Boolean);

  return Array.from(new Set([primary, ...extras]));
}

const API_ORIGINS = resolveApiOrigins();
const CONNECT_SRC_API_ORIGINS = API_ORIGINS.join(" ");
const IMAGEKIT = "https://ik.imagekit.io"; // landing artwork
const QR_SERVICE = "https://api.qrserver.com"; // share-dialog QR, both <img> and fetch()

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${IMAGEKIT} ${QR_SERVICE} https://*.r2.dev`,
  "font-src 'self' data:",
  `connect-src 'self' ${CONNECT_SRC_API_ORIGINS} ${QR_SERVICE}${isProd ? "" : " ws: wss:"}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Redundant beside `frame-ancestors` for modern browsers, kept for older ones.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the full URL same-origin, only the origin cross-origin, nothing on a
  // downgrade. Keeps form IDs out of third-party referer logs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app asks for none of these, so deny them outright.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // HSTS is meaningless over plain HTTP and pinning `localhost` in a dev
  // browser profile is a genuine nuisance, so it is production-only.
  // `preload` is deliberately omitted: submitting to the preload list is
  // effectively irreversible and should be a conscious decision, not a default.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  images: {
    // Landing-page artwork is served from ImageKit.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        // Every route, including the public form pages.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
