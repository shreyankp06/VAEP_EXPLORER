# VAEP Explorer user guide

## What VAEP means

VAEP estimates how an on-ball action changes a team's probability of scoring and conceding. Positive values indicate an action improved the team's expected outcome; negative values indicate the opposite. Values are model estimates, not definitive judgments of player quality.

## Dashboard

The dashboard summarizes the loaded dataset. Use the KPI cards to check coverage, the top-player list to identify high cumulative contributors, and the action-type chart to see where value is created. Empty or zero values normally mean the database has not been seeded yet.

## Action replay

1. Choose a match from the selector.
2. Use Play/Pause or the previous/next buttons to move through actions.
3. Drag the progress slider to jump to any step.
4. Change playback speed when reviewing a longer sequence.

The pitch arrow shows the action's start and end positions. The side panel displays the player, action type, match time, result, and offensive/defensive VAEP components.

## Leaderboard

Search by player, team, or position. Use the team selector to narrow the list and click a metric heading to sort. Pagination applies after the current search and filter.

`Total VAEP` rewards accumulated contribution, while `VAEP / action` emphasizes average action quality. Compare both; each tells a different story.

## Quality vs quantity

The horizontal axis is recorded action volume and the vertical axis is average VAEP per action. Filter by team, position, and minimum actions. Select a point to inspect that player. A very high average based on few actions should be interpreted cautiously.

## Troubleshooting

- **The UI shows an API error:** confirm the API is running on port 3000 and Vite's `API_URL` points to it.
- **The API reports an invalid database URL:** use the PostgreSQL connection string from Supabase **Connect**, not the HTTPS project URL.
- **Pages are empty:** run the SQL schema, generate `data/seed_data.json`, and run the seed importer.
- **A match has no replay actions:** confirm its actions were included in the generated seed data.
