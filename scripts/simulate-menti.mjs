#!/usr/bin/env node
/**
 * Menti Load Simulator
 *
 * Usage:
 *   node scripts/simulate-menti.mjs <CODE> [options]
 *
 * Options:
 *   --users N            virtual participants (default 50)
 *   --url URL            menti API base (default http://localhost:4080)
 *   --delay MS           gap between spawning users (default 50)
 *   --miss-rate F        fraction who never answer a quiz question (default 0.08)
 *   --min-reaction MS    fastest quiz reaction (default 500)
 *   --reaction-spread F  quiz answers land within this fraction of the window
 *                        (default 0.75 — lower clusters answers earlier)
 *
 * Each virtual user:
 *   1. Joins the session via REST
 *   2. Connects via Socket.io
 *   3. Waits for slides and auto-answers based on type
 *      - BAR_GRAPH (single)    → random single option
 *      - BAR_GRAPH (multi)     → 1–3 random options
 *      - WORD_CLOUD (single)   → 1 random word
 *      - WORD_CLOUD (unlimited)→ 10–15 random words, one every 2–5 s
 *      - SCALES                → random rating in configured range
 *      - RANKING               → a shuffled full permutation of the items
 *      - QUIZ                  → waits out the countdown, then answers after its
 *                                own reaction delay, so scores spread out
 *      - LEADERBOARD / CONTENT → no input
 *
 * Quiz notes:
 *   Bots cannot see which answer is correct (the server withholds `isCorrect`
 *   from participants), so they guess — accuracy lands near 1/numOptions, which
 *   is what a real cold audience looks like. The submit ack returns the verdict,
 *   so the script prints its own expected leaderboard to compare against the
 *   presenter screen.
 */

import { io } from "socket.io-client";
import readline from "readline";

// ─── helpers ────────────────────────────────────────────────────────────────

const WORD_POOL = [
  "innovation", "teamwork", "design", "speed", "quality", "collaboration",
  "strategy", "growth", "impact", "clarity", "agility", "focus", "trust",
  "data", "insight", "scale", "learning", "passion", "vision", "culture",
  "async", "sync", "deploy", "pipeline", "metrics", "feedback", "iterative",
  "prototype", "launch", "pivot", "user", "product", "roadmap", "sprint",
  "kanban", "backlog", "standup", "retro", "demo", "ship", "refactor",
];

const ADJECTIVES = ["fast", "slow", "creative", "brilliant", "average", "happy"];
const NOUNS     = ["cat", "dog", "tree", "cloud", "river", "mountain", "keyboard"];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function randomNickname(i) {
  return `Bot_${randFrom(ADJECTIVES)}_${randFrom(NOUNS)}_${i}`;
}

function randomWord() { return randFrom(WORD_POOL); }

