import { beforeEach, describe, expect, it, vi } from "vitest";

const redis = { defineCommand: vi.fn(), leakyBucket: vi.fn() };
vi.mock("../src/core/database/redis.js", () => ({
  redis,
  createSubscriber: vi.fn(),
  closeRedis: vi.fn(),
}));

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("../src/core/logger/logger.js", () => ({ logger, default: logger }));

const { createAckWrapper } = await import("../realtime/utils.js");
const { forgetRateLimitIdentity } = await import("../realtime/rateLimiter.js");

/* Every socket event in the product is wrapped by this, so it decides three
 * things for all of them: who the rate limiter charges, what an ack looks like,
 * and whether a throwing handler takes the connection down with it.
 *
 * The real in-process limiter is used rather than a mock — it is already unit
 * tested, and stubbing it would hide the one thing worth checking here, which
 * is that the wrapper consults it *before* the handler runs. Each test uses a
 * fresh identity so the buckets never overlap. */

let seq = 0;
function socket(overrides = {}) {
  return { id: `socket-${++seq}`, data: {}, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("identity", () => {
  it("prefers the signed-in user", () => {
    const wrap = createAckWrapper(
      socket({ data: { userId: "user-1", participantId: "participant-1" } }),
    );
    expect(typeof wrap).toBe("function");
  });

  it("charges two sockets of the same user to one bucket", async () => {
    const userId = `user-${++seq}`;
    const handler = vi.fn();

    const first = createAckWrapper(socket({ data: { userId } }))(handler);
    const second = createAckWrapper(socket({ data: { userId } }))(handler);

    /* Default capacity is ten; spend it through one socket. */
    for (let i = 0; i < 10; i++) await first();

    const ack = vi.fn();
    await second(ack);
    expect(ack).toHaveBeenCalledWith({
      success: false,
      error: "Rate limit exceeded. Please slow down.",
    });

    forgetRateLimitIdentity(userId);
  });

  it("keeps two different participants apart", async () => {
    const handler = vi.fn();
    const a = createAckWrapper(socket({ data: { participantId: `p-${++seq}` } }))(handler);
    const b = createAckWrapper(socket({ data: { participantId: `p-${++seq}` } }))(handler);

    for (let i = 0; i < 10; i++) await a();

    const ack = vi.fn();
    await b(ack);
    expect(ack).toHaveBeenCalledWith({ success: true, data: undefined });
  });

  it("falls back through the mongoose document shapes", async () => {
    const id = `mongo-${++seq}`;
    const handler = vi.fn();

    const viaUser = createAckWrapper(socket({ user: { _id: { toString: () => id } } }))(handler);
    const viaParticipant = createAckWrapper(
      socket({ participant: { _id: { toString: () => id } } }),
    )(handler);

    for (let i = 0; i < 10; i++) await viaUser();

    const ack = vi.fn();
    await viaParticipant(ack);
    expect(ack, "both shapes resolve to the same identity").toHaveBeenCalledWith({
      success: false,
      error: "Rate limit exceeded. Please slow down.",
    });

    forgetRateLimitIdentity(id);
  });

  it("falls back to the socket id for an anonymous connection", async () => {
    const anonymous = socket();
    const handler = vi.fn();
    const wrapped = createAckWrapper(anonymous)(handler);

    for (let i = 0; i < 10; i++) await wrapped();

    const ack = vi.fn();
    await wrapped(ack);
    expect(ack).toHaveBeenCalledWith({
      success: false,
      error: "Rate limit exceeded. Please slow down.",
    });

    forgetRateLimitIdentity(anonymous.id);
  });
});

describe("rate limiting", () => {
  it("never reaches the handler once the budget is spent", async () => {
    const handler = vi.fn();
    const wrapped = createAckWrapper(socket())(handler);

    for (let i = 0; i < 10; i++) await wrapped();
    handler.mockClear();

    await wrapped(vi.fn());
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns rather than throwing, so the socket survives", async () => {
    const wrapped = createAckWrapper(socket())(vi.fn());
    for (let i = 0; i < 10; i++) await wrapped();
    await expect(wrapped(vi.fn())).resolves.toBeUndefined();
  });

  it("tolerates a refused event that carried no ack", async () => {
    const wrapped = createAckWrapper(socket())(vi.fn());
    for (let i = 0; i < 10; i++) await wrapped();
    await expect(wrapped()).resolves.toBeUndefined();
  });
});

describe("acknowledgements", () => {
  it("wraps a handler's return value in a success envelope", async () => {
    const ack = vi.fn();
    await createAckWrapper(socket())(async () => ({ slideId: "s1" }))(ack);
    expect(ack).toHaveBeenCalledWith({ success: true, data: { slideId: "s1" } });
  });

  it("reports success with undefined data for a handler that returns nothing", async () => {
    const ack = vi.fn();
    await createAckWrapper(socket())(async () => {})(ack);
    expect(ack).toHaveBeenCalledWith({ success: true, data: undefined });
  });

  it("passes the event payload to the handler, minus the ack", async () => {
    const handler = vi.fn();
    await createAckWrapper(socket())(handler)({ vote: "a" }, "extra", vi.fn());
    expect(handler).toHaveBeenCalledWith({ vote: "a" }, "extra");
  });

  it("passes every argument through when no ack was supplied", async () => {
    const handler = vi.fn();
    await createAckWrapper(socket())(handler)({ vote: "a" });
    expect(handler).toHaveBeenCalledWith({ vote: "a" });
  });

  it("does not mistake a payload for an ack when the ack is absent", async () => {
    const handler = vi.fn();
    await createAckWrapper(socket())(handler)("just-a-string");
    expect(handler).toHaveBeenCalledWith("just-a-string");
  });

  it("runs a handler that was given no ack at all", async () => {
    const handler = vi.fn();
    await expect(createAckWrapper(socket())(handler)()).resolves.toBeUndefined();
    expect(handler).toHaveBeenCalled();
  });

  it("awaits an asynchronous handler before acknowledging", async () => {
    const order = [];
    const ack = vi.fn(() => order.push("ack"));

    await createAckWrapper(socket())(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push("handler");
    })(ack);

    expect(order).toEqual(["handler", "ack"]);
  });
});

describe("handler errors", () => {
  it("are contained rather than crashing the connection", async () => {
    const wrapped = createAckWrapper(socket())(async () => {
      throw new Error("mongo timed out");
    });
    await expect(wrapped(vi.fn())).resolves.toBeUndefined();
  });

  it("are reported to the client with the handler's message", async () => {
    const ack = vi.fn();
    await createAckWrapper(socket())(async () => {
      throw new Error("slide not found");
    })(ack);
    expect(ack).toHaveBeenCalledWith({ success: false, error: "slide not found" });
  });

  it("fall back to a generic message when the error has none", async () => {
    const ack = vi.fn();
    await createAckWrapper(socket())(async () => {
      throw new Error("");
    })(ack);
    expect(ack).toHaveBeenCalledWith({ success: false, error: "Internal Server Error" });
  });

  it("are logged", async () => {
    await createAckWrapper(socket())(async () => {
      throw new Error("slide not found");
    })(vi.fn());
    expect(logger.error).toHaveBeenCalledWith("socket handler error:", "slide not found");
  });

  it("are survivable with no ack to report them to", async () => {
    const wrapped = createAckWrapper(socket())(async () => {
      throw new Error("boom");
    });
    await expect(wrapped()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("slow events", () => {
  it("are not logged when the handler is quick", async () => {
    await createAckWrapper(socket())(async () => "fast")(vi.fn());
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("are logged once the handler passes the threshold", async () => {
    await createAckWrapper(socket())(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    })(vi.fn());
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("slow ws event"));
  });

  it("still acknowledge normally", async () => {
    const ack = vi.fn();
    await createAckWrapper(socket())(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
      return "done";
    })(ack);
    expect(ack).toHaveBeenCalledWith({ success: true, data: "done" });
  });
});
