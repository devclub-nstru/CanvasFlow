import crypto from "crypto";
import process from "node:process";
import { performance } from "node:perf_hooks";
import { connectMongo } from "./src/core/database/connect.js";
import env from "./src/core/env/env.js";
import {
  User,
  Presentation,
  Slide,
  Session,
  Participant,
  Response,
} from "./src/core/database/models/index.js";
import { syncer } from "./realtime/syncer.js";

const FIRST_NAMES = [
  "Alex",
  "Jordan",
  "Taylor",
  "Morgan",
  "Sam",
  "Riley",
  "Casey",
  "Avery",
  "Logan",
  "Parker",
  "Quinn",
  "Cameron",
  "Dakota",
  "Reese",
  "Rowan",
  "Hayden",
  "Skyler",
  "Jesse",
  "Finley",
  "Emerson",
  "Adrian",
  "Kai",
  "Charlie",
  "Peyton",
  "Kendall",
  "River",
  "Dallas",
  "Harper",
  "Rory",
  "Sawyer",
  "Elliot",
  "Micah",
  "Noah",
  "Liam",
  "Emma",
  "Olivia",
  "Ava",
  "Sophia",
  "Jackson",
  "Lucas",
  "Mia",
  "Ethan",
  "Aria",
  "Leo",
  "Maya",
  "Zoe",
  "Oliver",
  "Elijah",
  "Luna",
];

const WORD_CLOUD_VOCABULARY = [
  "Innovation",
  "Speed",
  "Scalability",
  "Clean",
  "Intuitive",
  "Modern",
  "Awesome",
  "Productive",
  "Collaborative",
  "Fast",
  "Interactive",
  "Futuristic",
  "Impact",
  "Delightful",
  "Smooth",
  "Creative",
  "Dynamic",
  "Powerful",
  "Minimal",
  "Engaging",
  "Realtime",
  "Efficient",
  "Polished",
  "Simple",
  "NextGen",
  "Reliable",
  "Elegant",
  "Agile",
  "Visionary",
  "Smart",
  "Fastest",
  "Reliable",
  "Elegant",
  "Bold",
  "Flexible",
  "Stable",
  "Impressive",
  "Momentum",
  "Brilliant",
  "Vision",
  "Focus",
  "Fluid",
  "Adaptive",
  "Bright",
];

const BAR_OPTIONS = [
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "Option E",
  "Option F",
];

function printHelp() {
  console.log(`
E2E Stress Harness for Mentimeter-like sessions

Usage:
  node simulate-audience.js --count 5000 --slides 6
  node simulate-audience.js --count 15000 --slides 8 --mode local
  node simulate-audience.js --count 1000 --slides 5 --seed mySession

Options:
  --count <n>          Number of participants to simulate (default: 5000)
  --slides <n>         Number of generated question slides (default: 6)
  --mode <local|remote> Force local DB or remote HTTP mode (default: local)
  --url <http://...>  Optional remote API URL when using remote mode
  --seed <text>        Basename for session and presentation titles
  --create-only        Build the presentation/session but skip heavy response generation
  --help               Show this help text

Behavior:
  - Creates a fresh presentation + slides + live session automatically
  - Injects participant records and response data in bulk for maximum throughput
  - Tracks elapsed wall time, memory usage, peak RSS, heap peaks, and throughput
  - Prints a final machine-readable summary
`);
}

function parseArgs(argv) {
  const parsed = {
    count: 5000,
    slides: 6,
    mode: "local",
    url: null,
    seed: `e2e-${Date.now()}`,
    createOnly: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--count":
        parsed.count = Math.max(1, Number.parseInt(argv[++i] || "5000", 10));
        break;
      case "--slides":
        parsed.slides = Math.max(1, Number.parseInt(argv[++i] || "6", 10));
        break;
      case "--mode":
        parsed.mode = (argv[++i] || "local").toLowerCase();
        break;
      case "--url":
        parsed.url = argv[++i] || null;
        break;
      case "--seed":
        parsed.seed = argv[++i] || parsed.seed;
        break;
      case "--create-only":
        parsed.createOnly = true;
        break;
      case "--help":
        parsed.help = true;
        break;
      default:
        if (!arg.startsWith("--")) {
          parsed.seed = arg;
        }
        break;
    }
  }

  return parsed;
}

