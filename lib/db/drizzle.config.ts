import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import path from "path";

const workspaceEnv = path.resolve(__dirname, "../../.env");
if (!process.env.DATABASE_URL && existsSync(workspaceEnv)) {
  process.loadEnvFile(workspaceEnv);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to a PostgreSQL connection string");
}

const databaseUrl = new URL(process.env.DATABASE_URL);
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  throw new Error(
    "DATABASE_URL must start with postgres:// or postgresql://, not https://",
  );
}
if (!databaseUrl.searchParams.has("sslmode")) {
  databaseUrl.searchParams.set("sslmode", "require");
}
if (
  databaseUrl.searchParams.get("sslmode") === "require" &&
  !databaseUrl.searchParams.has("uselibpqcompat")
) {
  databaseUrl.searchParams.set("uselibpqcompat", "true");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl.toString(),
  },
});
