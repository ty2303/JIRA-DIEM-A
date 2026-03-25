import mongoose from "mongoose";

const DEFAULT_MONGO_URI = "mongodb+srv://admin:admin123@animepro.68usjeq.mongodb.net/?appName=AnimePro";
const fallbackUri =
  process.env.MONGODB_URI ||
  (process.env.MONGODB_DB_NAME?.startsWith("mongodb")
    ? process.env.MONGODB_DB_NAME
    : null);
const MONGO_URI = process.env.MONGO_URI || fallbackUri || DEFAULT_MONGO_URI;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "phone_store";

export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      dbName: MONGO_DB_NAME
    });
    console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

export default mongoose;
