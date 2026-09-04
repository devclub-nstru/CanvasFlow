/* Provisions a live presentation + session for load testing.
 *
 * Mints a session token with the same secret apps/api signs with, then drives
 * the real HTTP API — so it exercises the integrated auth path rather than
 * writing to Mongo behind the service's back.
 *
 * Usage:
 *   node tools/provision-session.js [--url http://localhost:8080] [--slides 4]
 *
 * Prints the join code on the last line so a shell can capture it.
 */

import crypto from "node:crypto";

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
  const opts = { url: defaultUrl(), slides: 4 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") opts.url = argv[++i];
    else if (argv[i] === "--slides") opts.slides = Number(argv[++i]);
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

async function main() {
  const { url, slides } = parseArgs(process.argv.slice(2));

  const secret = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be set to the same value the service uses");

  const cookie = `cf_jwt=${mintJwt(secret)}`;
  const headers = { "Content-Type": "application/json", cookie };

  const post = async (path, body) => {
    const res = await fetch(`${url}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${await res.text()}`);
    return res.json();
  };

  const patch = async (path, body) => {
    const res = await fetch(`${url}${path}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${path} -> ${res.status}: ${await res.text()}`);
    return res.json();
  };

  const presentation = await post("/api/presentations", { title: "Load Test" });
  const presentationId = presentation._id || presentation.id;

  const createdSlides = [];
  for (let i = 0; i < slides; i++) {
    const slide = await post(`/api/presentations/${presentationId}/slides`, {
      type: "BAR_GRAPH",
      position: i,
      question: `Load test question ${i + 1}`,
      options: ["Option A", "Option B", "Option C", "Option D"].map((label, idx) => ({
        id: `opt-${i}-${idx}`,
        label,
      })),
    });
    createdSlides.push(slide._id || slide.id);
  }

  const { session } = await post("/api/sessions", { presentationId });
  const sessionId = session._id || session.id;

  /* The harness needs a session that is actually accepting responses. */
  await patch(`/api/presentations/${presentationId}`, { status: "started" }).catch(() => {});

  console.error(`presentation: ${presentationId}`);
  console.error(`session:      ${sessionId}`);
  console.error(`slides:       ${createdSlides.length}`);
  console.error(`first slide:  ${createdSlides[0]}`);
  console.error(`code:         ${session.code}`);

  /* Last line on stdout, so `CODE=$(node tools/provision-session.js | tail -1)`
   * works. */
  console.log(
    JSON.stringify({
      code: session.code,
      sessionId,
      presentationId,
      slideIds: createdSlides,
      cookie,
    }),
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
