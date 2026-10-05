# VAEP Explorer

VAEP Explorer is a web application for exploring football actions valued with VAEP (Valuing Actions by Estimating Probabilities). It turns StatsBomb Open Data into interactive match replays, player rankings, dashboard summaries, and quality-versus-quantity analysis.

The current implementation is the MVP described in the project SRS: React/Vite frontend, Express API, Supabase Postgres through Drizzle ORM, and an offline Python `socceraction` pipeline. VAEP values are model estimates and should complement, not replace, football analysis and scouting judgment.

## Implemented

- Dashboard with dataset totals, top players, action-type contribution, and recent actions
- Match action replay with play, pause, step, scrub, and speed controls
- Sortable and filterable VAEP leaderboard
- Interactive quality-versus-quantity scatter plot
- Read-only REST API with an OpenAPI contract and generated TypeScript clients
- Supabase-compatible PostgreSQL schema with RLS and read-only public policies
- StatsBomb-to-SPADL/VAEP Python pipeline and idempotent seed importer
- Responsive navigation, loading states, empty states, and API error states

The SRS marks the shot rewinder and full league/team/player explorer as lower-priority follow-on modules. Their status and the exact requirement mapping are recorded in [docs/REQUIREMENTS_TRACEABILITY.md](docs/REQUIREMENTS_TRACEABILITY.md).

## Repository layout

```text
artifacts/api-server/       Express API
artifacts/vaep-explorer/    React + Vite application
lib/api-spec/               OpenAPI source of truth
lib/api-client-react/       Generated browser client and types
lib/api-zod/                Generated server schemas
lib/db/                     Drizzle schema and PostgreSQL connection
pipeline/                   StatsBomb/SPADL/VAEP data pipeline
scripts/                    Database seed importer
supabase/schema.sql         Supabase SQL Editor schema
docs/                       User guide and requirements traceability
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the component and data-flow design.

## Prerequisites

- Node.js 22 or newer
- pnpm 10
- A Supabase project
- Python 3.11+ only when regenerating VAEP data

## Configure Supabase

1. In Supabase, open **SQL Editor** and run `supabase/schema.sql`, or use `pnpm db:setup` after configuring `.env`.
2. Open **Connect** and copy a PostgreSQL direct or session-pooler connection string.
3. Copy `.env.example` to `.env` and replace `DATABASE_URL` with that connection string.

`DATABASE_URL` must begin with `postgres://` or `postgresql://`; the `https://<project>.supabase.co` project URL is not a database connection string. Keep `.env` private. The browser never receives database credentials.

For more detail, see [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Install and run

```cmd
Terminal 1: Database and API Server
pnpm install --frozen-lockfile && pnpm db:setup && pnpm db:check

Extract DATABASE_URL from .env and set it as a variable
for /f "tokens=1,* delims==" %i in ('findstr "^DATABASE_URL=" .env') do set "DATABASE_URL=%j"

set PORT=3000
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/api-server start

Terminal 2: Frontend Explorer
set PORT=5173
set BASE_PATH=/
set API_URL=http://localhost:3000

pnpm --filter @workspace/vaep-explorer dev
```


```powershell
pnpm install --frozen-lockfile
pnpm db:setup
pnpm db:check

$env:PORT = "3000"
$env:DATABASE_URL = (Get-Content .env | Where-Object { $_ -like "DATABASE_URL=*" }).Substring(13)
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/api-server start
```

In a second terminal:

```powershell
$env:PORT = "5173"
$env:BASE_PATH = "/"
$env:API_URL = "http://localhost:3000"
pnpm --filter @workspace/vaep-explorer dev
```

Open `http://localhost:5173`.

## Load real data

Download StatsBomb Open Data into `data/statsbomb`, install the pipeline dependencies, and generate the seed file:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r pipeline\requirements.txt
python pipeline\download_statsbomb.py --data-root data\statsbomb --competition-id 43 --season-id 106 --max-matches 12
python pipeline\run_vaep.py --data-root data\statsbomb --competition-id 43 --season-id 106 --max-matches 12 --output data\seed_data.json
pnpm --filter @workspace/scripts seed
```

The raw dataset and generated seed file are intentionally ignored by Git. See [pipeline/README.md](pipeline/README.md) for the expected StatsBomb folder structure and attribution note.

## Quality checks

```powershell
pnpm run typecheck
pnpm run build
```

The CI workflow runs type checks and production builds on pushes and pull requests.

## API

All endpoints are under `/api`. Important routes include:

- `GET /api/healthz`
- `GET /api/matches`
- `GET /api/matches/{matchId}/actions`
- `GET /api/leaderboard`
- `GET /api/scatter`
- `GET /api/stats/overview`

The full contract is in [lib/api-spec/openapi.yaml](lib/api-spec/openapi.yaml).

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Requirements traceability](docs/REQUIREMENTS_TRACEABILITY.md)
- [Architecture](ARCHITECTURE.md)
- [Supabase setup](SUPABASE_SETUP.md)
- [Data pipeline](pipeline/README.md)

## License

MIT - see [LICENSE](LICENSE).
