/* A deliberately tiny logger.
 *
 * The reason this exists rather than `console.log` calls scattered through the
 * hot paths: at 1000 concurrent participants the per-connection and per-event
 * logging was itself a bottleneck. `console.log` to a pipe is a *synchronous*
 * write in Node — every line blocks the event loop, and a burst of 1000 joins
 * meant thousands of blocking writes interleaved with the broadcasts they were
 * describing. Level-gating turns those into a single comparison.
 *
 * @repo/logger (Winston) is TypeScript and this workspace runs plain JS with no
 * build step, so it cannot be imported directly. The level names and default
 * behaviour are kept deliberately compatible.
 */

import env, { isProduction } from "../env/env.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const configured = env.MENTI_LOG_LEVEL ?? (isProduction ? "info" : "debug");
const threshold = LEVELS[configured] ?? LEVELS.info;

const enabled = (level) => LEVELS[level] >= threshold;

function emit(level, stream, args) {
  if (!enabled(level)) return;
  stream(`[menti:${level}]`, ...args);
}

export const logger = {
  /* Hot-path callers should guard with this rather than building a message
   * string that will be thrown away. */
  isDebug: () => enabled("debug"),

  debug: (...args) => emit("debug", console.log, args),
  info: (...args) => emit("info", console.log, args),
  warn: (...args) => emit("warn", console.warn, args),
  error: (...args) => emit("error", console.error, args),
};

export default logger;
