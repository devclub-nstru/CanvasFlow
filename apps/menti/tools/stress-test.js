#!/usr/bin/env node

/**
 * ──────────────────────────────────────────────────────────────────
 *  HARDCORE WEBSOCKET STRESS TEST
 *  Mentimeter Realtime Backend
 * ──────────────────────────────────────────────────────────────────
 *
 *  This script simulates 1500 real participants:
 *
 *    1. PHASE 1 — HTTP JOIN: Each participant calls POST /api/sessions/:code/join
 *       to obtain a real participantToken (bypasses Better Auth entirely — only
 *       uses the participant token flow which is self-contained).
 *
 *    2. PHASE 2 — WEBSOCKET SWARM: All 1500 connect via Socket.IO with their
 *       token. Each client joins the session room, receives session_state_sync,
 *       and sits idle, exerting passive connection pressure.
 *
 *    3. PHASE 3 — REACTIVE VOTE SPAM: Clients listen for `session_state_sync`.
 *       When the current slide changes (host navigates), ALL connected clients
 *       instantly fire `submit_response` with a randomized answer matching the
 *       slide type. This creates a thundering-herd scenario on every slide change.
 *
 *    4. PHASE 4 — CHAOS BARRAGE (optional --chaos flag): Periodically fires
 *       random pings, duplicate vote attempts, and malformed payloads to stress
 *       error paths and rate limiter exhaustion.
 *
 *  USAGE:
 *    # Install socket.io-client first (one time)
 *    npm install socket.io-client
 *
 *    # Basic — 1500 users, wait for host to change slides
 *    node stress-test.js --code 123456
 *
 *    # Custom count + chaos mode
 *    node stress-test.js --code 123456 --count 1500 --chaos
 *
 *    # Against a remote server
 *    node stress-test.js --code 123456 --url http://your-server:8080
 *
 *  OPTIONS:
 *    --code <pin>          Session join code (REQUIRED)
 *    --count <n>           Number of simulated participants (default: 1500)
 *    --url <http://...>    Server URL (default: $MENTI_URL, else 127.0.0.1:$MENTI_PORT)
 *    --batch <n>           Concurrent HTTP join batch size (default: 50)
 *    --ws-batch <n>        Concurrent WebSocket connection batch size (default: 100)
 *    --chaos               Enable chaos barrage (bad payloads, duplicate votes, pings)
 *    --chaos-interval <ms> Chaos fire interval in ms (default: 2000)
 *    --vote-delay <ms>     Artificial delay before voting after slide change (default: 0)
 *    --help                Show this text
 * ──────────────────────────────────────────────────────────────────
 */

import { io as ioClient } from "socket.io-client";
import { performance } from "node:perf_hooks";
import process from "node:process";
import crypto from "node:crypto";

// ─── CLI ──────────────────────────────────────────────────────────
/* Default to the menti service, not to whatever happens to be on port 3000.
 * These tools load the repository root .env (via the package scripts), so
 * MENTI_PORT is the same value the service itself binds. Getting this wrong is
 * silent and confusing: posting a join to the Next.js app on :3000 returns its
 * HTML 404 page, which reads like a server failure rather than a wrong URL. */
