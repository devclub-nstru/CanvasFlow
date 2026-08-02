"use client";

import { useCallback, useEffect, useRef } from "react";

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

  useEffect(() => {
    return () => {
      const pending = pendingArgsRef.current;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      if (pending) callbackRef.current(...pending);
    };
  }, []);

  return { run, flush, cancel };
}
