/* Drives a session as the host, without the web UI.
 *
 * Connects over the same socket path a presenter uses, takes the session live,
 * walks the slides, and prints the analytics frames it receives — which is how
 * you confirm that tallies are actually reaching presenters under load.
 *
 * Usage:
 *   node tools/drive-session.js --session <id> --url http://127.0.0.1:8080 \
 *     [--slides <id,id>] [--hold 20000] [--watch-only]
 */

import crypto from "node:crypto";
import { io as ioClient } from "socket.io-client";

/* Default to the menti service, not to whatever happens to be on port 3000.
 * These tools load the repository root .env (via the package scripts), so
 * MENTI_PORT is the same value the service itself binds. Getting this wrong is
 * silent and confusing: posting a join to the Next.js app on :3000 returns its
 * HTML 404 page, which reads like a server failure rather than a wrong URL. */
function defaultUrl() {
  if (process.env.MENTI_URL) return process.env.MENTI_URL.replace(/\/$/, "");
  return `http://127.0.0.1:${process.env.MENTI_PORT || 8080}`;
}

function parseArgs(argv) {
  const opts = {
    url: defaultUrl(),
    session: null,
    slides: [],
    holdMs: 20000,
    watchOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--url": opts.url = (argv[++i] || opts.url).replace(/\/$/, ""); break;
      case "--session": opts.session = argv[++i]; break;
      case "--slides": opts.slides = (argv[++i] || "").split(",").filter(Boolean); break;
      case "--hold": opts.holdMs = Math.max(0, parseInt(argv[++i], 10)); break;
      case "--watch-only": opts.watchOnly = true; break;
    }
  }
  return opts;
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function mintJwt(secret) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      id: "load-test-presenter",
      email: "loadtest@example.com",
      name: "Load Test Presenter",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.session) throw new Error("--session <id> is required");

  const secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("JWT_SECRET must match the running service");

  const socket = ioClient(opts.url, {
    query: { sessionId: opts.session },
    auth: { sessionId: opts.session },
    extraHeaders: { cookie: `cf_jwt=${mintJwt(secret)}` },
    transports: ["websocket"],
    forceNew: true,
  });

  const emit = (event, data) =>
    new Promise((resolve, reject) => {
      socket.emit(event, data, (ack) => {
        if (ack?.success) resolve(ack.data);
        else reject(new Error(ack?.error || `${event} failed`));
      });
    });

  let lastAnalytics = null;
  let participantCount = 0;

  socket.on("session_state_sync", (state) => {
    participantCount = state?.participantCount ?? 0;
  });

  socket.on("slide_analytics_update", (analytics) => {
    lastAnalytics = analytics;
  });

  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", (err) => reject(new Error(`connect_error: ${err.message}`)));
    setTimeout(() => reject(new Error("connect timed out")), 15000);
  });

  console.log(`host connected to session ${opts.session}`);

  if (!opts.watchOnly) {
    await emit("change_session_status", { status: "live" });
    console.log("session is live");
  }

  const report = setInterval(() => {
    if (!lastAnalytics) {
      console.log(`participants=${participantCount}  analytics: (none yet)`);
      return;
    }

    const total = lastAnalytics.totalVotes ?? lastAnalytics.totalResponses ?? 0;
    const top = (lastAnalytics.results || [])
      .slice(0, 5)
      .map((r) => `${r.label}=${r.count ?? r.voteCount ?? 0}`)
      .join("  ");

    console.log(
      `participants=${participantCount}  type=${lastAnalytics.type}  total=${total}  ${top}`,
    );
  }, 2000);

  for (const slideId of opts.slides) {
    await emit("change_slide", { slideId });
    console.log(`\n--- advanced to slide ${slideId} ---`);
    await sleep(opts.holdMs);
  }

  if (opts.slides.length === 0) await sleep(opts.holdMs);

  clearInterval(report);
  socket.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