function defaultUrl() {
  if (process.env.MENTI_URL) return process.env.MENTI_URL.replace(/\/$/, "");
  return `http://127.0.0.1:${process.env.MENTI_PORT || 8080}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    code: null,
    count: 1500,
    url: defaultUrl(),
    batch: 50,
    wsBatch: 100,
    chaos: false,
    chaosInterval: 2000,
    voteDelay: 0,
    rampMs: 45000,
    thinkMinMs: 1500,
    thinkMaxMs: 12000,
    instant: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--code":
        opts.code = args[++i];
        break;
      case "--count":
        opts.count = Math.max(1, parseInt(args[++i], 10));
        break;
      case "--url":
        opts.url = (args[++i] || opts.url).replace(/\/$/, "");
        break;
      case "--batch":
        opts.batch = Math.max(1, parseInt(args[++i], 10));
        break;
      case "--ws-batch":
        opts.wsBatch = Math.max(1, parseInt(args[++i], 10));
        break;
      case "--chaos":
        opts.chaos = true;
        break;
      case "--chaos-interval":
        opts.chaosInterval = Math.max(100, parseInt(args[++i], 10));
        break;
      case "--vote-delay":
        opts.voteDelay = Math.max(0, parseInt(args[++i], 10));
        break;
      case "--ramp":
        opts.rampMs = Math.max(0, parseInt(args[++i], 10));
        break;
      case "--think-min":
        opts.thinkMinMs = Math.max(0, parseInt(args[++i], 10));
        break;
      case "--think-max":
        opts.thinkMaxMs = Math.max(0, parseInt(args[++i], 10));
        break;
      case "--instant":
        opts.instant = true;
        opts.rampMs = 0;
        opts.thinkMinMs = 0;
        opts.thinkMaxMs = 0;
        break;
      case "--help":
        opts.help = true;
        break;
    }
  }
  return opts;
}

// ─── CONSTANTS ────────────────────────────────────────────────────
const FIRST_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Sam", "Riley", "Casey", "Avery",
  "Logan", "Parker", "Quinn", "Cameron", "Dakota", "Reese", "Rowan", "Hayden",
  "Skyler", "Jesse", "Finley", "Emerson", "Adrian", "Kai", "Charlie", "Peyton",
  "Kendall", "River", "Dallas", "Harper", "Rory", "Sawyer", "Elliot", "Micah",
  "Noah", "Liam", "Emma", "Olivia", "Ava", "Sophia", "Jackson", "Lucas",
  "Mia", "Ethan", "Aria", "Leo", "Maya", "Zoe", "Oliver", "Elijah", "Luna",
  "Noor",
];

const WORD_CLOUD_WORDS = [
  "Innovation", "Speed", "Scalability", "Clean", "Intuitive", "Modern",
  "Awesome", "Productive", "Collaborative", "Fast", "Interactive", "Futuristic",
  "Impact", "Delightful", "Smooth", "Creative", "Dynamic", "Powerful",
  "Minimal", "Engaging", "Realtime", "Efficient", "Polished", "Simple",
  "NextGen", "Reliable", "Elegant", "Agile", "Visionary", "Smart",
];

// ─── METRICS ──────────────────────────────────────────────────────
class Metrics {
  constructor() {
    this.httpJoinOk = 0;
    this.httpJoinFail = 0;
    this.wsConnected = 0;
    this.wsConnectFail = 0;
    this.wsDisconnects = 0;
    this.stateUpdatesReceived = 0;
    this.votesAttempted = 0;
    this.votesAckedOk = 0;
    this.votesAckedFail = 0;
    this.chaosAttempts = 0;
    this.chaosRateLimited = 0;
    this.chaosErrors = 0;
    this.slideChangesDetected = 0;
    this.votesSkippedStale = 0;
    this.latencies = [];
    this.thinkTimes = [];
    this._startTime = performance.now();
  }

  recordLatency(ms) {
    this.latencies.push(ms);
  }

  recordThinkTime(ms) {
    this.thinkTimes.push(ms);
  }

  summary() {
    const wall = ((performance.now() - this._startTime) / 1000).toFixed(1);
    const mem = process.memoryUsage();
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
    const avg = sorted.length
      ? (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(1)
      : 0;

    return {
      elapsed: `${wall}s`,
      connections: {
        httpJoinOk: this.httpJoinOk,
        httpJoinFail: this.httpJoinFail,
        wsConnected: this.wsConnected,
        wsConnectFail: this.wsConnectFail,
        wsDisconnects: this.wsDisconnects,
      },
      realtime: {
        stateUpdatesReceived: this.stateUpdatesReceived,
        slideChangesDetected: this.slideChangesDetected,
        votesAttempted: this.votesAttempted,
        votesAckedOk: this.votesAckedOk,
        votesAckedFail: this.votesAckedFail,
        votesSkippedStale: this.votesSkippedStale,
      },
      /* Reported so a run's numbers can be read in context: the same server
       * behaves very differently under a 45s ramp than under --instant. */
      pacing: (() => {
        if (this.thinkTimes.length === 0) return { thinkTime: "instant" };
        const sorted = [...this.thinkTimes].sort((a, b) => a - b);
        return {
          samples: sorted.length,
          thinkMinMs: sorted[0],
          thinkP50Ms: sorted[Math.floor(sorted.length * 0.5)],
          thinkP95Ms: sorted[Math.floor(sorted.length * 0.95)],
          thinkMaxMs: sorted[sorted.length - 1],
        };
      })(),
      chaos: {
        attempts: this.chaosAttempts,
        rateLimited: this.chaosRateLimited,
        errors: this.chaosErrors,
      },
      latency: {
        samples: sorted.length,
        avgMs: avg,
        p50Ms: p50.toFixed(1),
        p95Ms: p95.toFixed(1),
        p99Ms: p99.toFixed(1),
      },
      memory: {
        rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
        heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
        heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
      },
    };
  }
}

// ─── UTILITIES ────────────────────────────────────────────────────
function randomName(i) {
  return `${FIRST_NAMES[i % FIRST_NAMES.length]}_${Math.floor(100 + Math.random() * 900)}`;
}

/* Answer latency in a real room is long-tailed: a handful of people answer
 * almost immediately, most cluster in the middle, and a few stragglers take far
 * longer. A log-normal reproduces that shape far better than the uniform
 * `Math.random() * delay` this harness used to apply — uniform pacing spreads
 * load evenly, which is precisely the case that does NOT stress the server.
 * The real hazard is the early spike, and only a skewed distribution produces
 * one. */
function logNormalDelay(minMs, maxMs) {
  if (maxMs <= minMs) return minMs;

  // Box-Muller transform for a standard normal sample.
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);

  /* sigma = 0.6 gives a pronounced but not absurd tail; the median lands
   * around a third of the way into the window. */
  const lognormal = Math.exp(normal * 0.6);
  const spread = maxMs - minMs;
  const scaled = minMs + (spread * lognormal) / 4;

  return Math.min(maxMs, Math.max(minMs, Math.round(scaled)));
}

/* Word-cloud and rating slides take longer to answer than clicking one of four
 * options, so scale the think time by what the participant actually has to do. */
function thinkTimeFor(slide, opts) {
  if (opts.thinkMaxMs <= 0) return 0;

  const typed = slide?.type === "WORD_CLOUD" || slide?.type === "text" || slide?.type === "multi_text";
  const factor = typed ? 1.6 : 1;

  return Math.round(logNormalDelay(opts.thinkMinMs, opts.thinkMaxMs) * factor);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function generateAnswer(slide) {
  if (!slide) return null;

  switch (slide.type) {
    case "BAR_GRAPH":
    case "QUIZ":
    case "select":
    case "multi_select": {
      const options = slide.options || [];
      if (options.length === 0) return null;
      const pick = options[Math.floor(Math.random() * options.length)];
      return pick.id;
    }
    case "WORD_CLOUD":
    case "text":
    case "multi_text": {
      const n = Math.random() < 0.6 ? 1 : 2;
      const words = [];
      for (let i = 0; i < n; i++) {
        words.push(WORD_CLOUD_WORDS[Math.floor(Math.random() * WORD_CLOUD_WORDS.length)]);
      }
      return words;
    }
    case "SCALES":
    case "rating": {
      const min = slide.responseSettings?.minRating ?? 1;
      const max = slide.responseSettings?.maxRating ?? 5;
      return min + Math.floor(Math.random() * (max - min + 1));
    }
    default:
      return null;
  }
}

// ─── PHASE 1: HTTP JOIN ───────────────────────────────────────────
async function joinParticipant(url, code, nickname) {
  const res = await fetch(`${url}/api/sessions/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

async function joinAllParticipants(url, code, count, batchSize, metrics, opts = {}) {
  const participants = [];
  const totalBatches = Math.ceil(count / batchSize);

  /* Arrivals are spread across the ramp window rather than fired at line rate.
   * A real audience trickles in as people find the code and type it, so the
   * join phase should be a ramp, not a step. */
  const rampMs = opts.rampMs ?? 0;
  const perBatchDelay = rampMs > 0 && totalBatches > 1 ? rampMs / (totalBatches - 1) : 200;

  console.log(
    `\n🚪 PHASE 1 — HTTP JOIN (${count} participants, batch=${batchSize}` +
      (rampMs > 0 ? `, ramp=${(rampMs / 1000).toFixed(0)}s` : ", instant") +
      `)`,
  );

  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * batchSize;
    const end = Math.min(start + batchSize, count);
    const promises = [];

    for (let i = start; i < end; i++) {
      const name = randomName(i);
      promises.push(
        joinParticipant(url, code, name)
          .then((data) => {
            metrics.httpJoinOk++;
            participants.push({
              index: i,
              nickname: name,
              token: data.participantToken,
              participantId: data.participantId,
              sessionId: data.session?.id || data.session?._id,
              presentationId: data.session?.presentationId,
            });
          })
          .catch((err) => {
            metrics.httpJoinFail++;
            if (metrics.httpJoinFail <= 5) {
              console.error(`   ⚠ Join failed for ${name}: ${err.message}`);
            }
          })
      );
    }

    await Promise.all(promises);

    const pct = Math.round((end / count) * 100);
    process.stdout.write(
      `\r   ✅ Joined: ${metrics.httpJoinOk}/${count} (${pct}%) | Failed: ${metrics.httpJoinFail}`
    );

    if (batch < totalBatches - 1) {
      /* Jittered so batches do not land on a fixed cadence the server could
       * accidentally stay in step with. */
      const jitter = 0.75 + Math.random() * 0.5;
      await sleep(Math.round(perBatchDelay * jitter));
    }
  }

  console.log();
  return participants;
}

