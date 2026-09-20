import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const expectedTables = ["actions", "matches", "player_stats", "players"];

async function main(): Promise<void> {
  const schemaPath = fileURLToPath(
    new URL("../../supabase/schema.sql", import.meta.url),
  );
  const schemaSql = await readFile(schemaPath, "utf8");

  await pool.query(schemaSql);

  const tables = await pool.query<{ table_name: string; rls_enabled: boolean }>(`
    select c.relname as table_name, c.relrowsecurity as rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname = any($1::text[])
    order by c.relname
  `, [expectedTables]);

  const policies = await pool.query<{ table_name: string; policy_name: string }>(`
    select tablename as table_name, policyname as policy_name
    from pg_policies
    where schemaname = 'public'
      and tablename = any($1::text[])
    order by tablename, policyname
  `, [expectedTables]);

  const discoveredTables = tables.rows.map((row) => row.table_name);
  const missingTables = expectedTables.filter(
    (table) => !discoveredTables.includes(table),
  );
  const withoutRls = tables.rows
    .filter((row) => !row.rls_enabled)
    .map((row) => row.table_name);

  if (missingTables.length || withoutRls.length) {
    throw new Error(
      `Schema verification failed. Missing tables: ${missingTables.join(", ") || "none"}; RLS disabled: ${withoutRls.join(", ") || "none"}`,
    );
  }

  console.log(
    `Supabase schema ready: ${discoveredTables.length} tables with RLS and ${policies.rowCount ?? 0} policies.`,
  );
}

try {
  await main();
} finally {
  await pool.end();
}
