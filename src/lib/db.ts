import mongoose from "mongoose";
import { env } from "./env";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const uri = env.MONGODB_URI;
    if (!uri) {
      throw new Error(
        "MONGODB_URI is not defined. Please add the MONGODB_URI environment variable in your Vercel Project Settings (Settings -> Environment Variables)."
      );
    }
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose
      .connect(uri, opts)
      .then((mongooseInstance) => {
        if (env.NODE_ENV !== "production") {
          console.log("Connected to MongoDB successfully");
        }
        return mongooseInstance;
      })
      .catch((err) => {
        console.error("Failed to connect to MongoDB:", err);
        cached.promise = null;
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export async function getDatabaseStatus(): Promise<{
  connected: boolean;
  state: string;
  host?: string;
  name?: string;
  error?: string;
}> {
  try {
    const conn = await connectToDatabase();
    const readyState = conn.connection.readyState;
    const stateMap: Record<number, string> = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    return {
      connected: readyState === 1,
      state: stateMap[readyState] || "unknown",
      host: conn.connection.host,
      name: conn.connection.name,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown database connection error";
    return {
      connected: false,
      state: "disconnected",
      error: errorMsg,
    };
  }
}

/**
 * Idempotently builds all MongoDB indexes defined across models in the background.
 */
export async function ensureDatabaseIndexes(): Promise<{ success: boolean; indexes: Record<string, string[]> }> {
  await connectToDatabase();
  const { LoanApplication } = await import("@/models/LoanApplication");
  const { User } = await import("@/models/User");
  const { Branch } = await import("@/models/Branch");
  const { AuditLog } = await import("@/models/AuditLog");

  await Promise.all([
    LoanApplication.createIndexes(),
    User.createIndexes(),
    Branch.createIndexes(),
    AuditLog.createIndexes(),
  ]);

  const [loanIdx, userIdx, branchIdx, auditIdx] = await Promise.all([
    LoanApplication.collection.indexes(),
    User.collection.indexes(),
    Branch.collection.indexes(),
    AuditLog.collection.indexes(),
  ]);

  return {
    success: true,
    indexes: {
      LoanApplication: loanIdx.map((i) => i.name || JSON.stringify(i.key)),
      User: userIdx.map((i) => i.name || JSON.stringify(i.key)),
      Branch: branchIdx.map((i) => i.name || JSON.stringify(i.key)),
      AuditLog: auditIdx.map((i) => i.name || JSON.stringify(i.key)),
    },
  };
}
