import { describe, expect, it } from "vitest";
import { drainPages, type Pageable } from "~/lib/pagination";

/* The bug this exists to prevent: following the result captured in a closure
 * instead of the one each fetch returns, which stops after a single page and
 * makes a truncated export look complete. */

interface FakePage extends Pageable<FakePage> {
  rows: string[];
  fetches: number;
}

function pages(count: number): FakePage {
  let fetched = 0;

  const at = (i: number): FakePage => ({
    rows: Array.from({ length: i + 1 }, (_, n) => `page${i}-row${n}`),
    get fetches() {
      return fetched;
    },
    hasNextPage: i < count - 1,
    fetchNextPage: async () => {
      fetched++;
      return at(i + 1);
    },
  });

  return at(0);
}

describe("drainPages", () => {
  it("returns the first result untouched when there is nothing more", async () => {
    const only = pages(1);
    const final = await drainPages(only);

    expect(final).toBe(only);
    expect(final.fetches).toBe(0);
  });

  it("keeps fetching until the last page", async () => {
    const final = await drainPages(pages(5));

    expect(final.hasNextPage).toBe(false);
    expect(final.fetches).toBe(4);
  });

  it("follows the result each fetch returns, not the one it started with", async () => {
    /* A stale-closure implementation would call fetchNextPage on the first
     * page forever and never see hasNextPage go false. */
    const final = await drainPages(pages(3));

    expect(final.rows).toEqual(["page2-row0", "page2-row1", "page2-row2"]);
  });

  it("stops at the page cap rather than running forever", async () => {
    const endless: FakePage = {
      rows: [],
      fetches: 0,
      hasNextPage: true,
      fetchNextPage: async () => endless,
    };

    const final = await drainPages(endless, 3);
    expect(final).toBe(endless);
  });

  it("does not fetch at all when the cap is zero", async () => {
    const first = pages(5);
    const final = await drainPages(first, 0);

    expect(final).toBe(first);
    expect(final.fetches).toBe(0);
  });
});
