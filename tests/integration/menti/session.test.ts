import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/* Menti against real Mongo.
 *
 * The unit suite covers the pieces — quiz scoring, display-token hashing, the
 * socket ack wrapper, the timer's Redis claim — each with the database faked.
 * What it cannot cover is the part that only exists in Mongo: that a join code
 * is unique across sessions, that the participant cap is enforced by a real
 * countDocuments under concurrent joins, and that starting a session wipes the
 * previous run's answers rather than carrying them over into the next lecture.
 */

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("../../../apps/menti/src/core/logger/logger.js", () => ({ logger, default: logger }));

/* The participant ceiling is read from the validated env object, which is built
 * once at import — assigning process.env later has no effect. Five keeps the
 * cap tests fast while leaving the rest of the environment real. */
const PARTICIPANT_CAP = 5;
vi.mock("../../../apps/menti/src/core/env/env.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const real = actual.default as Record<string, unknown>;
  return {
    ...actual,
    default: { ...real, MENTI_MAX_PARTICIPANTS_PER_SESSION: PARTICIPANT_CAP },
  };
});

const mongoose = (await import("mongoose")).default;
const { connectMongoForTests, resetMongo, closeMongo } = await import("../helpers/mongo");
/* The menti models and services are plain JavaScript with no type
 * declarations, so TypeScript infers `never` for anything they return. Naming
 * the boundary as loose keeps the tests readable instead of littered with
 * assertions at every call. */
type Model = {
  create(doc: Record<string, unknown>): Promise<Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [method: string]: any;
};

const models = (await import("../../../apps/menti/src/core/database/models/index.js")) as unknown as {
  Presentation: Model;
  Slide: Model;
  Session: Model;
  Participant: Model;
  Response: Model;
  User: Model;
};
const { Presentation, Slide, Session, Participant, Response, User } = models;

const { sessionService, hashDisplayToken, wipePresentationSessionData } = (await import(
  "../../../apps/menti/src/modules/session/session.service.js"
)) as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionService: any;
  hashDisplayToken: (raw: string) => string;
  wipePresentationSessionData: (presentationId: unknown) => Promise<void>;
};

const OWNER = new mongoose.Types.ObjectId().toString();

async function makePresentation(ownerId = OWNER, overrides: Record<string, unknown> = {}) {
  return Presentation.create({ title: "Kickoff", ownerId, status: "draft", ...overrides });
}

async function makeSlide(presentationId: unknown, overrides: Record<string, unknown> = {}) {
  return Slide.create({
    presentationId,
    type: "BAR_GRAPH",
    position: 0,
    question: "How are you?",
    options: [
      { id: "a", label: "Good", voteCount: 0 },
      { id: "b", label: "Tired", voteCount: 0 },
    ],
    ...overrides,
  });
}

beforeAll(async () => {
  await connectMongoForTests();
});

afterAll(async () => {
  await closeMongo();
});

beforeEach(async () => {
  await resetMongo();
  vi.clearAllMocks();
});

/* ─── Starting a session ───────────────────────────────────────────────── */

