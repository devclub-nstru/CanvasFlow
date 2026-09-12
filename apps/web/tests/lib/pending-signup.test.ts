import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RESEND_COOLDOWN_SECONDS,
  clearPendingSignup,
  readPendingSignup,
  writePendingSignup,
} from "~/lib/pending-signup";

const KEY = "cf.pendingSignup";

beforeEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("RESEND_COOLDOWN_SECONDS", () => {
  it("matches the server-side resend cooldown of one minute", () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
  });
});

describe("writePendingSignup / readPendingSignup", () => {
  it("hands the email and redirect to the confirmation screen", () => {
    writePendingSignup("user@example.com", "/forms/abc");
    expect(readPendingSignup()).toEqual({ email: "user@example.com", redirect: "/forms/abc" });
  });

  it("returns null when nothing was handed over", () => {
    expect(readPendingSignup()).toBeNull();
  });

  it("sanitises the redirect on the way out", () => {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ email: "user@example.com", redirect: "https://evil.test" }),
    );
    expect(readPendingSignup()?.redirect).toBe("/dashboard");
  });

  it("defaults the redirect when it is missing or not a string", () => {
    window.sessionStorage.setItem(KEY, JSON.stringify({ email: "user@example.com" }));
    expect(readPendingSignup()?.redirect).toBe("/dashboard");

    window.sessionStorage.setItem(KEY, JSON.stringify({ email: "user@example.com", redirect: 7 }));
    expect(readPendingSignup()?.redirect).toBe("/dashboard");
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["a JSON primitive", '"a string"'],
    ["null", "null"],
    ["a record with no email", JSON.stringify({ redirect: "/x" })],
    ["a record with an empty email", JSON.stringify({ email: "", redirect: "/x" })],
    ["a record with a non-string email", JSON.stringify({ email: 42 })],
  ])("returns null for %s", (_label, stored) => {
    window.sessionStorage.setItem(KEY, stored);
    expect(readPendingSignup()).toBeNull();
  });

  it("swallows a storage failure on write rather than losing the sign-up", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writePendingSignup("user@example.com", "/x")).not.toThrow();
  });

  it("returns null rather than throwing when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readPendingSignup()).toBeNull();
  });
});

describe("clearPendingSignup", () => {
  it("removes the handover", () => {
    writePendingSignup("user@example.com", "/x");
    clearPendingSignup();
    expect(readPendingSignup()).toBeNull();
  });

  it("is safe to call when there is nothing stored", () => {
    expect(() => clearPendingSignup()).not.toThrow();
  });

  it("swallows a storage failure", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearPendingSignup()).not.toThrow();
  });
});
