import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB ?? "mirrorline";

// Next.js dev reloads this module on every request, so without caching the
// client on `global` each reload would open a fresh connection. Production
// gets a single client for the life of the server process either way.
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGODB_URI is not set on the server.");
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  return global._mongoClientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  return client.db(DB_NAME);
}