describe("sessionService.createSession", () => {
  it("creates a session pointing at the first slide", async () => {
    const presentation = await makePresentation();
    const first = await makeSlide(presentation._id, { position: 0 });
    await makeSlide(presentation._id, { position: 1 });

    const { session } = await sessionService.createSession(OWNER, presentation._id.toString());

    expect(session.status).toBe("waiting");
    expect(String(session.currentSlideId)).toBe(String(first._id));
  });

  it("mints a six digit join code", async () => {
    const presentation = await makePresentation();
    await makeSlide(presentation._id);

    const { session } = await sessionService.createSession(OWNER, presentation._id.toString());

    expect(session.code).toMatch(/^\d{6}$/);
  });

  it("never issues the same code to two live sessions", async () => {
    const codes = new Set<string>();

    for (let i = 0; i < 12; i++) {
      const presentation = await makePresentation();
      await makeSlide(presentation._id);
      const { session } = await sessionService.createSession(OWNER, presentation._id.toString());
      codes.add(session.code);
    }

    expect(codes.size, "generateSessionCode checks the collection before settling").toBe(12);
  });

  it("refuses a presentation belonging to someone else", async () => {
    const presentation = await makePresentation(new mongoose.Types.ObjectId().toString());

    await expect(
      sessionService.createSession(OWNER, presentation._id.toString()),
    ).rejects.toThrow(/not found or unauthorized/i);
  });

  it("refuses a presentation that does not exist", async () => {
    await expect(
      sessionService.createSession(OWNER, new mongoose.Types.ObjectId().toString()),
    ).rejects.toThrow(/not found or unauthorized/i);
  });

  it("returns the raw display token but stores only its hash", async () => {
    const presentation = await makePresentation();
    await makeSlide(presentation._id);

    const { session, displayToken } = await sessionService.createSession(
      OWNER,
      presentation._id.toString(),
    );

    expect(displayToken).toMatch(/^[0-9a-f]{64}$/);
    expect(session.displayTokenHash, "the hash must never reach the response").toBeUndefined();

    const stored = await Session.findById(session._id).select("+displayTokenHash").lean();
    expect(stored?.displayTokenHash).toBe(hashDisplayToken(displayToken));
  });

  it("resumes the existing session rather than starting a second", async () => {
    const presentation = await makePresentation();
    await makeSlide(presentation._id);

    const first = await sessionService.createSession(OWNER, presentation._id.toString());
    const second = await sessionService.createSession(OWNER, presentation._id.toString());

    expect(String(second.session._id)).toBe(String(first.session._id));
    expect(await Session.countDocuments({ presentationId: presentation._id })).toBe(1);
  });

  it("rotates the display token on resume, so an old projector link dies", async () => {
    const presentation = await makePresentation();
    await makeSlide(presentation._id);

    const first = await sessionService.createSession(OWNER, presentation._id.toString());
    const second = await sessionService.createSession(OWNER, presentation._id.toString());

    expect(second.displayToken).not.toBe(first.displayToken);

    const stored = await Session.findById(first.session._id).select("+displayTokenHash").lean();
    expect(stored?.displayTokenHash).toBe(hashDisplayToken(second.displayToken));
    expect(stored?.displayTokenHash).not.toBe(hashDisplayToken(first.displayToken));
  });

  it("copes with a presentation that has no slides yet", async () => {
    const presentation = await makePresentation();

    const { session } = await sessionService.createSession(OWNER, presentation._id.toString());
    expect(session.currentSlideId).toBeNull();
  });
});

/* ─── Joining ──────────────────────────────────────────────────────────── */

describe("sessionService.joinSession", () => {
  async function liveSession(status = "waiting") {
    const presentation = await makePresentation();
    await makeSlide(presentation._id);
    const { session } = await sessionService.createSession(OWNER, presentation._id.toString());
    if (status !== "waiting") {
      await Session.findByIdAndUpdate(session._id, { $set: { status } });
    }
    return { presentation, session };
  }

  it("creates a participant and hands back a token", async () => {
    const { session } = await liveSession();

    const joined = await sessionService.joinSession(session.code, "Ada");

    expect(joined.participantToken).toMatch(/^[0-9a-f]{64}$/);
    const participant = await Participant.findById(joined.participantId).lean();
    expect(participant?.nickname).toBe("Ada");
    expect(String(participant?.sessionId)).toBe(String(session._id));
  });

  it("stores only the hash of the participant token", async () => {
    const crypto = await import("node:crypto");
    const { session } = await liveSession();

    const joined = await sessionService.joinSession(session.code, "Ada");
    /* tokenHash is `select: false`, so it has to be asked for explicitly —
     * which is the point: it never rides along on an ordinary read. */
    const participant = await Participant.findById(joined.participantId)
      .select("+tokenHash")
      .lean();

    expect(participant?.tokenHash).not.toBe(joined.participantToken);
    expect(participant?.tokenHash).toBe(
      crypto.createHash("sha256").update(joined.participantToken).digest("hex"),
    );
  });

  it("gives every participant a distinct token", async () => {
    const { session } = await liveSession();

    const tokens = new Set<string>();
    for (let i = 0; i < PARTICIPANT_CAP; i++) {
      tokens.add((await sessionService.joinSession(session.code, `P${i}`)).participantToken);
    }

    expect(tokens.size).toBe(PARTICIPANT_CAP);
  });

  it("refuses a code nobody is presenting", async () => {
    await expect(sessionService.joinSession("000000", "Ada")).rejects.toThrow(/not found/i);
  });

  it.each(["cancelled", "finished"])("refuses a %s session", async (status) => {
    const { session } = await liveSession(status);
    await expect(sessionService.joinSession(session.code, "Ada")).rejects.toThrow(/not active/i);
  });

  it.each(["waiting", "live", "paused"])("accepts a %s session", async (status) => {
    const { session } = await liveSession(status);
    await expect(sessionService.joinSession(session.code, "Ada")).resolves.toBeDefined();
  });

  it("lets several people into one session", async () => {
    const { session } = await liveSession();

    await Promise.all(
      Array.from({ length: 4 }, (_, i) => sessionService.joinSession(session.code, `P${i}`)),
    );

    expect(await Participant.countDocuments({ sessionId: session._id })).toBe(4);
  });
});