// ─── PHASE 2: WEBSOCKET SWARM ────────────────────────────────────
function connectSocket(url, participant, metrics, opts) {
  return new Promise((resolve) => {
    const socket = ioClient(url, {
      query: { token: participant.token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 15000,
      forceNew: true,
    });

    let resolved = false;
    let currentSlideId = null;
    let submittedSlides = new Set();
    let currentSlide = null;

    socket.on("connect", () => {
      metrics.wsConnected++;
      if (!resolved) {
        resolved = true;
        resolve({ socket, participant, submittedSlides, getCurrentSlide: () => currentSlide });
      }
    });

    socket.on("connect_error", (err) => {
      if (!resolved) {
        metrics.wsConnectFail++;
        resolved = true;
        resolve(null);
      }
    });

    socket.on("disconnect", () => {
      metrics.wsDisconnects++;
    });

    socket.on("session_state_sync", async (state) => {
      metrics.stateUpdatesReceived++;

      const slideId = state?.session?.currentSlideId || state?.currentSlide?._id;
      const slide = state?.currentSlide;
      currentSlide = slide;

      if (slideId && slideId !== currentSlideId) {
        currentSlideId = slideId;
        metrics.slideChangesDetected++;
      }

      // Vote whenever the session is live and this slide has not been voted on yet
      if (
        slideId &&
        state?.session?.status === "live" &&
        !state?.session?.isVotingLocked &&
        slide &&
        slide.type !== "CONTENT" &&
        slide.type !== "LEADERBOARD" &&
        !submittedSlides.has(slideId)
      ) {
        submittedSlides.add(slideId);

        /* --vote-delay stays supported as an explicit uniform override. */
        const think = opts.voteDelay > 0
          ? Math.random() * opts.voteDelay
          : thinkTimeFor(slide, opts);

        if (think > 0) {
          metrics.recordThinkTime?.(think);
          await sleep(think);
        }

        /* The host may have advanced or locked the slide while this participant
         * was "reading" it. A real client would not submit into a closed slide,
         * and counting those as failures would misreport the run. */
        if (currentSlideId !== slideId) {
          metrics.votesSkippedStale = (metrics.votesSkippedStale || 0) + 1;
          return;
        }

        const answer = generateAnswer(slide);
        if (answer !== null) {
          const t0 = performance.now();
          metrics.votesAttempted++;

          socket.emit(
            "submit_response",
            { slideId, answer },
            (ack) => {
              const latency = performance.now() - t0;
              metrics.recordLatency(latency);

              if (ack?.success) {
                metrics.votesAckedOk++;
              } else {
                metrics.votesAckedFail++;
                submittedSlides.delete(slideId);
              }
            }
          );
        }
      }
    });

    // Timeout safety
    setTimeout(() => {
      if (!resolved) {
        metrics.wsConnectFail++;
        resolved = true;
        socket.close();
        resolve(null);
      }
    }, 20000);
  });
}

async function connectAllSockets(url, participants, metrics, opts) {
  const sockets = [];
  const totalBatches = Math.ceil(participants.length / opts.wsBatch);

  /* Sockets open on roughly the same ramp as the joins: in the real flow each
   * participant opens their socket the moment their own join returns. */
  const rampMs = opts.rampMs ?? 0;
  const perBatchDelay = rampMs > 0 && totalBatches > 1 ? rampMs / (totalBatches - 1) : 300;

  console.log(
    `\n🔌 PHASE 2 — WEBSOCKET SWARM (${participants.length} connections, batch=${opts.wsBatch}` +
      (rampMs > 0 ? `, ramp=${(rampMs / 1000).toFixed(0)}s` : ", instant") +
      `)`,
  );

  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * opts.wsBatch;
    const end = Math.min(start + opts.wsBatch, participants.length);
    const batchParticipants = participants.slice(start, end);

    const results = await Promise.all(
      batchParticipants.map((p) => connectSocket(url, p, metrics, opts))
    );

    for (const r of results) {
      if (r) sockets.push(r);
    }

    const pct = Math.round((end / participants.length) * 100);
    process.stdout.write(
      `\r   🟢 Connected: ${metrics.wsConnected}/${participants.length} (${pct}%) | Failed: ${metrics.wsConnectFail}`
    );

    if (batch < totalBatches - 1) {
      const jitter = 0.75 + Math.random() * 0.5;
      await sleep(Math.round(perBatchDelay * jitter));
    }
  }

  console.log();
  return sockets;
}

