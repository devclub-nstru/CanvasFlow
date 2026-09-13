/* apps/menti validates its environment at import time and requires MONGO_URI,
 * so it has to be present before any menti module loads. Nothing in the unit
 * suite connects to Mongo — the value only has to satisfy the schema. */
process.env.MONGO_URI ??= "mongodb://127.0.0.1:27999/menti-unit-tests";
process.env.REDIS_URL ||= "redis://127.0.0.1:6399";
process.env.MENTI_LOG_LEVEL ??= "silent";
