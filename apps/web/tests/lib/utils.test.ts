import { describe, expect, it } from "vitest";
import { cn, safeRedirect } from "~/lib/utils";
import { openRedirectAttempts, safeRelativePaths } from "../../../../tests/fixtures/redirect-cases";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy entries", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("lets a later Tailwind class win over an earlier one in the same group", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("safeRedirect", () => {
  it("returns the fallback when there is no target", () => {
    expect(safeRedirect(undefined)).toBe("/dashboard");
    expect(safeRedirect(null)).toBe("/dashboard");
    expect(safeRedirect("")).toBe("/dashboard");
  });

  it("honours a caller-supplied fallback", () => {
    expect(safeRedirect(null, "/forms")).toBe("/forms");
  });

  it.each(safeRelativePaths)("keeps the in-app path %j", (path) => {
    expect(safeRedirect(path)).toBe(path.trim());
  });

  it.each(openRedirectAttempts)("refuses %j", (attempt) => {
    expect(safeRedirect(attempt)).toBe("/dashboard");
  });
});
