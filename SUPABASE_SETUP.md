# Supabase handoff

The application uses Supabase as PostgreSQL only. The Node API connects with `DATABASE_URL`; the browser never receives that value.

## Files

- Database ORM schema: `lib/db/src/schema/index.ts`
- Copy/paste SQL for Supabase SQL Editor: `supabase/schema.sql`
- Seed JSON shape: `data/seed_data.example.json`
- Seed importer: `scripts/src/seed.ts`
- Python StatsBomb/VAEP pipeline: `pipeline/run_vaep.py`
- Environment template: `.env.example`

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. In **Connect**, choose the direct connection or session pooler and copy its PostgreSQL connection string into a local `.env` as `DATABASE_URL`.
4. Do not commit `.env` or expose `DATABASE_URL` to Vite/browser code.
5. Generate `data/seed_data.json` with the Python pipeline.
6. Run the Node seed importer.

The value must begin with `postgres://` or `postgresql://`. The HTTPS project URL and Supabase anon key are not database connection strings. The SQL uses the same table and column names as Drizzle. Use either the SQL Editor or Drizzle push for initial schema creation.

## Runtime commands

From the repository root in PowerShell:

```powershell
Copy-Item .env.example .env
# Edit .env and set DATABASE_URL to the Supabase connection string.

pnpm install --frozen-lockfile
pnpm db:setup
pnpm --filter @workspace/scripts seed

$env:PORT = "3000"
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/api-server start
```

In another terminal:

```powershell
$env:PORT = "5173"
$env:BASE_PATH = "/"
$env:API_URL = "http://localhost:3000"
pnpm --filter @workspace/vaep-explorer dev
```

## Supabase security

The API uses the database connection string only on the server and enforces SSL. For `node-postgres` 8, the application adds `uselibpqcompat=true` when `sslmode=require` so the mode follows standard libpq encryption semantics. For full certificate-chain verification, download the project CA certificate and use `sslmode=verify-full` with the driver configured to trust that certificate. The pool defaults to 10 connections; set `DB_POOL_MAX` lower for a small deployment or when required by the chosen Supabase pooler.

Every public table has RLS enabled. The schema revokes all privileges from `anon` and `authenticated`, then grants only `SELECT` with explicit public-read policies. There are no public insert, update, or delete policies. If authentication is added later, replace these policies with ownership-aware policies.

The Node seed importer writes through the server-side database role. Never expose that credential in Vite variables or browser code.