/* ─── The participant cap ──────────────────────────────────────────────── */

describe("the participant cap", () => {
  async function cappedSession() {
    const presentation = await makePresentation();
    await makeSlide(presentation._id);
    const { session } = await sessionService.createSession(OWNER, presentation._id.toString());
    return session;
  }

  it("refuses a join once the session is full", async () => {
    const session = await cappedSession();

    for (let i = 0; i < PARTICIPANT_CAP; i++) {
      await sessionService.joinSession(session.code, `P${i}`);
    }

    await expect(sessionService.joinSession(session.code, "One too many")).rejects.toThrow(
      /full/i,
    );
  });

  it("marks the refusal with a code the route can map to a status", async () => {
    const session = await cappedSession();
    for (let i = 0; i < PARTICIPANT_CAP; i++) {
      await sessionService.joinSession(session.code, `P${i}`);
    }

    await expect(sessionService.joinSession(session.code, "Second")).rejects.toMatchObject({
      code: "SESSION_FULL",
    });
  });

  it("counts per session, not globally", async () => {
    const first = await cappedSession();

    const otherPresentation = await makePresentation();
    await makeSlide(otherPresentation._id);
    const { session: second } = await sessionService.createSession(
      OWNER,
      otherPresentation._id.toString(),
    );

    for (let i = 0; i < PARTICIPANT_CAP; i++) {
      await sessionService.joinSession(first.code, `P${i}`);
    }
    await expect(sessionService.joinSession(first.code, "One too many")).rejects.toThrow(/full/i);

    await expect(sessionService.joinSession(second.code, "A")).resolves.toBeDefined();
  });

  it("is deliberately not transactional, so a race at the ceiling may overshoot", async () => {
    /* Documented in the service: serialising every join behind a transaction in
     * a thousand-person room is a worse failure than letting two land on the
     * same last seat. Pinned so the trade-off is visible rather than folklore. */
    const session = await cappedSession();

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => sessionService.joinSession(session.code, `P${i}`)),
    );

    const admitted = results.filter((r) => r.status === "fulfilled").length;
    expect(admitted).toBeGreaterThanOrEqual(5);
    expect(admitted, "the cap still bounds the room").toBeLessThan(20);
  });
});

/* ─── Restarting a presentation ────────────────────────────────────────── */

