import { describe, expect, it } from "vitest";
import env, { isProduction, redisKey, sharedRedisKey } from "../src/core/env/env.js";

/* Menti shares one Redis with the API's cache, rate limiter and queues. The
 * only thing keeping the two from colliding is which prefix a key is built
 * with, so these two functions are load-bearing: `redisKey` namespaces a key to
 * this service, `sharedRedisKey` deliberately does not, and the revocation
 * denylist the API writes is read through the second one. */

describe("redisKey", () => {
  it("namespaces a key to menti", () => {
    expect(redisKey("quiztimer", "session-1")).toBe("cf:menti:quiztimer:session-1");
  });

  it("joins any number of parts with colons", () => {
    expect(redisKey("a")).toBe("cf:menti:a");
    expect(redisKey("a", "b", "c")).toBe("cf:menti:a:b:c");
  });

  it("accepts numeric parts", () => {
    expect(redisKey("slide", 3)).toBe("cf:menti:slide:3");
  });

  it("uses the configured prefix", () => {
    expect(redisKey("x").startsWith(`${env.REDIS_PREFIX}:`)).toBe(true);
  });

  it("produces no key without the menti segment", () => {
    expect(redisKey("ratelimit", "join", "visitor-1")).toContain(":menti:");
  });
});

describe("sharedRedisKey", () => {
  it("skips the menti segment, because both services read these keys", () => {
    expect(sharedRedisKey("auth", "revoked", "sess-1")).toBe("cf:auth:revoked:sess-1");
  });

  it("still carries the deployment-wide prefix", () => {
    expect(sharedRedisKey("x").startsWith(`${env.REDIS_PREFIX}:`)).toBe(true);
  });

  it("never collides with a menti-namespaced key of the same parts", () => {
    expect(sharedRedisKey("a", "b")).not.toBe(redisKey("a", "b"));
  });
});

describe("env", () => {
  it("defaults the prefix so a deployment need not set one", () => {
    expect(env.REDIS_PREFIX).toBe("cf");
  });

  it("defaults the participant ceiling to something a lecture hall fits under", () => {
    expect(env.MENTI_MAX_PARTICIPANTS_PER_SESSION).toBeGreaterThan(0);
    expect(Number.isInteger(env.MENTI_MAX_PARTICIPANTS_PER_SESSION)).toBe(true);
  });

  it("reports production only when NODE_ENV says so", () => {
    expect(isProduction).toBe(env.NODE_ENV === "production");
  });

  it("is not production under test", () => {
    expect(isProduction).toBe(false);
  });
});
