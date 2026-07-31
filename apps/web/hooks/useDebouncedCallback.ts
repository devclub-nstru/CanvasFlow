"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Defer a call until the caller stops calling it for `delay` ms.
 *
 * Used for the respondent's autosave and answer tracking, where the alternative
 * is a request per keystroke. The two properties that matter here beyond plain
 * debouncing:
 *
 *  · The latest arguments win. A pending call is replaced, not queued, so the
 *    request that eventually goes out carries the newest answers rather than
 *    whatever was typed 800ms ago.
 *  · `flush()` fires the pending call immediately. Without it, closing the tab
 *    or hitting Submit mid-debounce would silently drop the last edit — exactly
 *    the edit the respondent most expects to have been saved.
 *
 * The callback is held in a ref so a fresh closure each render doesn't restart
 * the timer; a debounce that resets whenever React re-renders never fires while
 * someone is actively typing.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
): {
  run: (...args: Args) => void;
  flush: () => void;
  cancel: () => void;
} {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<Args | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const run = useCallback(
    (...args: Args) => {
      pendingArgsRef.current = args;
      clear();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingArgsRef.current;
        pendingArgsRef.current = null;
        if (pending) callbackRef.current(...pending);
      }, delay);
    },
    [clear, delay],
  );

  const flush = useCallback(() => {
    const pending = pendingArgsRef.current;
    clear();
    pendingArgsRef.current = null;
    if (pending) callbackRef.current(...pending);
  }, [clear]);

  const cancel = useCallback(() => {
    clear();
    pendingArgsRef.current = null;
  }, [clear]);

  // Fire whatever is pending on unmount rather than dropping it. Navigating
  // away mid-debounce is the common way to lose the last answer.
  useEffect(() => {
    return () => {
      const pending = pendingArgsRef.current;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      if (pending) callbackRef.current(...pending);
    };
  }, []);

  return { run, flush, cancel };
}
