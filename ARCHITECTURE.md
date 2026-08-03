# VAEP Explorer — Architecture Overview

> **Status:** Draft for review before implementation begins.

---

## 1. What Are We Building?

**VAEP Explorer** is an interactive football analytics dashboard that lets users visually explore player action values computed using the VAEP (Valuing Actions by Estimating Probabilities) model. It uses *precomputed* data — no ML training happens in this project.

**Prototype Modules:**
1. **Action Replay** — animated pitch showing action sequences with VAEP values
2. **VAEP Leaderboard** — ranked table of players by cumulative VAEP score
3. **Quality vs Quantity Scatter Plot** — VAEP per action vs total actions per player

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA PIPELINE (offline)                      │
│                                                                     │
│  StatsBomb Open Data  →  socceraction Python  →  SPADL Actions      │
│         (raw JSON)          (conversion)         (structured)       │
│                                ↓                                    │
│                     VAEP Computation (precomputed)                  │
│                                ↓                                    │
│               seed_data.json  →  Seeding Script                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                ↓
┌───────────────────────────────────────────────────────────────────┐
│                         BACKEND (Node.js / Express)               │
│                                                                   │
│  PostgreSQL (Drizzle ORM)  ←→  REST API Routes  ←→  Zod Schemas  │
│  - matches, players, teams                                        │
│  - actions (with VAEP values)                                     │
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
| Database | PostgreSQL | Scales beyond SQLite, already provisioned in Replit |
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
  period_id         integer          (1 or 2)
  time_seconds      real
  action_type       text             (pass, shot, dribble, tackle, …)
  result            text             (success, fail)
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
│   ├── Sidebar (navigation links + team branding)
│   └── TopBar (page title + search)
│
├── /dashboard         → overview stats, top 5 leaderboard widget, recent actions feed
├── /replay            → match selector → pitch animation + action list + VAEP panel
├── /leaderboard       → sortable table of all players with VAEP metrics
├── /scatter           → interactive Recharts scatter plot (quality vs quantity)
└── /players/:id       → player detail page (stats + their top actions)
```

---

## 7. Component Hierarchy (Prototype)

```
ActionReplayPage
├── MatchSelector (dropdown)
├── FootballPitch (SVG — 105×68m coordinate system)
│   ├── ActionArrow (animated arrow per action)
│   └── PlayerDot
├── ActionTimeline (horizontal scrubber)
├── ActionControls (play / pause / step / speed)
└── VAEPInfoPanel (action type, result, VAEP breakdown)

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
1. OFFLINE (Python, run once):
   StatsBomb JSON files
   → socceraction: parse into SPADL format (standardized action columns)
   → VAEP scores computed per action
   → Export: seed_data.json (matches, players, actions, player_stats)

2. SEEDING (Node.js script, run once):
   seed_data.json → parse → Drizzle INSERT → PostgreSQL tables

3. RUNTIME (every request):
   User opens /leaderboard
   → React Query calls useGetLeaderboard()
   → GET /api/leaderboard
   → Express handler → Drizzle SELECT from player_stats → JSON response
   → React renders LeaderboardTable with real data
```

---

## 10. Folder Structure

```
artifacts/
├── api-server/src/
│   ├── routes/
│   │   ├── matches.ts         (match list + match actions)
│   │   ├── leaderboard.ts
│   │   ├── players.ts
│   │   ├── scatter.ts
│   │   └── stats.ts           (dashboard aggregates)
│   └── app.ts
├── vaep-explorer/src/          (react-vite artifact — created next)
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── ReplayPage.tsx
│   │   ├── LeaderboardPage.tsx
│   │   └── ScatterPage.tsx
│   ├── components/
│   │   ├── layout/            (Sidebar, TopBar, Layout)
│   │   ├── pitch/             (FootballPitch, ActionArrow)
│   │   ├── charts/            (VAEPScatterChart, ActionTypeChart)
│   │   └── ui/                (shadcn components)
│   ├── hooks/                 (useReplayControls, usePlayerFilter)
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

*Ready to build? Approve this architecture and implementation starts immediately.*
