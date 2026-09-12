import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

/* session.service.js reaches Mongo through its repositories and models; the two
 * token helpers under test touch neither. */
vi.mock("../src/core/database/models/index.js", () => ({
  Session: {},
  Slide: {},
  Response: {},
  Participant: {},
  User: {},
  Presentation: {},
  PresentationAsset: {},
  PowerPointImport: {},
}));
vi.mock("../src/modules/session/session.repository.js", () => ({ sessionRepository: {} }));
vi.mock("../src/modules/presentation/presentation.repository.js", () => ({
  presentationRepository: {},
}));

const { issueDisplayToken, hashDisplayToken } = await import(
  "../src/modules/session/session.service.js"
);

/* The display token is what a projector URL carries. Only its hash is stored,
 * so revoking a link means rotating the stored hash — which only works if the
 * raw token is never recoverable from what the database holds. */

describe("hashDisplayToken", () => {
  it("is a SHA-256 hex digest", () => {
    expect(hashDisplayToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches the digest anything else would compute", () => {
    const raw = "a-token";
    expect(hashDisplayToken(raw)).toBe(
      crypto.createHash("sha256").update(raw).digest("hex"),
    );
  });

  it("is stable across calls", () => {
    expect(hashDisplayToken("abc")).toBe(hashDisplayToken("abc"));
  });

  it("separates inputs that differ by a single character", () => {
    expect(hashDisplayToken("abc")).not.toBe(hashDisplayToken("abd"));
  });

  it("is case sensitive", () => {
    expect(hashDisplayToken("ABC")).not.toBe(hashDisplayToken("abc"));
  });

  it("handles an empty token without throwing", () => {
    expect(hashDisplayToken("")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("issueDisplayToken", () => {
  it("returns a raw token and its hash", () => {
    const { raw, hash } = issueDisplayToken();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("carries 32 bytes of entropy", () => {
    expect(Buffer.from(issueDisplayToken().raw, "hex")).toHaveLength(32);
  });

  it("never stores the raw token", () => {
    const { raw, hash } = issueDisplayToken();
    expect(hash).not.toBe(raw);
  });

  it("produces a hash that verifies against the raw token", () => {
    const { raw, hash } = issueDisplayToken();
    expect(hashDisplayToken(raw)).toBe(hash);
  });

  it("never repeats a token", () => {
    const issued = new Set();
    for (let i = 0; i < 200; i++) issued.add(issueDisplayToken().raw);
    expect(issued.size).toBe(200);
  });

  it("rotates the hash too, so an old projector link stops working", () => {
    const first = issueDisplayToken();
    const second = issueDisplayToken();
    expect(second.hash).not.toBe(first.hash);
    expect(hashDisplayToken(first.raw)).not.toBe(second.hash);
  });
});
