import { useEffect, useRef, useState } from "react";

/**
 * Returns a value that updates only after `delay` ms have passed without
 * `value` changing. Useful for debouncing typing into a search input so
 * downstream filtering / network calls / heavy effects only run once the
 * user pauses.
 *
 * Example:
 *   const [query, setQuery] = useState("")
 *   const debouncedQuery = useDebounce(query, 200)
 *   // expensive operation reads `debouncedQuery`, controlled input reads `query`
 */
export function useDebounce<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}

/**
 * Returns a stable callback that defers its invocation until `delay` ms
 * have passed without another call. Use when the side effect needs to run
 * with the latest arguments rather than re-deriving from state.
 *
 * The internal timer is cleared on unmount so a pending call won't fire
 * after the component goes away.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay = 200,
): (...args: TArgs) => void {
  const callbackRef = useRef(callback);
  const timerRef = useRef<number | null>(null);

  // Always invoke the latest version of the callback without forcing
  // consumers to memo it.
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (...args: TArgs) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  };
}