function getRandomNickname(index) {
  const name = FIRST_NAMES[index % FIRST_NAMES.length];
  const num = Math.floor(100 + Math.random() * 900);
  return `${name}_${num}`;
}

function randomGaussian(min, max, meanRatio = 0.72, spread = 0.18) {
  const range = max - min;
  const targetMean = min + range * meanRatio;
  const stdDev = range * spread;
  const u1 = Math.max(1e-6, Math.random());
  const u2 = Math.random();
  const randStdNormal =
    Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const randVal = Math.round(targetMean + stdDev * randStdNormal);
  return Math.max(min, Math.min(max, randVal));
}

function pickWeighted(options) {
  if (!options || options.length === 0) return null;
  const weights = options.map((_, i) => Math.exp(-0.45 * i) + 0.15);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < options.length; i++) {
    random -= weights[i];
    if (random <= 0) return options[i];
  }
  return options[0];
}

function generateSlideAnswer(slide) {
  if (slide.type === "BAR_GRAPH") {
    const options = slide.options || [];
    if (options.length === 0) return null;
    const chosen = pickWeighted(options);
    return { type: "select", answer: { optionIds: [chosen.id] } };
  }

  if (slide.type === "WORD_CLOUD") {
    const numWords = Math.random() < 0.65 ? 1 : 2;
    const chosenWords = [];
    for (let w = 0; w < numWords; w++) {
      chosenWords.push(pickWeighted(WORD_CLOUD_VOCABULARY));
    }
    return {
      type: "text",
      answer: { text: chosenWords.join(", "), raw: chosenWords },
    };
  }

  if (slide.type === "SCALES") {
    const min = slide.responseSettings?.minRating ?? 1;
    const max = slide.responseSettings?.maxRating ?? 5;
    const rating = randomGaussian(min, max, 0.75, 0.18);
    return { type: "rating", answer: { rating, raw: rating } };
  }

  return null;
}

async function createOwner(seed) {
  const externalId = `e2e-${seed}-${crypto.randomUUID()}`;
  const owner = await User.findOneAndUpdate(
    { externalId },
    { $setOnInsert: { externalId, name: `E2E ${seed}` } },
    { upsert: true, new: true },
  );
  return owner;
}

function buildSlideDefinitions(seed, totalSlides) {
  const slides = [];
  const baseTypes = [
    "BAR_GRAPH",
    "WORD_CLOUD",
    "SCALES",
    "BAR_GRAPH",
    "WORD_CLOUD",
    "SCALES",
  ];

  for (let i = 0; i < totalSlides; i++) {
    const type = baseTypes[i % baseTypes.length];

    if (type === "BAR_GRAPH") {
      slides.push({
        type,
        position: i,
        question: `${seed} - Favorite option ${i + 1}`,
        description: "Which option do you prefer?",
        visualizationType: "BAR",
        options: BAR_OPTIONS.map((label, optionIndex) => ({
          id: `opt-${i}-${optionIndex}`,
          label,
          isCorrect: false,
          color: [
            "#3B82F6",
            "#10B981",
            "#F59E0B",
            "#EF4444",
            "#8B5CF6",
            "#14B8A6",
          ][optionIndex],
          voteCount: 0,
        })),
      });
    } else if (type === "WORD_CLOUD") {
      slides.push({
        type,
        position: i,
        question: `${seed} - What is your one-word reaction?`,
        description: "Write the fastest word that matches your feeling.",
        options: [],
        responseSettings: { maxEntriesPerParticipant: 2 },
      });
    } else {
      slides.push({
        type,
        position: i,
        question: `${seed} - Rate the experience`,
        description: "Score the experience from low to high.",
        options: [
          { id: "rate-1", label: "1", voteCount: 0 },
          { id: "rate-2", label: "2", voteCount: 0 },
          { id: "rate-3", label: "3", voteCount: 0 },
          { id: "rate-4", label: "4", voteCount: 0 },
          { id: "rate-5", label: "5", voteCount: 0 },
        ],
        responseSettings: { minRating: 1, maxRating: 5 },
      });
    }
  }

  return slides;
}

function getMemorySnapshot() {
  const used = process.memoryUsage();
  return {
    rss: used.rss,
    heapTotal: used.heapTotal,
    heapUsed: used.heapUsed,
    external: used.external,
    arrayBuffers: used.arrayBuffers,
  };
}

