/* Draining a cursor-paged query.
 *
 * React Query hands back a fresh result object from every `fetchNextPage()`,
 * and the one captured in a render closure goes stale the moment a page lands.
 * Following the returned object instead of the closure is the whole trick —
 * and keeping it here, away from the hook, is what makes it testable. */

export interface Pageable<T> {
  hasNextPage: boolean;
  fetchNextPage: () => Promise<T>;
}

/** Fetches pages until there are none left, returning the final result. */
export async function drainPages<T extends Pageable<T>>(
  first: T,
  /* 500 pages is 100k rows at the page size the responses view uses — far past
   * what a browser should hold in memory, so stopping is kinder than hanging. */
  maxPages = 500,
): Promise<T> {
  let current = first;

  for (let i = 0; i < maxPages && current.hasNextPage; i++) {
    current = await current.fetchNextPage();
  }

  return current;
}