describe("wipePresentationSessionData", () => {
  async function presentationWithAnswers() {
    const presentation = await makePresentation();
    const slide = await makeSlide(presentation._id, {
      options: [
        { id: "a", label: "Good", voteCount: 7 },
        { id: "b", label: "Tired", voteCount: 3 },
      ],
    });
    const { session } = await sessionService.createSession(OWNER, presentation._id.toString());
    const joined = await sessionService.joinSession(session.code, "Ada");

    await Response.create({
      presentationId: presentation._id,
      sessionId: session._id,
      slideId: slide._id,
      participantId: joined.participantId,
      type: "select",
      commandId: `cmd-${Date.now()}-${Math.random()}`,
      answer: { optionIds: ["a"] },
    });
    await Participant.findByIdAndUpdate(joined.participantId, { $set: { score: 900 } });
    await Session.findByIdAndUpdate(session._id, { $set: { isVotingLocked: true } });

    return { presentation, slide, session };
  }

  it("clears the previous run's answers", async () => {
    const { presentation } = await presentationWithAnswers();
    expect(await Response.countDocuments({ presentationId: presentation._id })).toBe(1);

    await wipePresentationSessionData(presentation._id);

    expect(await Response.countDocuments({ presentationId: presentation._id })).toBe(0);
  });

  it("resets vote counts on the slides", async () => {
    const { presentation, slide } = await presentationWithAnswers();

    await wipePresentationSessionData(presentation._id);

    const refreshed = await Slide.findById(slide._id).lean();
    expect(refreshed?.options.map((option: { voteCount: number }) => option.voteCount)).toEqual([
      0, 0,
    ]);
  });

  it("empties a word cloud entirely, since its options are the answers", async () => {
    const presentation = await makePresentation();
    const slide = await makeSlide(presentation._id, {
      type: "WORD_CLOUD",
      options: [
        { id: "w1", label: "tired", voteCount: 4 },
        { id: "w2", label: "ready", voteCount: 2 },
      ],
    });

    await wipePresentationSessionData(presentation._id);

    const refreshed = await Slide.findById(slide._id).lean();
    expect(refreshed?.options).toHaveLength(0);
  });

  it("resets scores and unlocks voting", async () => {
    const { presentation, session } = await presentationWithAnswers();

    await wipePresentationSessionData(presentation._id);

    const participants = await Participant.find({ sessionId: session._id }).lean();
    expect(participants.every((p: { score: number }) => p.score === 0)).toBe(true);

    const refreshed = await Session.findById(session._id).lean();
    expect(refreshed?.isVotingLocked).toBe(false);
    expect(refreshed?.quizState).toBeNull();
  });

  it("keeps the participants themselves, so the room does not empty", async () => {
    const { presentation, session } = await presentationWithAnswers();

    await wipePresentationSessionData(presentation._id);

    expect(await Participant.countDocuments({ sessionId: session._id })).toBe(1);
  });

  it("leaves another presentation alone", async () => {
    const mine = await presentationWithAnswers();
    const theirs = await presentationWithAnswers();

    await wipePresentationSessionData(mine.presentation._id);

    expect(await Response.countDocuments({ presentationId: theirs.presentation._id })).toBe(1);
  });

  it("does nothing when given no presentation", async () => {
    const { presentation } = await presentationWithAnswers();
    await wipePresentationSessionData(null);

    expect(await Response.countDocuments({ presentationId: presentation._id })).toBe(1);
  });

  it("runs when a session is started fresh, so a second lecture begins clean", async () => {
    const { presentation } = await presentationWithAnswers();

    /* Finish the run, then start a new one on the same deck. */
    await Session.updateMany({ presentationId: presentation._id }, { $set: { status: "finished" } });
    await sessionService.createSession(OWNER, presentation._id.toString());

    expect(await Response.countDocuments({ presentationId: presentation._id })).toBe(0);
  });
});

/* ─── Models ───────────────────────────────────────────────────────────── */

describe("the schema Mongo actually enforces", () => {
  it("rejects a slide type outside the enum", async () => {
    const presentation = await makePresentation();
    await expect(makeSlide(presentation._id, { type: "PYRAMID" })).rejects.toThrow();
  });

  it("rejects a participant with no session", async () => {
    await expect(Participant.create({ nickname: "Ada", tokenHash: "abc" })).rejects.toThrow();
  });

  it("names an untitled presentation rather than refusing it", async () => {
    const presentation = await Presentation.create({ ownerId: OWNER });
    expect(presentation.title).toBe("Untitled Presentation");
  });

  it("requires a presentation to have an owner", async () => {
    await expect(Presentation.create({ title: "Orphan" })).rejects.toThrow();
  });

  it("keys a user by the id the API owns, not by a Mongo id", async () => {
    const user = await User.create({ externalId: OWNER, name: "Host" });
    expect(user.externalId).toBe(OWNER);
    await expect(User.create({ externalId: OWNER, name: "Duplicate" })).rejects.toThrow();
  });
});
