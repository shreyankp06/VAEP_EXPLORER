# SRS requirements traceability

This matrix maps the supplied VAEP Explorer SRS v1.0 to the current repository. The SRS originally proposed Cloudflare D1/R2; the approved implementation uses Supabase Postgres behind an Express API while preserving the same offline-data and read-only-client boundaries.

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| REQ-1 load match action sequence | Implemented | `GET /api/matches/{matchId}/actions` and replay match selector |
| REQ-2 color actions by VAEP sign | Partial | Pitch renders value-aware arrows; neutral three-band legend remains to add |
| REQ-3 play, pause, forward, back, scrub | Implemented | Replay controls and progress slider |
| REQ-4 active action details | Implemented | Player, type, time, result, and exact VAEP panel |
| REQ-5 league/season leaderboard | Partial | Ranked leaderboard exists; explicit league/season API filters remain |
| REQ-6 sort rating, goals, assists, market value | Partial | VAEP metric sorting exists; source data has no goals, assists, or market value fields |
| REQ-7 action-type breakdown per player | Planned | Dataset supports action aggregation; expandable row chart remains |
| REQ-8 compare two players | Planned | Follow-on UI module |
| REQ-9 quality vs quantity with threshold | Implemented | Scatter endpoint and minimum-actions filter |
| REQ-10 top-player isoline | Planned | Follow-on chart enhancement |
| REQ-11 league, position, minutes filters | Partial | Position and action threshold implemented; league and minutes filters remain |
| REQ-12 shot lead-up sequence | Planned | Low-priority Shot Rewinder module |
| REQ-13 drag shot end location | Planned | Low-priority Shot Rewinder module |
| REQ-14 approximate recalculated VAEP | Blocked by product decision | SRS TBD-4 requires an agreed approximation model |
| REQ-15 league/team/player cascade | Planned | Low-priority League Explorer module |
| REQ-16 season trend | Planned | Requires time-series aggregation not in the current schema |
| REQ-17 similar players | Planned | Requires an agreed feature vector and distance definition |

## Nonfunctional coverage

- **Security:** database credentials remain server-only; RLS is enabled; public roles receive read-only grants and policies.
- **Maintainability:** frontend, API, database, API contract, and pipeline are separate workspaces with documented boundaries.
- **Accessibility:** semantic controls, accessible labels, visible states, responsive layouts, and readable base typography are present; a formal WCAG audit remains.
- **Performance:** indexed replay/player joins and bounded API pagination are present; the SRS response-time targets require deployed load testing.
- **Testability:** TypeScript type checks and production builds are automated. Pipeline unit tests and API integration tests remain before a production release.

## Recommended next milestone

Finish the remaining high/medium-priority items before the two low-priority SRS modules: league/season filters, player action breakdown, two-player comparison, scatter isoline, automated pipeline tests, API integration tests, and deployed performance/accessibility checks.