function buildAnswer(slide) {
  const type = slide.type;

  if (type === "QUIZ") {
    // Bots cannot know the right answer: the server strips `isCorrect` from the
    // participant channel, so they guess like a real audience would.
    const opts = slide.options || [];
    if (opts.length === 0) return null;
    return [opts[randInt(0, opts.length - 1)].id];
  }

  if (type === "RANKING") {
    // A full permutation, shuffled — the server rejects partial rankings.
    const opts = slide.options || [];
    if (opts.length === 0) return null;
    return [...opts].sort(() => Math.random() - 0.5).map((o) => o.id);
  }

  if (type === "BAR_GRAPH" || type === "select") {
    const opts = slide.options || [];
    if (opts.length === 0) return null;
    return opts[randInt(0, opts.length - 1)].id;   // single option id (string)
  }

  if (type === "multi_select") {
    const opts = slide.options || [];
    if (opts.length === 0) return null;
    const count = Math.min(randInt(1, 3), opts.length);
    const shuffled = [...opts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(o => o.id);  // array of ids
  }

  if (type === "WORD_CLOUD" || type === "text") {
    // single submission: one word
    return randomWord();
  }

  if (type === "multi_text") {
    // up to 5 words per submission (server hard-caps at 5)
    return Array.from({ length: randInt(1, 3) }, randomWord);
  }

  if (type === "SCALES" || type === "rating") {
    const min = slide.responseSettings?.minRating ?? 1;
    const max = slide.responseSettings?.maxRating ?? 5;
    return randInt(min, max);   // plain number
  }

  return null;
}

// ─── stats ──────────────────────────────────────────────────────────────────

const stats = {
  joined: 0,
  connected: 0,
  errors: 0,
  submitted: 0,
  latencies: [],
  byType: {},
  slidesSeen: new Set(),
  // Quiz-specific: the ack tells each bot whether it was right and what it
  // scored, so the script can tally an independent leaderboard to compare
  // against what the presenter screen shows.
  quiz: {
    answered: 0,
    correct: 0,
    wrong: 0,
    missed: 0,
    tooLate: 0,
    tooEarly: 0,
    points: 0,
    reactionMs: [],
    scores: new Map(), // nickname -> { points, correct, answered }
  },
};

function recordQuizResult(nickname, res) {
  const q = stats.quiz;
  q.answered++;
  if (res.isCorrect) q.correct++;
  else q.wrong++;
  q.points += Number(res.pointsAwarded ?? 0);
  if (typeof res.responseTimeMs === "number") q.reactionMs.push(res.responseTimeMs);

  const row = q.scores.get(nickname) ?? { points: 0, correct: 0, answered: 0 };
  row.points += Number(res.pointsAwarded ?? 0);
  row.correct += res.isCorrect ? 1 : 0;
  row.answered += 1;
  q.scores.set(nickname, row);
}

function recordLatency(ms) { stats.latencies.push(ms); }

function printStats(label = "") {
  const lats = stats.latencies;
  const avg  = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;
  const p95  = lats.length
    ? Math.round([...lats].sort((a, b) => a - b)[Math.floor(lats.length * 0.95)] ?? 0)
    : 0;

  const typeStr = Object.entries(stats.byType)
    .map(([t, n]) => `${t}=${n}`)
    .join("  ");

  const q = stats.quiz;
  const quizStr = q.answered > 0
    ? `  quiz[ok=${q.correct} x=${q.wrong} miss=${q.missed} late=${q.tooLate} pts=${q.points}]`
    : "";

  process.stdout.write(
    `\r${label}  ` +
    `joined=${stats.joined}  connected=${stats.connected}  ` +
    `submitted=${stats.submitted}  errors=${stats.errors}  ` +
    `avg=${avg}ms  p95=${p95}ms  ` +
    `[${typeStr}]${quizStr}         `
  );
}

/** Independent tally from the acks, to cross-check the presenter's leaderboard. */
function printQuizSummary() {
  const q = stats.quiz;
  if (q.answered === 0 && q.missed === 0) return;

  console.log("\nQuiz results (from server acks):");
  console.log(`  answered   : ${q.answered}`);
  console.log(`  correct    : ${q.correct}`);
  console.log(`  wrong      : ${q.wrong}`);
  console.log(`  never answered : ${q.missed}`);
  if (q.tooLate > 0)  console.log(`  rejected (too late)  : ${q.tooLate}`);
  if (q.tooEarly > 0) console.log(`  rejected (too early) : ${q.tooEarly}`);

  if (q.reactionMs.length) {
    const sorted = [...q.reactionMs].sort((a, b) => a - b);
    const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    console.log(
      `  response time : min ${(sorted[0] / 1000).toFixed(1)}s  ` +
      `p50 ${(at(0.5) / 1000).toFixed(1)}s  ` +
      `max ${(sorted[sorted.length - 1] / 1000).toFixed(1)}s`,
    );
  }

  const board = [...q.scores.entries()]
    .map(([nickname, row]) => ({ nickname, ...row }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  if (board.length) {
    console.log("\n  Expected leaderboard (top 10) — compare with the presenter screen:");
    board.forEach((row, i) => {
      console.log(
        `    ${String(i + 1).padStart(2)}. ${row.nickname.padEnd(28)} ` +
        `${String(row.points).padStart(6)} pts  (${row.correct}/${row.answered} correct)`,
      );
    });
  }
}

// ─── per-user logic ──────────────────────────────────────────────────────────

async function joinSession(code, nickname, apiUrl) {
  const res = await fetch(`${apiUrl}/api/sessions/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json();   // { participantToken, participantId, session }
}

/**
 * Local delay before submitting a quiz answer.
 *
 * The target is expressed on the SERVER's clock (answers open at
 * questionStartedAt + countdown), so the local wait subtracts the measured clock
 * offset. Getting this wrong is the difference between a scored answer and a
 * "not open yet" / "Time is up" rejection.
 */
function quizAnswerDelayMs({ startedAt, countdownMs, reactionMs, serverOffsetMs, now = Date.now() }) {
  const opensAt = new Date(startedAt).getTime() + countdownMs;
  return Math.max(0, opensAt + reactionMs - (now + serverOffsetMs));
}

/** Tunables for quiz realism, overridable from the CLI. */
const quizConfig = {
  /** Fraction of bots that let a question time out without answering. */
  missRate: 0.08,
  /** Fastest a bot ever reacts once answers open. */
  minReactionMs: 500,
  /** Bots react within this fraction of the answering window. */
  reactionSpread: 0.75,
};

async function runUser(index, code, apiUrl) {
  const nickname = randomNickname(index);

  // 1. Join via REST
  let joinData;
  try {
    joinData = await joinSession(code, nickname, apiUrl);
    stats.joined++;
  } catch (err) {
    stats.errors++;
    console.error(`\n[user ${index}] join failed: ${err.message}`);
    return;
  }

  const { participantToken } = joinData;

  // Per-user state
  const answeredSlides = new Set();       // slideId → answered at least once
  const wordCloudTimers = new Map();      // slideId → interval handle
  const quizRounds = new Set();           // "slideId:startedAt" → scheduled
  /** serverClock - localClock, so answer timing is measured on the server's clock. */
  let serverOffsetMs = 0;

  function stopWordCloudTimer(slideId) {
    if (wordCloudTimers.has(slideId)) {
      clearInterval(wordCloudTimers.get(slideId));
      wordCloudTimers.delete(slideId);
    }
  }

  // 2. Connect socket
  const socket = io(apiUrl, {
    query: { token: participantToken },
    reconnection: false,
    transports: ["websocket"],
  });

  socket.on("connect", () => { stats.connected++; });
  socket.on("disconnect", () => { stats.connected = Math.max(0, stats.connected - 1); });
  socket.on("connect_error", (err) => {
    stats.errors++;
    console.error(`\n[user ${index}] socket error: ${err.message}`);
  });

  // 3. React to state changes
  socket.on("session_state_sync", async (state) => {
    // Correct for clock skew the same way the real client does.
    if (typeof state.serverNow === "number") {
      serverOffsetMs = state.serverNow - Date.now();
    }

    const slide = state.currentSlide;
    if (!slide) return;
    if (state.session?.status !== "live") return;
    if (state.session?.isVotingLocked) return;

    const slideId = slide._id || slide.id;
    if (!slideId) return;

    stats.slidesSeen.add(slideId);

    // Leaderboard slides take no input.
    if (slide.type === "LEADERBOARD" || slide.type === "CONTENT") return;

    /*
     * Quiz rounds are timed. Answering during the countdown is refused, so each
     * bot waits for the window to open and then reacts after its own delay —
     * which is what produces a spread of scores instead of everyone tying.
     *
     * Keyed on the start instant too, so a host re-running a question (or the
     * host revisiting it) is treated as a fresh round rather than skipped.
     */
    if (slide.type === "QUIZ") {
      const startedAt = state.session?.questionStartedAt;
      if (!startedAt) return;

      const roundKey = `${slideId}:${startedAt}`;
      if (quizRounds.has(roundKey)) return;
      quizRounds.add(roundKey);

      const countdownMs = (slide.responseSettings?.countdownSeconds ?? 5) * 1000;
      const limitMs = (slide.responseSettings?.timeLimitSeconds ?? 20) * 1000;

      // Some of the audience simply never answers.
      if (Math.random() < quizConfig.missRate) {
        stats.quiz.missed++;
        return;
      }

      const reactionMs = randInt(
        quizConfig.minReactionMs,
        Math.max(quizConfig.minReactionMs + 1, Math.floor(limitMs * quizConfig.reactionSpread)),
      );

      const fireInMs = quizAnswerDelayMs({
        startedAt,
        countdownMs,
        reactionMs,
        serverOffsetMs,
      });

      setTimeout(() => submitAnswer(socket, slideId, slide, index, nickname), fireInMs);
      return;
    }

    // Stop any ongoing word-cloud timer for slides we're no longer on
    for (const [sid] of wordCloudTimers) {
      if (sid !== slideId) stopWordCloudTimer(sid);
    }

    const isUnlimitedWordCloud = Boolean(
      (slide.type === "WORD_CLOUD" || slide.type === "multi_text") &&
      (slide.responseSettings?.multipleSubmissions === true ||
       slide.responseSettings?.maxEntriesPerParticipant === 0)
    );

    // For unlimited word clouds, start a repeating submission timer
    if (isUnlimitedWordCloud && !wordCloudTimers.has(slideId)) {
      let remaining = randInt(10, 15);

      const submitWord = () => {
        if (remaining <= 0 || state.session?.status !== "live" || state.session?.isVotingLocked) {
          stopWordCloudTimer(slideId);
          return;
        }
        remaining--;
        submitAnswer(socket, slideId, slide, index);
      };

      // Stagger the start so all users don't burst at once
      await sleep(randInt(200, 2000));
      submitWord();
      const handle = setInterval(submitWord, randInt(2000, 5000));
      wordCloudTimers.set(slideId, handle);
      return;
    }

    // For every other type: submit once per slide (with random human-like delay)
    if (!answeredSlides.has(slideId)) {
      answeredSlides.add(slideId);
      await sleep(randInt(300, 3000));
      submitAnswer(socket, slideId, slide, index, nickname);
    }
  });
}

function submitAnswer(socket, slideId, slide, index, nickname) {
  const answer = buildAnswer(slide);
  if (answer === null) return;

  const type = slide.type;
  const t0   = Date.now();

  socket.emit("submit_response", { slideId, answer }, (res) => {
    const ms = Date.now() - t0;
    if (res?.error) {
      const msg = String(res.error);

      // Expected refusals in a timed game — counted, not treated as failures.
      if (msg.includes("already submitted")) return;
      if (msg.includes("Time is up")) { stats.quiz.tooLate++; return; }
      if (msg.includes("not open yet") || msg.includes("has not started")) {
        stats.quiz.tooEarly++;
        return;
      }

      stats.errors++;
      console.error(`\n[user ${index}][${type}] submit error: ${msg}`);
      return;
    }

    stats.submitted++;
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    recordLatency(ms);

    // Quiz acks carry the verdict, so the script can score itself.
    if (typeof res?.isCorrect === "boolean") {
      recordQuizResult(nickname, res);
    }
  });
}

// ─── self test ──────────────────────────────────────────────────────────────

/**
 * Offline checks for the answer shapes and quiz timing, so the script can be
 * validated without a running session:  node scripts/simulate-menti.mjs --self-test
 */
function selfTest() {
  let failures = 0;
  const check = (ok, label, detail = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  };

  const opts = ["a", "b", "c", "d"].map((id) => ({ id, label: id.toUpperCase() }));
  const quizSettings = { countdownSeconds: 5, timeLimitSeconds: 20, basePoints: 1000 };

  console.log("— answer shapes —");

  const quizAnswer = buildAnswer({ type: "QUIZ", options: opts, responseSettings: quizSettings });
  check(
    Array.isArray(quizAnswer) && quizAnswer.length === 1 && opts.some((o) => o.id === quizAnswer[0]),
    "QUIZ answers with a single valid option id",
    JSON.stringify(quizAnswer),
  );

  // Guessing should spread across the options, not fixate on one.
  const picks = new Set();
  for (let i = 0; i < 200; i++) {
    picks.add(buildAnswer({ type: "QUIZ", options: opts, responseSettings: quizSettings })[0]);
  }
  check(picks.size === opts.length, "QUIZ guesses cover every option", `${picks.size}/${opts.length}`);

  const ranking = buildAnswer({ type: "RANKING", options: opts });
  check(
    ranking.length === opts.length && new Set(ranking).size === opts.length,
    "RANKING answers with a complete permutation (server rejects partials)",
    JSON.stringify(ranking),
  );

  let sawReorder = false;
  for (let i = 0; i < 50; i++) {
    const r = buildAnswer({ type: "RANKING", options: opts });
    if (r.join(",") !== opts.map((o) => o.id).join(",")) sawReorder = true;
  }
  check(sawReorder, "RANKING actually shuffles rather than echoing input order");

  check(
    typeof buildAnswer({ type: "BAR_GRAPH", options: opts }) === "string",
    "BAR_GRAPH answers with a single id string",
  );
  check(
    Array.isArray(buildAnswer({ type: "multi_select", options: opts })),
    "multi_select answers with an array",
  );
  check(
    typeof buildAnswer({ type: "WORD_CLOUD", options: [] }) === "string",
    "WORD_CLOUD answers with a word",
  );
  const rating = buildAnswer({
    type: "SCALES",
    options: [],
    responseSettings: { minRating: 1, maxRating: 5 },
  });
  check(
    Number.isInteger(rating) && rating >= 1 && rating <= 5,
    "SCALES answers with an in-range integer",
    String(rating),
  );
  check(buildAnswer({ type: "QUIZ", options: [] }) === null, "no options -> no answer");

  console.log("\n— quiz timing —");

  const now = 1_700_000_000_000;
  const startedAt = new Date(now).toISOString();
  const countdownMs = 5000;
  const limitMs = 20_000;

  check(
    quizAnswerDelayMs({ startedAt, countdownMs, reactionMs: 2000, serverOffsetMs: 0, now }) === 7000,
    "waits out the countdown, then the reaction delay (5s + 2s)",
  );
  check(
    quizAnswerDelayMs({ startedAt, countdownMs, reactionMs: 0, serverOffsetMs: 0, now }) === 5000,
    "an instant reactor still waits for answers to open",
  );
  // A device whose clock lags the server must wait less in local terms.
  check(
    quizAnswerDelayMs({ startedAt, countdownMs, reactionMs: 2000, serverOffsetMs: 3000, now }) === 4000,
    "clock skew is corrected (server 3s ahead -> wait 3s less)",
  );
  check(
    quizAnswerDelayMs({ startedAt, countdownMs, reactionMs: 1000, serverOffsetMs: 0, now: now + 60_000 }) === 0,
    "a round already past its window fires immediately (server will refuse it)",
  );

  // Every reaction the config can produce must land inside the answering window.
  let outside = 0;
  for (let i = 0; i < 5000; i++) {
    const reactionMs = randInt(
      quizConfig.minReactionMs,
      Math.max(quizConfig.minReactionMs + 1, Math.floor(limitMs * quizConfig.reactionSpread)),
    );
    const delay = quizAnswerDelayMs({ startedAt, countdownMs, reactionMs, serverOffsetMs: 0, now });
    const msSinceOpen = now + delay - (now + countdownMs);
    if (msSinceOpen < 0 || msSinceOpen > limitMs) outside++;
  }
  check(outside === 0, "every generated reaction lands inside the answering window", `${outside} outside`);

  // Reaction times must actually vary, or every bot ties on points.
  const spread = new Set();
  for (let i = 0; i < 500; i++) {
    spread.add(
      randInt(
        quizConfig.minReactionMs,
        Math.max(quizConfig.minReactionMs + 1, Math.floor(limitMs * quizConfig.reactionSpread)),
      ),
    );
  }
  check(spread.size > 100, "reaction times vary widely (scores will spread)", `${spread.size} distinct`);

  console.log(failures === 0 ? "\nSimulator self-test passed." : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--self-test")) return selfTest();

  let code = null;
  let userCount = 50;
  let apiUrl = "http://localhost:4080";
  let spawnDelay = 50;  // ms between spawning each user (avoid thundering herd on join)

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--users" || args[i] === "-n") userCount = parseInt(args[++i], 10);
    else if (args[i] === "--url")  apiUrl    = args[++i];
    else if (args[i] === "--delay") spawnDelay = parseInt(args[++i], 10);
    else if (args[i] === "--miss-rate") quizConfig.missRate = Number(args[++i]);
    else if (args[i] === "--min-reaction") quizConfig.minReactionMs = parseInt(args[++i], 10);
    else if (args[i] === "--reaction-spread") quizConfig.reactionSpread = Number(args[++i]);
    else if (!code) code = args[i].toUpperCase().trim();
  }

  if (!code) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    code = await new Promise(resolve =>
      rl.question("Enter session code: ", ans => { rl.close(); resolve(ans.toUpperCase().trim()); })
    );
  }

  if (!code) { console.error("No session code provided."); process.exit(1); }

  console.log(`\n🚀  Simulating ${userCount} users → session ${code} @ ${apiUrl}`);
  console.log(`    Spawn delay: ${spawnDelay}ms between users\n`);
  console.log("    Waiting for the host to start the presentation…\n");

  // Spawn users with a staggered delay to avoid hammering the join endpoint
  for (let i = 0; i < userCount; i++) {
    runUser(i, code, apiUrl).catch(() => {});
    if (spawnDelay > 0 && i < userCount - 1) await sleep(spawnDelay);
  }

  // Live stats line
  const ticker = setInterval(() => printStats("📊"), 500);

  // Graceful exit on Ctrl-C
  process.on("SIGINT", () => {
    clearInterval(ticker);
    printStats("📊 final");
    console.log("\n\n✅  Simulation stopped.\n");

    const lats = [...stats.latencies].sort((a, b) => a - b);
    if (lats.length) {
      console.log("Submit latency breakdown:");
      console.log(`  min  : ${lats[0]} ms`);
      console.log(`  p50  : ${lats[Math.floor(lats.length * 0.50)]} ms`);
      console.log(`  p95  : ${lats[Math.floor(lats.length * 0.95)]} ms`);
      console.log(`  p99  : ${lats[Math.floor(lats.length * 0.99)]} ms`);
      console.log(`  max  : ${lats[lats.length - 1]} ms`);
    }
    console.log(`\nSlides seen : ${stats.slidesSeen.size}`);
    console.log(`By type     :`, stats.byType);

    printQuizSummary();
    process.exit(0);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
