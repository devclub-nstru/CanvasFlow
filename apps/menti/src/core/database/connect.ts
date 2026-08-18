import mongoose from "mongoose";

export async function connectMongo(uri: string): Promise<[mongoose.Connection | null, Error | null]> {
  try {
    const connection = await mongoose.connect(uri, {
      maxPoolSize: 100,
      minPoolSize: 10,
    });

    // Drop legacy unique index on responses if it exists (missing commandId field)
    try {
      const responseCollection = mongoose.connection.collection("responses");
      const indexes = await responseCollection.indexes();
      const legacyIdx = indexes.find(
        (idx) =>
          idx.key &&
          idx.key["sessionId"] === 1 &&
          idx.key["slideId"] === 1 &&
          idx.key["participantId"] === 1 &&
          !idx.key["commandId"] &&
          idx.unique,
      );
      if (legacyIdx) {
        await responseCollection.dropIndex(legacyIdx.name as string);
      }
    } catch (_) {}

    return [connection.connection, null];
  } catch (error) {
    return [null, error as Error];
  }
}