// ─── PHASE 4: CHAOS BARRAGE ──────────────────────────────────────
function startChaosBarrage(sockets, metrics, intervalMs) {
  if (sockets.length === 0) return null;

  console.log(`\n💥 PHASE 4 — CHAOS BARRAGE (interval=${intervalMs}ms)`);

  const chaosActions = [
    // Bad slideId
    (sock) => {
      sock.socket.emit(
        "submit_response",
        { slideId: "000000000000000000000000", answer: "fake" },
        (ack) => {
          if (ack?.success === false) metrics.chaosErrors++;
        }
      );
    },
    // Duplicate vote (re-vote on already submitted slide)
    (sock) => {
      if (sock.submittedSlides.size > 0) {
        const slideId = [...sock.submittedSlides][0];
        sock.socket.emit(
          "submit_response",
          { slideId, answer: "duplicate" },
          (ack) => {
            if (ack?.success === false) metrics.chaosErrors++;
          }
        );
      }
    },
    // Ping flood
    (sock) => {
      sock.socket.emit("ping", { ts: Date.now() }, () => {});
    },
    // Malformed payload
    (sock) => {
      sock.socket.emit(
        "submit_response",
        { slideId: null, answer: undefined },
        (ack) => {
          if (ack?.success === false) metrics.chaosErrors++;
        }
      );
    },
    // Empty answer
    (sock) => {
      const slide = sock.getCurrentSlide();
      if (slide) {
        sock.socket.emit(
          "submit_response",
          { slideId: slide._id, answer: "" },
          (ack) => {
            if (ack?.success === false) metrics.chaosErrors++;
          }
        );
      }
    },
    // Giant string answer
    (sock) => {
      const slide = sock.getCurrentSlide();
      if (slide) {
        sock.socket.emit(
          "submit_response",
          { slideId: slide._id, answer: "X".repeat(10000) },
          (ack) => {
            if (ack?.success === false) metrics.chaosErrors++;
          }
        );
      }
    },
    // Rapid-fire pings (burst of 15)
    (sock) => {
      for (let i = 0; i < 15; i++) {
        sock.socket.emit("ping", { burst: i, ts: Date.now() }, (ack) => {
          if (ack?.success === false) metrics.chaosRateLimited++;
        });
      }
    },
  ];

  const interval = setInterval(() => {
    // Pick 10-30 random sockets and fire chaos
    const n = Math.min(sockets.length, 10 + Math.floor(Math.random() * 20));
    for (let i = 0; i < n; i++) {
      const sock = sockets[Math.floor(Math.random() * sockets.length)];
      const action = chaosActions[Math.floor(Math.random() * chaosActions.length)];
      metrics.chaosAttempts++;
      try {
        action(sock);
      } catch (_) {}
    }
  }, intervalMs);

  return interval;
}

