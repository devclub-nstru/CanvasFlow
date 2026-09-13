/* Migrates the `responses` collection onto the submissionSlot unique index.
 *
 * Run once per environment, before or during the deploy that ships the schema
 * change:
 *
 *   pnpm --filter @repo/menti migrate:response-indexes
 *
 * Mongoose creates newly declared indexes on connect but never drops ones that
 * were removed from the schema, so the old indexes survive a deploy and keep
 * enforcing the constraint that made unlimited word clouds impossible. They
 * have to be dropped explicitly.
 *
 * Safe to re-run: every step checks the current state first.
 */

import mongoose from "mongoose";

import env from "../src/core/env/env.js";
import { logger } from "../src/core/logger/logger.js";

/* The two indexes being retired.
 *
 * responses_participant_slide_uniq is the three-field unique index that made a
 * second word-cloud entry a duplicate-key error. The commandId one enforced
 * nothing — commandId is a fresh server-side UUID per submission, so it never
 * collided — while still costing a write on every insert. Mongo's default
 * names are used because neither index was given an explicit one. */
const LEGACY_INDEX_KEYS = [
  { sessionId: 1, slideId: 1, participantId: 1 },
  { sessionId: 1, slideId: 1, participantId: 1, commandId: 1 },
];

const NEW_INDEX_KEY = {
  sessionId: 1,
  slideId: 1,
  participantId: 1,
  submissionSlot: 1,
};

function sameKey(a, b) {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k, i) => bk[i] === k && a[k] === b[k]);
}

async function main() {
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  logger.info("connected");

  const responses = mongoose.connection.db.collection("responses");

  /* 1. Backfill first.
   *
   * Existing documents predate the field, and a schema default only applies to
   * newly created documents. Without this they would all index as null —
   * harmless for uniqueness (the old index guaranteed at most one document per
   * participant/slide, so nulls cannot collide) but it would leave the
   * collection in a state where the field means nothing. */
  const backfill = await responses.updateMany(
    { submissionSlot: { $exists: false } },
    { $set: { submissionSlot: "single" } },
  );
  logger.info(`backfilled submissionSlot on ${backfill.modifiedCount} document(s)`);

  const existing = await responses.indexes();

  /* 2. Create the replacement before dropping the old ones, so the collection
   *    is never briefly left with no uniqueness constraint at all. */
  const alreadyHasNew = existing.some((ix) => sameKey(ix.key, NEW_INDEX_KEY));

  if (alreadyHasNew) {
    logger.info("submissionSlot unique index already present");
  } else {
    await responses.createIndex(NEW_INDEX_KEY, { unique: true });
    logger.info("created submissionSlot unique index");
  }

  /* 3. Drop the retired indexes. */
  for (const key of LEGACY_INDEX_KEYS) {
    const match = existing.find((ix) => sameKey(ix.key, key));

    if (!match) {
      logger.info(`legacy index ${JSON.stringify(key)} already absent`);
      continue;
    }

    await responses.dropIndex(match.name);
    logger.info(`dropped legacy index ${match.name}`);
  }

  logger.info("migration complete");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  logger.error("migration failed:", err instanceof Error ? err.stack : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
