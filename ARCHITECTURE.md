# VAEP Explorer — Architecture Overview

> **Status:** Implemented research explorer. Last updated October 10, 2026.

---

## 1. What Are We Building?

**VAEP Explorer** is an interactive football analytics application for exploring action-level VAEP (Valuing Actions by Estimating Probabilities). A separate offline Python pipeline converts StatsBomb events to SPADL, trains scoring and conceding classifiers, computes action values, and exports a seed. The running web application serves those stored values; it does not train models or recalculate VAEP at request time.

**Prototype Modules:**
1. **Match report and replay** — score, distinct home/away player markers, action playback, shot context, and a selective match-story timeline
2. **Key moments, activity, actions, players, and comparisons** — match-scoped exploration with plain-language interpretation
3. **VAEP Leaderboard** — ranked table of players by cumulative VAEP score
4. **Quality vs Quantity Scatter Plot** — VAEP per action vs total actions per player

The SRS also describes a Shot Rewinder and a full League Explorer. Those are lower-priority follow-on modules and are tracked in `docs/REQUIREMENTS_TRACEABILITY.md`; they are not presented as completed features.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA PIPELINE (offline)                      │
│                                                                     │
│  StatsBomb Open Data  →  socceraction Python  →  SPADL Actions      │
│         (raw JSON)          (conversion)         (structured)       │
│                                ↓                                    │
│              CatBoost score/concede models + VAEP                  │
│     (goal/possession facts are a separate enrichment step)          │
│                                ↓                                    │
│ enriched seed + metadata + models → Seeding Script                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                ↓
┌───────────────────────────────────────────────────────────────────┐
│                         BACKEND (Node.js / Express)               │
│                                                                   │
│  PostgreSQL (Drizzle ORM)  ←→  REST API Routes  ←→  Zod Schemas  │
│  - matches, players, teams                                        │
│  - actions (VAEP + goal/score/possession facts)                   │
│  - player_stats (aggregated)                                      │
└───────────────────────────────┬───────────────────────────────────┘
                                ↓ /api/*
┌───────────────────────────────────────────────────────────────────┐
│                       FRONTEND (React + Vite)                     │
│                                                                   │
│  React Query hooks (generated from OpenAPI)                       │
│  TailwindCSS + shadcn/ui + Framer Motion + Recharts               │
│                                                                   │
│  Pages:  /dashboard  /replay  /leaderboard  /scatter              │
└───────────────────────────────────────────────────────────────────┘
```

**Key principle:** The data pipeline (Python + socceraction) is a *one-time offline step* that produces JSON files. The app itself is a standard fullstack web app — React frontend + Express backend + PostgreSQL.

For the current deployment's specific data counts, model settings, validation metrics, shootout treatment, and research limitations, see [`docs/RESEARCH_AND_DATA.md`](docs/RESEARCH_AND_DATA.md).

---

## 3. Technology Justification

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | React + Vite + TypeScript | Industry standard, component model ideal for dashboards |
| Styling | TailwindCSS + shadcn/ui | Utility-first + accessible pre-built components |
| Animation | Framer Motion | Declarative animations for pitch replay |
| Charts | Recharts | React-native, composable, works well with TypeScript |
| Server state | TanStack React Query | Auto caching, loading/error states, ideal for dashboards |
| Backend | Express (Node.js) | Already configured in monorepo, team knows JS/TS |
| ORM | Drizzle ORM | TypeScript-first, migrations are simple SQL |
| Database | Supabase Postgres | Managed PostgreSQL, pooled connections, RLS, and a simple free-tier handoff |
| API Contract | OpenAPI 3.1 + Orval codegen | Single source of truth, auto-generates typed hooks |

---

## 4. Database Schema

```
matches
  id          serial PK
  match_id    integer  (StatsBomb match ID)
  home_team   text
  away_team   text
  home_score  integer
  away_score  integer
  competition text
  season      text

players
  id          serial PK
  player_id   integer  (StatsBomb player ID)
  name        text
  team        text
  position    text

actions
  id                serial PK
  action_id         integer
  match_id          integer → matches.id
  player_id         integer → players.id
  period_id         integer          (1–5; period 5 is penalty shootout)
  time_seconds      real
  action_type       text             (pass, shot, dribble, tackle, …)
  result            text             (success, fail)
  is_goal           boolean
  goal_team         text             (home, away; credited scoring side)
  goal_score_home   integer          (score immediately after goal)
  goal_score_away   integer
  possession_id     integer          (StatsBomb event possession)
  start_x           real             (0–105 metres)
  start_y           real             (0–68 metres)
  end_x             real
  end_y             real
  vaep_value        real             (composite VAEP score)
  offensive_value   real
  defensive_value   real

player_stats
  id                 serial PK
  player_id          integer → players.id
  team               text
  total_vaep         real
  offensive_vaep     real
  defensive_vaep     real
  total_actions      integer
  vaep_per_action    real            (quality metric)
  minutes_played     real
```

---

## 5. API Endpoints (OpenAPI-first)

```
GET  /api/healthz                          → health check

GET  /api/matches                          → list all matches
GET  /api/matches/:matchId/actions         → all actions in a match (for replay)

GET  /api/leaderboard                      → players ranked by total_vaep
     ?sort=total_vaep|vaep_per_action|offensive_vaep|defensive_vaep
     ?limit=50&offset=0

GET  /api/players/:playerId                → player detail + career stats
GET  /api/players/:playerId/actions        → all actions for a player (for scatter)

GET  /api/scatter                          → { playerId, name, team, vaepPerAction, totalActions }[]

GET  /api/stats/overview                   → dashboard summary (total actions, avg VAEP, top player)
GET  /api/stats/top-players                → top 5 players by VAEP (dashboard widget)
GET  /api/stats/action-type-breakdown      → action types grouped by VAEP contribution
```

---

## 6. Frontend Page Hierarchy

```
App
├── Layout
│   ├── Primary navigation (Match report, Atlas, Players, Quality)
│   └── Responsive page shell
│
├── / and /replay      → match archive, replay, pitch, inspector, and match-story timeline
├── /atlas             → dashboard overview
├── /leaderboard       → sortable player VAEP table
└── /scatter           → interactive quality-versus-quantity chart
```

---

## 7. Component Hierarchy (Prototype)

```
ReplayPage
├── MatchHero + plain-language introduction
├── MatchSectionNavigation
├── InteractivePitch
│   ├── home/away markers with distinct colors and shapes
│   ├── selected action path and receiver context
│   ├── goal cards, score-after, and same-possession buildup
│   ├── playback controls and non-goal shot context
│   └── ActionInspector (stored VAEP parts; no reconstructed probabilities)
├── SelectiveKeyActionTimeline (shots, cards, substitutions, high VAEP changes)
└── KeyMoments / TeamActivity / AllActions / Players / Compare / Sequences

LeaderboardPage
├── SortControls
├── LeaderboardTable
│   └── PlayerRow (rank, name, team, VAEP metrics)
└── Pagination

ScatterPage
├── FilterBar (team, position, min actions)
├── VAEPScatterChart (Recharts ScatterChart)
│   └── PlayerTooltip (hover: name, team, values)
└── SelectedPlayerCard

DashboardPage
├── OverviewStats (4 KPI cards)
├── TopPlayersWidget (mini leaderboard)
├── ActionTypeBreakdown (bar chart)
└── RecentActionsWidget
```

---

## 8. State Management

| Kind | Tool | Where |
|---|---|---|
| **Server state** (data from API) | TanStack React Query | `useGetLeaderboard()`, `useGetMatchActions()`, etc. — auto-generated |
| **UI state** (selected match, active player, play/pause) | React `useState` / `useReducer` | Local to each page component |
| **Shared UI state** (sidebar open, filters) | React Context | `UIContext` at app root |
| **No Redux** | — | Scale doesn't justify it |

**Why React Query for server state?** It handles caching, refetching, loading/error states automatically. When you call `useGetLeaderboard()`, you don't write a single `useEffect` or `fetch` — the hook manages everything.

---

## 9. Data Flow: StatsBomb → Frontend

```
1. OFFLINE (Python, explicit research refresh):
   StatsBomb JSON files
   → socceraction: parse into SPADL format (standardized action columns)
   → CatBoost scoring/conceding models fit on standard-play actions
   → VAEP values computed
   → shootout rows retained with zero VAEP
   → Export: seed_data_64.json, metadata, and model artifacts

2. ENRICH (Python, when adding goal stories to an existing seed):
   Existing seed + corresponding StatsBomb events
   → join regular-play goal and possession facts by source event ID
   → verify goals reconcile with each match's final score
   → Export: seed_data_64_goals.json; preserve VAEP and player aggregates

3. SEEDING (Node.js script):
   selected seed JSON → parse → transactional Drizzle upsert → PostgreSQL tables

3. RUNTIME (every request):
   User selects a match
   → React Query requests GET /api/matches/{matchId}/actions
   → Express handler → Drizzle SELECT from actions and players
   → React formats period-relative seconds as a continuous match clock
   → replay renders goals, score-after, same-possession buildup, and stored VAEP
```

The action API stores VAEP components, not per-action probabilities before and
after each event. The UI therefore presents stored value components and their
plain-language meaning rather than reconstructing probability percentages.
Goal facts are taken from StatsBomb outcomes (including own goals) and
reconciled to the match's final score. Possession IDs constrain the buildup
shown to fans; the sequence is event-feed context, not proof of causation.
The goal-story enrichment does not refit models or recalculate VAEP. Existing
databases need the goal-story migration before importing an enriched seed; the
current Supabase deployment has the migration and enriched seed applied and
passes the goal-count and final-score audit.

---

## 10. Folder Structure

```
artifacts/
├── api-server/src/
│   ├── routes/
│   │   ├── data.ts            (matches, actions, players, leaderboard, stats)
│   │   └── health.ts
│   └── app.ts
├── vaep-explorer/src/          (React + Vite application)
│   ├── pages/                  (dashboard, leaderboard, replay, scatter)
│   ├── components/             (layout, pitch, charts, shared UI)
│   ├── hooks/api/useMatches.ts (match/action queries and match-clock normalization)
│   ├── lib/                    (formatting and VAEP presentation helpers)
│   └── App.tsx

lib/
├── api-spec/openapi.yaml       (source of truth)
├── api-client-react/           (generated React Query hooks)
├── api-zod/                    (generated Zod schemas for server)
└── db/src/schema/
    ├── matches.ts
    ├── players.ts
    ├── actions.ts
    └── player_stats.ts
```

---

## 11. Implementation Milestones (8 Weeks)

| Week | Milestone | Deliverable |
|---|---|---|
| 1 | **Architecture + Project Setup** | Monorepo running, DB schema, OpenAPI spec, codegen |
| 2 | **Global Layout + Dashboard** | Sidebar nav, KPI cards, top players widget |
| 3 | **Leaderboard** | Sortable/filterable player table, pagination |
| 4 | **Action Replay — Pitch** | SVG pitch, coordinate mapping, action arrows |
| 5 | **Action Replay — Controls** | Play/pause/step animation, VAEP panel |
| 6 | **Scatter Plot** | Interactive Recharts scatter, tooltips, filters |
| 7 | **Data Pipeline** | Python socceraction script, seeding with real data |
| 8 | **Polish + Testing** | Error states, empty states, performance, deployment |

---

## 12. UI/UX Philosophy

- **Data-first clarity:** Users see real data immediately — no empty states on first load (seed data provided).
- **Progressive disclosure:** Dashboard → drill-down to player detail. Never overwhelm with all data at once.
- **Spatial grounding:** The football pitch is the primary metaphor — everything anchors to real pitch coordinates.
- **VAEP education:** Every screen explains what VAEP means in context (tooltips, inline labels). Users learn by exploring.
- **Responsive layout:** Works on laptop (primary) and tablet.

---

## 13. Risks & Challenges

| Risk | Mitigation |
|---|---|
| Coordinate system mismatch (SPADL uses 0–105, 0–68) | Normalize to SVG viewport in one utility function |
| Large action datasets slow the API | Paginate + index `match_id` and `player_id` columns |
| StatsBomb data pipeline requires Python | Provide a pre-seeded JSON file so the app works without Python setup |
| Scatter plot too dense with many players | Add filters (min actions, team, position) and use canvas if >500 points |
| Replay animation timing | Use Framer Motion's `animate` with sequenced variants, not `setInterval` |

---

For setup and operating instructions, start with `README.md`. For the exact SRS coverage, see `docs/REQUIREMENTS_TRACEABILITY.md`; for dataset/model/validation details, see `docs/RESEARCH_AND_DATA.md`.