// ─── LIVE DASHBOARD ───────────────────────────────────────────────
function startDashboard(metrics, sockets) {
  return setInterval(() => {
    const mem = process.memoryUsage();
    const elapsed = ((performance.now() - metrics._startTime) / 1000).toFixed(0);
    const activeSockets = sockets.filter((s) => s.socket.connected).length;

    process.stdout.write(
      `\r⏱ ${elapsed}s | 🟢 ${activeSockets} live | ` +
      `📡 ${metrics.stateUpdatesReceived} state_syncs | ` +
      `🗳 ${metrics.votesAttempted} votes (✅${metrics.votesAckedOk} ❌${metrics.votesAckedFail}) | ` +
      `🔄 ${metrics.slideChangesDetected} slide_Δ | ` +
      `💥 ${metrics.chaosAttempts} chaos | ` +
      `🧠 ${(mem.rss / 1024 / 1024).toFixed(0)}MB   `
    );
  }, 1500);
}

// ─── MAIN ─────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  if (opts.help) {
    console.log(`
Usage: node stress-test.js --code <PIN> [options]

Options:
  --code <pin>            Session join code (REQUIRED)
  --count <n>             Participant count (default: 1500)
  --url <http://...>      Server URL (default: $MENTI_URL, else 127.0.0.1:$MENTI_PORT)
  --batch <n>             HTTP join concurrency (default: 50)
  --ws-batch <n>          WebSocket connection concurrency (default: 100)
  --chaos                 Enable chaos barrage
  --chaos-interval <ms>   Chaos interval (default: 2000)
  --vote-delay <ms>       Uniform random delay before voting; overrides think time
  --ramp <ms>             Window over which participants arrive (default: 45000)
  --think-min <ms>        Fastest realistic answer time (default: 1500)
  --think-max <ms>        Slowest realistic answer time (default: 12000)
  --instant               Disable ramp and think time — everyone at once (worst case)
  --help                  Show help

Pacing:
  By default participants arrive spread over --ramp and answer after a
  log-normal think time between --think-min and --think-max, scaled up for
  slides that require typing. This mimics a real audience. Use --instant for
  the synthetic thundering-herd case.
    `);
    process.exit(0);
  }

  if (!opts.code) {
    console.error("❌ Missing --code <PIN>. Use --help for usage.");
    process.exit(1);
  }

  const metrics = new Metrics();

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  🔥 MENTIMETER HARDCORE STRESS TEST");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Server:      ${opts.url}`);
  console.log(`  Join Code:   ${opts.code}`);
  console.log(`  Participants: ${opts.count}`);
  console.log(`  HTTP Batch:  ${opts.batch}`);
  console.log(`  WS Batch:    ${opts.wsBatch}`);
  console.log(`  Chaos:       ${opts.chaos ? "ENABLED 💥" : "disabled"}`);
  /* The banner used to advertise only --vote-delay, which is 0 by default —
   * making a paced run look like it would fire everything at once. Show what is
   * actually in effect. */
  console.log(
    `  Arrival ramp: ${opts.rampMs > 0 ? `${(opts.rampMs / 1000).toFixed(0)}s` : "instant"}`,
  );
  console.log(
    `  Think time:  ${
      opts.voteDelay > 0
        ? `0-${opts.voteDelay}ms (uniform, --vote-delay)`
        : opts.thinkMaxMs > 0
          ? `${opts.thinkMinMs}-${opts.thinkMaxMs}ms (log-normal)`
          : "instant"
    }`,
  );
  console.log(
    `  NOTE: participants only vote once the presenter takes the session LIVE`,
  );
  console.log("═══════════════════════════════════════════════════════════");

  // ─── PHASE 1: Join ──────────────────────────────────────
  const participants = await joinAllParticipants(
    opts.url,
    opts.code,
    opts.count,
    opts.batch,
    metrics,
    opts,
  );

  if (participants.length === 0) {
    console.error("\n❌ No participants joined. Is the server running? Is the code correct?");
    process.exit(1);
  }

  console.log(`\n   📊 Joined ${participants.length}/${opts.count} participants`);

  // ─── PHASE 2: Connect WebSockets ────────────────────────
  const sockets = await connectAllSockets(opts.url, participants, metrics, opts);

  if (sockets.length === 0) {
    console.error("\n❌ No WebSocket connections established.");
    process.exit(1);
  }

  console.log(`\n   📊 ${sockets.length} WebSocket connections established`);

  // ─── PHASE 3: Wait for slide changes (automatic) ────────
  console.log("\n👂 PHASE 3 — LISTENING FOR STATE CHANGES");
  console.log("   Navigate slides on the presenter screen. All participants will vote instantly.");
  console.log("   Press Ctrl+C to stop and see the final report.\n");

  // ─── PHASE 4: Chaos (optional) ──────────────────────────
  let chaosInterval = null;
  if (opts.chaos) {
    chaosInterval = startChaosBarrage(sockets, metrics, opts.chaosInterval);
  }

  // ─── Live Dashboard ─────────────────────────────────────
  const dashboardInterval = startDashboard(metrics, sockets);

  // ─── Graceful Shutdown ──────────────────────────────────
  const shutdown = () => {
    console.log("\n\n🛑 Shutting down...");

    clearInterval(dashboardInterval);
    if (chaosInterval) clearInterval(chaosInterval);

    // Disconnect all sockets
    let disconnected = 0;
    for (const s of sockets) {
      try {
        s.socket.disconnect();
        disconnected++;
      } catch (_) {}
    }
    console.log(`   Disconnected ${disconnected} sockets`);

    // Final report
    const report = metrics.summary();
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("  📋 FINAL STRESS TEST REPORT");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(JSON.stringify(report, null, 2));
    console.log("═══════════════════════════════════════════════════════════\n");

    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep alive — the script lives until Ctrl+C
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("\n❌ Stress test crashed:", err.stack || err.message);
  process.exit(1);
});
