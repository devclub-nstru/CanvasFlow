import { describe, expect, it } from "vitest";
import {
  formatIndex,
  parseIndex,
  indexBetween,
  isBetween,
} from "~/lib/fractional-index";

describe("formatIndex", () => {
  it("returns the plain string form for ordinary numbers", () => {
    expect(formatIndex(0)).toBe("0");
    expect(formatIndex(1)).toBe("1");
    expect(formatIndex(-4)).toBe("-4");
    expect(formatIndex(1.5)).toBe("1.5");
  });

  it("expands exponential notation so the value stays sortable as text", () => {
    /* String(1e-7) is "1e-7", which would break any consumer that treats the
     * index as a decimal string. */
    expect(formatIndex(1e-7)).toBe("0.0000001");
    expect(formatIndex(1e-7)).not.toContain("e");
  });

  it("trims the padding introduced by the expansion", () => {
    expect(formatIndex(2.5e-7)).toBe("0.00000025");
  });
});

describe("parseIndex", () => {
  it("reads both numeric and string indexes", () => {
    expect(parseIndex(3)).toBe(3);
    expect(parseIndex("3.25")).toBe(3.25);
    expect(parseIndex("0.0000001")).toBe(1e-7);
  });

  it("tolerates trailing junk the way parseFloat does", () => {
    expect(parseIndex("12abc")).toBe(12);
  });

  it("returns NaN for values that are not numbers at all", () => {
    expect(parseIndex(undefined)).toBeNaN();
    expect(parseIndex(null)).toBeNaN();
    expect(parseIndex("")).toBeNaN();
    expect(parseIndex({})).toBeNaN();
  });
});

describe("indexBetween", () => {
  it("returns null when there is no anchor on either side", () => {
    expect(indexBetween(null, null)).toBeNull();
  });

  it("appends after the last item", () => {
    expect(indexBetween(5, null)).toBe("6");
    expect(indexBetween(-2, null)).toBe("-1");
  });

  it("halves a positive head when prepending", () => {
    expect(indexBetween(null, 10)).toBe("5");
    expect(indexBetween(null, 1)).toBe("0.5");
  });

  it("steps below a zero or negative head when prepending", () => {
    expect(indexBetween(null, 0)).toBe("-1");
    expect(indexBetween(null, -3)).toBe("-4");
  });

  it("returns the midpoint between two neighbours", () => {
    expect(indexBetween(1, 2)).toBe("1.5");
    expect(indexBetween(0, 1)).toBe("0.5");
    expect(indexBetween(-1, 1)).toBe("0");
  });

  it("refuses an inverted or degenerate range", () => {
    expect(indexBetween(2, 1)).toBeNull();
    expect(indexBetween(1, 1)).toBeNull();
  });

  it("refuses when float precision is exhausted between the neighbours", () => {
    /* Adjacent doubles have no representable midpoint: the caller has to
     * rebalance rather than receive a value equal to one of the bounds. */
    expect(indexBetween(1, 1 + Number.EPSILON)).toBeNull();
  });

  it("treats non-finite anchors as absent", () => {
    expect(indexBetween(Number.NaN, null)).toBeNull();
    expect(indexBetween(Number.POSITIVE_INFINITY, 5)).toBe("2.5");
  });

  it("produces a value that actually sorts between its neighbours", () => {
    const mid = indexBetween(1, 2);
    expect(mid).not.toBeNull();
    expect(parseIndex(mid)).toBeGreaterThan(1);
    expect(parseIndex(mid)).toBeLessThan(2);
  });

  it("survives repeated insertion at the same point for a useful depth", () => {
    let before = 1;
    const after = 2;
    for (let i = 0; i < 40; i++) {
      const next = indexBetween(before, after);
      expect(next).not.toBeNull();
      const value = parseIndex(next);
      expect(value).toBeGreaterThan(before);
      expect(value).toBeLessThan(after);
      before = value;
    }
  });
});

describe("isBetween", () => {
  it("is true strictly inside the range", () => {
    expect(isBetween(1.5, 1, 2)).toBe(true);
  });

  it("is false on either boundary", () => {
    expect(isBetween(1, 1, 2)).toBe(false);
    expect(isBetween(2, 1, 2)).toBe(false);
  });

  it("treats a null bound as unbounded", () => {
    expect(isBetween(-999, null, 0)).toBe(true);
    expect(isBetween(999, 0, null)).toBe(true);
    expect(isBetween(0, null, null)).toBe(true);
  });

  it("rejects a non-finite index", () => {
    expect(isBetween(Number.NaN, null, null)).toBe(false);
    expect(isBetween(Number.POSITIVE_INFINITY, null, null)).toBe(false);
  });
});