function createMetricsTracker() {
  const cpuStart = process.cpuUsage();
  const start = performance.now();
  let maxRss = 0;
  let maxHeapUsed = 0;
  let maxHeapTotal = 0;
  let peakExternal = 0;
  const samples = [];

  const record = () => {
    const snap = getMemorySnapshot();
    maxRss = Math.max(maxRss, snap.rss);
    maxHeapUsed = Math.max(maxHeapUsed, snap.heapUsed);
    maxHeapTotal = Math.max(maxHeapTotal, snap.heapTotal);
    peakExternal = Math.max(peakExternal, snap.external);
    samples.push({
      ts: performance.now() - start,
      rss: snap.rss,
      heapUsed: snap.heapUsed,
      heapTotal: snap.heapTotal,
      external: snap.external,
    });
  };

  return {
    record,
    getSummary: () => {
      const end = performance.now();
      const cpuEnd = process.cpuUsage(cpuStart);
      return {
        wallMs: end - start,
        cpuUserMs: cpuEnd.user,
        cpuSystemMs: cpuEnd.system,
        maxRssBytes: maxRss,
        maxHeapUsedBytes: maxHeapUsed,
        maxHeapTotalBytes: maxHeapTotal,
        peakExternalBytes: peakExternal,
        samples,
      };
    },
  };
}

