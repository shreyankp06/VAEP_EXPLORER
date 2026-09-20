import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set to a PostgreSQL connection string.",
  );
}

let parsedDatabaseUrl: URL;
try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  throw new Error("DATABASE_URL is not a valid URL.");
}

if (!["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol)) {
  throw new Error(
    "DATABASE_URL must start with postgres:// or postgresql://. A Supabase project URL (https://...) is not a database connection string.",
  );
}

if (!parsedDatabaseUrl.searchParams.has("sslmode")) {
  parsedDatabaseUrl.searchParams.set("sslmode", "require");
}

const configuredPoolMax = Number(process.env.DB_POOL_MAX ?? 10);
const poolMax = Number.isInteger(configuredPoolMax) && configuredPoolMax > 0
  ? configuredPoolMax
  : 10;

export const pool = new Pool({
  connectionString: parsedDatabaseUrl.toString(),
  max: poolMax,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
