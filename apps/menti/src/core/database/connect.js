import mongoose from "mongoose";

export async function connectMongo(uri) {
  try {
    const connection = await mongoose.connect(uri, {
      maxPoolSize: Number(process.env.MONGO_POOL_MAX ?? 200),
      minPoolSize: Number(process.env.MONGO_POOL_MIN ?? 10),
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
    });

    return [connection, null];
  } catch (error) {
    return [null, error];
  }
}


export async function closeMongo() {
  try {
    await mongoose.connection.close();
  } catch {
    /* Already closed, or never opened. */
  }
}