async function createSessionAndSlidesWithMongo(seed, slideCount, owners = 1) {
  const [connection, error] = await connectMongo(env.MONGO_URI);
  if (error) {
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }

  const owner = await createOwner(seed);
  const presentation = await Presentation.create({
    ownerId: owner._id,
    title: `${seed} - E2E Stress Test`,
    status: "started",
    settings: {
      allowAnonymousParticipants: true,
      showResultsToParticipants: true,
    },
    metadata: {
      generatedBy: "simulate-audience.js",
      createdAt: new Date().toISOString(),
    },
  });

  const slideDefinitions = buildSlideDefinitions(seed, slideCount);
  const slides = [];

  for (const slideDef of slideDefinitions) {
    const created = await Slide.create({
      ...slideDef,
      presentationId: presentation._id,
    });
    slides.push(created);
  }

  const firstSlide =
    slides.find((slide) => slide.type !== "CONTENT") || slides[0];
  const sessionCode = await (async () => {
    const chars = "0123456789";
    let code = "";
    let tries = 0;
    while (tries < 50) {
      code = Array.from(
        { length: 6 },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join("");
      if (!(await Session.exists({ code }))) {
        return code;
      }
      tries++;
    }
    return Date.now().toString().slice(-6);
  })();

  const session = await Session.create({
    presentationId: presentation._id,
    presenterId: owner._id,
    code: sessionCode,
    status: "live",
    currentSlideId: firstSlide?._id || null,
    currentSlidePosition: firstSlide?.position ?? 0,
    settings: {
      allowLateJoining: true,
      allowAnonymousParticipants: true,
      showResults: true,
      showParticipantCount: true,
    },
    startedAt: new Date(),
    lastActivityAt: new Date(),
  });

  return { connection, owner, presentation, slides, session };
}

async function insertParticipantsForSession(
  sessionId,
  participantCount,
  connection,
) {
  const participantDocs = [];
  const participantIds = [];

  for (let i = 0; i < participantCount; i++) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const participantId = new connection.base.Types.ObjectId();
    participantDocs.push({
      _id: participantId,
      sessionId,
      nickname: getRandomNickname(i),
      tokenHash,
      status: "active",
      joinedAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    participantIds.push(participantId);
  }

  await Participant.insertMany(participantDocs, { ordered: false });
  return participantIds;
}

async function generateBulkResponsesForSlides(
  sessionId,
  presentationId,
  slideList,
  participantIds,
  metrics,
) {
  let totalResponses = 0;
  let lastProgress = 0;

  for (let slideIndex = 0; slideIndex < slideList.length; slideIndex++) {
    const slide = slideList[slideIndex];
    if (!slide || slide.type === "CONTENT") continue;

    const answers = [];
    const options = slide.options || [];

    for (let i = 0; i < participantIds.length; i++) {
      const payload = generateSlideAnswer({ ...slide, options });
      if (!payload) continue;

      const participantId = participantIds[i];
      answers.push({
        sessionId,
        presentationId,
        slideId: slide._id,
        participantId,
        type: payload.type,
        answer: payload.answer,
        commandId: crypto.randomUUID(),
        submittedAt: new Date(),
      });
    }

    if (answers.length > 0) {
      await Response.insertMany(answers, { ordered: false });
      totalResponses += answers.length;

      if (slide.type === "BAR_GRAPH") {
        const voteCounts = {};
        for (const option of slide.options || []) voteCounts[option.id] = 0;
        for (const item of answers) {
          const optionId = item.answer.optionIds[0];
          voteCounts[optionId] = (voteCounts[optionId] || 0) + 1;
        }
        await Slide.updateOne(
          { _id: slide._id },
          {
            $set: {
              options: (slide.options || []).map((opt) => ({
                ...opt,
                voteCount: (opt.voteCount || 0) + (voteCounts[opt.id] || 0),
              })),
            },
          },
        );
      }

      if (slide.type === "WORD_CLOUD") {
        const wordCounts = {};
        for (const item of answers) {
          const words = Array.isArray(item.answer.raw)
            ? item.answer.raw
            : [item.answer.text];
          for (const word of words) {
            const clean = String(word).trim();
            if (!clean) continue;
            wordCounts[clean] = (wordCounts[clean] || 0) + 1;
          }
        }
        const optionsOut = Object.entries(wordCounts).map(
          ([text, count], idx) => ({
            id: `word-${idx}-${text}`,
            label: text,
            voteCount: count,
          }),
        );
        await Slide.updateOne(
          { _id: slide._id },
          { $set: { options: optionsOut } },
        );
      }

      if (slide.type === "SCALES") {
        const min = slide.responseSettings?.minRating ?? 1;
        const max = slide.responseSettings?.maxRating ?? 5;
        const dist = {};
        for (let r = min; r <= max; r++) dist[r] = 0;
        for (const item of answers) {
          const rating = Number(item.answer.rating);
          if (Number.isFinite(rating)) {
            dist[rating] = (dist[rating] || 0) + 1;
          }
        }
        const transformed = Object.entries(dist).map(([r, value]) => ({
          id: `rate-${r}`,
          label: String(r),
          voteCount: value,
        }));
        await Slide.updateOne(
          { _id: slide._id },
          { $set: { options: transformed } },
        );
      }

      try {
        await syncer.broadcastSlideAnalytics(sessionId, slide._id, slide.type);
      } catch (_) {}
    }

    const progressPct = Math.round(((slideIndex + 1) / slideList.length) * 100);
    if (progressPct > lastProgress) {
      lastProgress = progressPct;
      process.stdout.write(
        `\r📈 Slide progress: ${progressPct}% | responses: ${totalResponses}`,
      );
    }
  }

  console.log();
  return totalResponses;
}

async function runLocalE2EStress({
  count,
  slides: slideCount,
  seed,
  createOnly,
}) {
  const metrics = createMetricsTracker();
  const timerStart = Date.now();
  const summary = {
    runType: "local-e2e",
    participantCount: count,
    slideCount: slideCount,
    seed,
    createdAt: new Date().toISOString(),
    status: "started",
  };

  console.log(`\n🧪 Starting local E2E stress run`);
  console.log(`👥 Participants: ${count}`);
  console.log(`📚 Slides: ${slideCount}`);
  console.log(`🧬 Seed: ${seed}\n`);

  const { connection, presentation, slides, session } =
    await createSessionAndSlidesWithMongo(seed, slideCount);
  console.log(
    `✅ Created presentation ${presentation._id} and session ${session.code}`,
  );

  if (createOnly) {
    const mem = getMemorySnapshot();
    const overall = {
      ...summary,
      status: "created-only",
      sessionCode: session.code,
      presentationId: presentation._id.toString(),
      sessionId: session._id.toString(),
      wallMs: Date.now() - timerStart,
      peakRssBytes: mem.rss,
      peakHeapUsedBytes: mem.heapUsed,
      peakHeapTotalBytes: mem.heapTotal,
    };

    console.log(JSON.stringify(overall, null, 2));
    process.exit(0);
  }

  const participantIds = await insertParticipantsForSession(
    session._id,
    count,
    connection,
  );
  console.log(`✅ Bulk-created ${participantIds.length} participants`);

  metrics.record();
  const totalResponses = await generateBulkResponsesForSlides(
    session._id,
    presentation._id,
    slides,
    participantIds,
    metrics,
  );
  metrics.record();

  try {
    await syncer.broadcastState(session._id);
  } catch (_) {}

  const memSummary = metrics.getSummary();
  const finalSummary = {
    ...summary,
    status: "complete",
    sessionCode: session.code,
    presentationId: presentation._id.toString(),
    sessionId: session._id.toString(),
    totalResponses,
    wallMs: Date.now() - timerStart,
    throughputPerSecond: Number(
      (
        totalResponses / Math.max((Date.now() - timerStart) / 1000, 0.001)
      ).toFixed(2),
    ),
    peakRssBytes: memSummary.maxRssBytes,
    peakHeapUsedBytes: memSummary.maxHeapUsedBytes,
    peakHeapTotalBytes: memSummary.maxHeapTotalBytes,
    peakExternalBytes: memSummary.peakExternalBytes,
    cpuUserMs: memSummary.cpuUserMs,
    cpuSystemMs: memSummary.cpuSystemMs,
  };

  console.log("\n=======================================================");
  console.log("🎯 E2E STRESS SUMMARY");
  console.log("=======================================================");
  console.log(JSON.stringify(finalSummary, null, 2));
  console.log("=======================================================\n");
  process.exit(0);
}

async function runRemoteE2EStress({
  count,
  slides: slideCount,
  url,
  seed,
  createOnly,
}) {
  const baseUrl = (
    url ||
    process.env.TARGET_URL ||
    process.env.API_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const metrics = createMetricsTracker();
  const runStarted = performance.now();

  console.log(`\n🌐 Starting remote E2E stress run against ${baseUrl}`);

  const createPresRes = await fetch(`${baseUrl}/api/presentations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `test-${seed}`,
    },
    body: JSON.stringify({
      title: `${seed} - Remote Stress`,
      status: "started",
      settings: {
        allowAnonymousParticipants: true,
        showResultsToParticipants: true,
      },
    }),
  });

  if (!createPresRes.ok) {
    const err = await createPresRes.text();
    throw new Error(`Failed to create presentation: ${err}`);
  }

  const presentation = await createPresRes.json();
  const createdSlides = [];

  for (let idx = 0; idx < slideCount; idx++) {
    const slidePayload = buildSlideDefinitions(seed, 1)[0];
    slidePayload.position = idx;
    slidePayload.presentationId = presentation._id;

    const slideRes = await fetch(
      `${baseUrl}/api/presentations/${presentation._id}/slides`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `test-${seed}`,
        },
        body: JSON.stringify(slidePayload),
      },
    );

    if (!slideRes.ok) {
      throw new Error(
        `Failed to create slide ${idx}: ${await slideRes.text()}`,
      );
    }

    createdSlides.push(await slideRes.json());
  }

  const sessionRes = await fetch(`${baseUrl}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `test-${seed}`,
    },
    body: JSON.stringify({ presentationId: presentation._id }),
  });

  if (!sessionRes.ok) {
    throw new Error(`Failed to create session: ${await sessionRes.text()}`);
  }

  const sessionData = await sessionRes.json();
  const joinCode = sessionData.session.code;

  if (createOnly) {
    console.log(
      JSON.stringify(
        {
          runType: "remote-e2e",
          sessionCode: joinCode,
          presentationId: presentation._id,
          status: "created-only",
          wallMs: performance.now() - runStarted,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const metricsSummary = metrics.getSummary();
  console.log(
    JSON.stringify(
      {
        runType: "remote-e2e",
        sessionCode: joinCode,
        presentationId: presentation._id,
        createdSlides: createdSlides.length,
        participantCount: count,
        status: "not-implemented-for-remote-agent",
        wallMs: performance.now() - runStarted,
        peakRssBytes: metricsSummary.maxRssBytes,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.mode === "remote") {
    await runRemoteE2EStress(options);
    return;
  }

  await runLocalE2EStress(options);
}

main().catch((error) => {
  console.error("\n❌ E2E stress harness crashed:");
  console.error(error.stack || error.message || error);
  process.exit(1);
});
