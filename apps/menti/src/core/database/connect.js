import mongoose from "mongoose";
import { logger } from "../logger/logger.js";

export async function connectMongo(uri) {
  try {
    const connection = await mongoose.connect(uri, {
      /* Sized for a full room answering at once. The ceiling that matters in
       * practice is the server's own connection limit, so raising this past
       * what mongod allows just moves the queue. */
      maxPoolSize: Number(process.env.MONGO_POOL_MAX ?? 200),
      minPoolSize: Number(process.env.MONGO_POOL_MIN ?? 10),
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
    });

    await dropLegacyResponseIndex();

    return [connection, null];
  } catch (error) {
    return [null, error];
  }
}

/* An earlier schema enforced one response per (session, slide, participant).
 * Word-cloud slides that allow multiple submissions need several, so the unique
 * constraint moved to include commandId. Existing databases still carry the old
 * index and would reject the second word from any participant. */
async function dropLegacyResponseIndex() {
  try {
    const responses = mongoose.connection.collection("responses");
    const indexes = await responses.indexes();

    const legacy = indexes.find(
      (idx) =>
        idx.key &&
        idx.key.sessionId === 1 &&
        idx.key.slideId === 1 &&
        idx.key.participantId === 1 &&
        !idx.key.commandId &&
        idx.unique,
    );

    if (legacy) {
      await responses.dropIndex(legacy.name);
      logger.info(`dropped legacy response index ${legacy.name}`);
    }
  } catch (error) {
    /* A fresh database has no such index, and a read-only user cannot drop one.
     * Neither is worth refusing to boot over. */
    logger.debug("legacy response index check skipped:", error.message);
  }
}

export async function closeMongo() {
  try {
    await mongoose.connection.close();
  } catch {
    /* Already closed, or never opened. */
  }
}
