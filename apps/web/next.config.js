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

/**
 * The Menti service is reached over both HTTP and a websocket, and CSP treats
 * those as different origins: listing `https://menti.example` in connect-src
 * does NOT authorise `wss://menti.example`. Without the ws/wss entry the
 * browser blocks the socket, Socket.IO silently falls back to HTTP long-polling,
 * and a 1000-participant room turns into a request storm. So derive the
 * websocket origin from the HTTP one and list both.
 *
 * @param {string | null} origin
 */
function websocketOrigin(origin) {
  if (!origin) return null;
  if (origin.startsWith("https://")) return origin.replace(/^https:/, "wss:");
  if (origin.startsWith("http://")) return origin.replace(/^http:/, "ws:");
  return null;
}

/** @returns {string[]} */
function resolveRealtimeOrigins() {
  const menti = safeOrigin(process.env.NEXT_PUBLIC_MENTI_API_URL);
  if (!menti) return [];

  const ws = websocketOrigin(menti);
  return ws ? [menti, ws] : [menti];
}

const API_ORIGINS = resolveApiOrigins();
const REALTIME_ORIGINS = resolveRealtimeOrigins();

/* Every API origin may also be spoken to over a websocket. */
const CONNECT_SRC_ORIGINS = Array.from(
  new Set([
    ...API_ORIGINS,
    ...API_ORIGINS.map(websocketOrigin).filter((value) => typeof value === "string"),
    ...REALTIME_ORIGINS,
  ]),
).join(" ");
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
  `img-src 'self' data: blob: ${IMAGEKIT} ${QR_SERVICE} https://*.r2.dev ${REALTIME_ORIGINS.filter((origin) => !origin.startsWith("ws")).join(" ")}`,
  "font-src 'self' data:",
  `connect-src 'self' ${CONNECT_SRC_ORIGINS} ${QR_SERVICE}${isProd ? "" : " ws: wss:"}`,
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
