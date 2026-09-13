import mongoose from "mongoose";

/* Menti keeps its own state in Mongo, so the menti tests need their own reset
 * alongside the Postgres one. Same rule as the SQL side: every collection is
 * emptied between files, so the connection must point at a disposable database.
 *
 * The models register themselves on the default mongoose connection when
 * imported, so connecting once here is enough for all of them. */

export async function connectMongoForTests(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGO_URI ?? "";
  if (!/(test|_test)/i.test(uri)) {
    throw new Error(
      `The integration suite refuses to run against "${uri}" — the Mongo database ` +
        `name must contain "test", because every collection is emptied between files.`,
    );
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
}

export async function resetMongo(): Promise<void> {
  await connectMongoForTests();

  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function closeMongo(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
}
