import { describe, expect, it } from "vitest";
import { createSessionSchema, joinSessionSchema } from "../src/modules/session/session.schemas.js";
import {
  createPresentationSchema,
  createSlideSchema,
  reorderSlidesSchema,
  updatePresentationSchema,
  updateSlideSchema,
} from "../src/modules/presentation/presentation.schemas.js";

/* These schemas sit directly on public HTTP routes — the join route is
 * reachable by anyone with a room code — so what they refuse is the product's
 * first line of input validation. They wrap `params` and `body` because they
 * validate the whole Express request, not just its payload. */

const OID = "507f1f77bcf86cd799439011";
const OTHER_OID = "507f1f77bcf86cd799439012";

/* ─── Sessions ─────────────────────────────────────────────────────────── */

describe("createSessionSchema", () => {
  it("accepts a Mongo object id", () => {
    expect(createSessionSchema.safeParse({ body: { presentationId: OID } }).success).toBe(true);
  });

  it("rejects an id of the wrong length", () => {
    expect(createSessionSchema.safeParse({ body: { presentationId: "abc" } }).success).toBe(false);
    expect(
      createSessionSchema.safeParse({ body: { presentationId: `${OID}0` } }).success,
    ).toBe(false);
  });

  it("rejects a missing body", () => {
    expect(createSessionSchema.safeParse({}).success).toBe(false);
    expect(createSessionSchema.safeParse({ body: {} }).success).toBe(false);
  });

  it("says which field is wrong", () => {
    const result = createSessionSchema.safeParse({ body: { presentationId: "abc" } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Invalid Presentation ID");
    }
  });
});

describe("joinSessionSchema", () => {
  const valid = { params: { code: "123456" }, body: { nickname: "Ada" } };

  it("accepts a numeric room code and a nickname", () => {
    expect(joinSessionSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["1234", "123456789012"])("accepts the boundary code length %s", (code) => {
    expect(joinSessionSchema.safeParse({ ...valid, params: { code } }).success).toBe(true);
  });

  it.each(["123", "1234567890123"])("rejects the out-of-range code length %s", (code) => {
    expect(joinSessionSchema.safeParse({ ...valid, params: { code } }).success).toBe(false);
  });

  it.each([
    ["letters", "12a456"],
    ["a space", "123 56"],
    ["a hyphen", "123-56"],
    ["a leading plus", "+12345"],
    ["a decimal point", "12.456"],
    ["an empty string", ""],
  ])("rejects a room code with %s", (_label, code) => {
    expect(joinSessionSchema.safeParse({ ...valid, params: { code } }).success).toBe(false);
  });

  it("keeps a leading zero, because the code is a string not a number", () => {
    const parsed = joinSessionSchema.parse({ ...valid, params: { code: "012345" } });
    expect(parsed.params.code).toBe("012345");
  });

  it("requires a nickname with something in it", () => {
    expect(joinSessionSchema.safeParse({ ...valid, body: { nickname: "" } }).success).toBe(false);
    expect(joinSessionSchema.safeParse({ ...valid, body: {} }).success).toBe(false);
  });

  it("caps the nickname at 100 characters", () => {
    expect(
      joinSessionSchema.safeParse({ ...valid, body: { nickname: "a".repeat(100) } }).success,
    ).toBe(true);
    expect(
      joinSessionSchema.safeParse({ ...valid, body: { nickname: "a".repeat(101) } }).success,
    ).toBe(false);
  });
});

/* ─── Presentations ────────────────────────────────────────────────────── */

describe("createPresentationSchema", () => {
  const valid = { body: { title: "Kickoff" } };

  it("accepts a title on its own", () => {
    expect(createPresentationSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a non-empty title within 200 characters", () => {
    expect(createPresentationSchema.safeParse({ body: { title: "" } }).success).toBe(false);
    expect(createPresentationSchema.safeParse({ body: {} }).success).toBe(false);
    expect(
      createPresentationSchema.safeParse({ body: { title: "a".repeat(200) } }).success,
    ).toBe(true);
    expect(
      createPresentationSchema.safeParse({ body: { title: "a".repeat(201) } }).success,
    ).toBe(false);
  });

  it.each(["draft", "started", "deleted"])("accepts the status %s", (status) => {
    expect(createPresentationSchema.safeParse({ body: { ...valid.body, status } }).success).toBe(
      true,
    );
  });

  it("rejects an unknown status", () => {
    expect(
      createPresentationSchema.safeParse({ body: { ...valid.body, status: "live" } }).success,
    ).toBe(false);
  });

  it("accepts the two participant settings", () => {
    expect(
      createPresentationSchema.safeParse({
        body: {
          ...valid.body,
          settings: { allowAnonymousParticipants: true, showResultsToParticipants: false },
        },
      }).success,
    ).toBe(true);
  });

  it("rejects a non-boolean setting", () => {
    expect(
      createPresentationSchema.safeParse({
        body: { ...valid.body, settings: { allowAnonymousParticipants: "yes" } },
      }).success,
    ).toBe(false);
  });
});

describe("updatePresentationSchema", () => {
  it("requires a valid presentation id in the path", () => {
    expect(updatePresentationSchema.safeParse({ params: { id: OID }, body: {} }).success).toBe(true);
    expect(updatePresentationSchema.safeParse({ params: { id: "abc" }, body: {} }).success).toBe(
      false,
    );
  });

  it("accepts an empty body, since every field is optional", () => {
    expect(updatePresentationSchema.safeParse({ params: { id: OID }, body: {} }).success).toBe(true);
  });

  it("still validates a title that is supplied", () => {
    expect(
      updatePresentationSchema.safeParse({ params: { id: OID }, body: { title: "" } }).success,
    ).toBe(false);
  });
});

/* ─── Slides ───────────────────────────────────────────────────────────── */

describe("createSlideSchema", () => {
  const valid = { params: { id: OID }, body: { type: "BAR_GRAPH", position: 0 } };

  it("accepts a minimal slide", () => {
    expect(createSlideSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["BAR_GRAPH", "WORD_CLOUD", "SCALES", "CONTENT", "QUIZ", "LEADERBOARD"])(
    "accepts the slide type %s",
    (type) => {
      expect(createSlideSchema.safeParse({ ...valid, body: { type, position: 0 } }).success).toBe(
        true,
      );
    },
  );

  it("rejects a slide type the renderer has no branch for", () => {
    expect(
      createSlideSchema.safeParse({ ...valid, body: { type: "PYRAMID", position: 0 } }).success,
    ).toBe(false);
  });

  it("requires a type and a position", () => {
    expect(createSlideSchema.safeParse({ ...valid, body: { position: 0 } }).success).toBe(false);
    expect(createSlideSchema.safeParse({ ...valid, body: { type: "QUIZ" } }).success).toBe(false);
  });

  it("refuses a negative position", () => {
    expect(
      createSlideSchema.safeParse({ ...valid, body: { type: "QUIZ", position: -1 } }).success,
    ).toBe(false);
  });

  it.each(["BAR", "DONUT", "PIE", "BUBBLES"])("accepts the visualisation %s", (visualizationType) => {
    expect(
      createSlideSchema.safeParse({ ...valid, body: { ...valid.body, visualizationType } }).success,
    ).toBe(true);
  });

  it("rejects an unknown visualisation", () => {
    expect(
      createSlideSchema.safeParse({
        ...valid,
        body: { ...valid.body, visualizationType: "RADAR" },
      }).success,
    ).toBe(false);
  });

  it("caps the question and description at 5000 characters", () => {
    expect(
      createSlideSchema.safeParse({ ...valid, body: { ...valid.body, question: "a".repeat(5000) } })
        .success,
    ).toBe(true);
    expect(
      createSlideSchema.safeParse({ ...valid, body: { ...valid.body, question: "a".repeat(5001) } })
        .success,
    ).toBe(false);
    expect(
      createSlideSchema.safeParse({
        ...valid,
        body: { ...valid.body, description: "a".repeat(5001) },
      }).success,
    ).toBe(false);
  });

  it("allows the description to be cleared", () => {
    expect(
      createSlideSchema.safeParse({ ...valid, body: { ...valid.body, description: null } }).success,
    ).toBe(true);
  });

  it("validates each option", () => {
    const options = [{ id: "o1", label: "Red", isCorrect: true, color: "#f00", voteCount: 0 }];
    expect(createSlideSchema.safeParse({ ...valid, body: { ...valid.body, options } }).success).toBe(
      true,
    );
    expect(
      createSlideSchema.safeParse({ ...valid, body: { ...valid.body, options: [{ id: "o1" }] } })
        .success,
    ).toBe(false);
    expect(
      createSlideSchema.safeParse({
        ...valid,
        body: { ...valid.body, options: [{ id: "o1", label: "a".repeat(501) }] },
      }).success,
    ).toBe(false);
  });

  it("bounds the quiz timer between five seconds and five minutes", () => {
    const quiz = (timeLimitSeconds) => ({
      ...valid,
      body: { ...valid.body, quizSettings: { timeLimitSeconds } },
    });
    expect(createSlideSchema.safeParse(quiz(5)).success).toBe(true);
    expect(createSlideSchema.safeParse(quiz(300)).success).toBe(true);
    expect(createSlideSchema.safeParse(quiz(4)).success).toBe(false);
    expect(createSlideSchema.safeParse(quiz(301)).success).toBe(false);
  });

  it("bounds the points a quiz question can be worth", () => {
    const quiz = (maxPoints) => ({
      ...valid,
      body: { ...valid.body, quizSettings: { maxPoints } },
    });
    expect(createSlideSchema.safeParse(quiz(10)).success).toBe(true);
    expect(createSlideSchema.safeParse(quiz(10_000)).success).toBe(true);
    expect(createSlideSchema.safeParse(quiz(9)).success).toBe(false);
    expect(createSlideSchema.safeParse(quiz(10_001)).success).toBe(false);
  });

  it("accepts only the two grading schemes the scorer implements", () => {
    for (const gradingScheme of ["answer_based", "time_based"]) {
      expect(
        createSlideSchema.safeParse({
          ...valid,
          body: { ...valid.body, quizSettings: { gradingScheme } },
        }).success,
      ).toBe(true);
    }
    expect(
      createSlideSchema.safeParse({
        ...valid,
        body: { ...valid.body, quizSettings: { gradingScheme: "curved" } },
      }).success,
    ).toBe(false);
  });

  it("accepts the response and design settings a slide can carry", () => {
    expect(
      createSlideSchema.safeParse({
        ...valid,
        body: {
          ...valid.body,
          responseSettings: {
            multipleSelection: true,
            maxSelections: 3,
            timerSeconds: null,
            hideResultsFromAudience: false,
          },
          designSettings: {
            backgroundColor: "#fff",
            wordCloudColors: ["#f00", "#0f0"],
            contentImageUrl: null,
          },
        },
      }).success,
    ).toBe(true);
  });

  it("requires a valid presentation id in the path", () => {
    expect(createSlideSchema.safeParse({ ...valid, params: { id: "abc" } }).success).toBe(false);
  });
});

describe("updateSlideSchema", () => {
  it("requires both ids in the path", () => {
    expect(
      updateSlideSchema.safeParse({ params: { id: OID, slideId: OTHER_OID }, body: {} }).success,
    ).toBe(true);
    expect(updateSlideSchema.safeParse({ params: { id: OID }, body: {} }).success).toBe(false);
    expect(
      updateSlideSchema.safeParse({ params: { id: OID, slideId: "abc" }, body: {} }).success,
    ).toBe(false);
  });

  it("accepts an empty body", () => {
    expect(
      updateSlideSchema.safeParse({ params: { id: OID, slideId: OTHER_OID }, body: {} }).success,
    ).toBe(true);
  });

  it("still validates a type that is supplied", () => {
    expect(
      updateSlideSchema.safeParse({
        params: { id: OID, slideId: OTHER_OID },
        body: { type: "PYRAMID" },
      }).success,
    ).toBe(false);
  });
});

describe("reorderSlidesSchema", () => {
  it("takes a list of slide ids", () => {
    expect(
      reorderSlidesSchema.safeParse({ params: { id: OID }, body: { slideIds: [OID, OTHER_OID] } })
        .success,
    ).toBe(true);
  });

  it("accepts an empty list", () => {
    expect(
      reorderSlidesSchema.safeParse({ params: { id: OID }, body: { slideIds: [] } }).success,
    ).toBe(true);
  });

  it("rejects an entry that is not an object id", () => {
    expect(
      reorderSlidesSchema.safeParse({ params: { id: OID }, body: { slideIds: [OID, "abc"] } })
        .success,
    ).toBe(false);
  });

  it("requires the list", () => {
    expect(reorderSlidesSchema.safeParse({ params: { id: OID }, body: {} }).success).toBe(false);
  });
});
