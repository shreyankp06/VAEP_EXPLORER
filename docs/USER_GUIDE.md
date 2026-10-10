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

The pitch arrow shows the selected action. Home-team players are orange circles; away-team players are blue squares. The side panel displays the player, action type, match time, result, and stored VAEP components. Match clocks include the appropriate period offset, so second-half and extra-time events appear after the first half; shootout kicks use an `SO` clock.

The **Key-action timeline** marks goals separately from other shots, cards, substitutions, and larger model-estimated changes. A shot is not necessarily a goal: goal markers use the recorded StatsBomb outcome, not the VAEP value or shot location. The **Every goal** cards show the scorer, time, and score after the goal. Select a goal to see its shot on the pitch and **How the goal happened**, which lists up to ten recorded actions from the same possession. This event-feed context does not prove that every action caused the goal. Use the replay slider and step buttons to browse every recorded action. For a non-goal shot, **Actions before this shot** shows up to ten nearby feed actions and may cross possession changes.

In the inspector, **Attack contribution** and **Defence contribution** are the model's stored components; VAEP is their sum. A positive value is estimated to help the team, and a negative value is estimated to hurt it. These are not percentages or guaranteed outcomes. The model's outcome labels consider up to ten following actions. The application does not currently expose calibrated, per-action before/after probabilities from the model.

Penalty shootout actions are labeled **Shootout** in the replay and are not assigned standard VAEP values. They remain visible as events, but are excluded from model training, validation metrics, and player VAEP aggregates because shootout kicks are not ordinary match-play states.

Use **Key moments** for a chronological reel of shots and high-value actions. The playback controls step through those events and update the selected replay action. **Team activity** groups action start locations into nine pitch zones and can be filtered by team; it summarizes on-ball events, not player-tracking pressure or possession duration. **Compare players** places two players from the selected match side by side using action count, success rate, and offensive, defensive, and total VAEP. See [Research data, model and validation](RESEARCH_AND_DATA.md) for what the reported metrics do and do not establish.

## Leaderboard

Search by player, team, or position. Use the team selector to narrow the list and click a metric heading to sort. Pagination applies after the current search and filter.

`Total VAEP` rewards accumulated contribution, while `VAEP / action` emphasizes average action quality. Compare both; each tells a different story.

## Quality vs quantity

The horizontal axis is recorded action volume and the vertical axis is average VAEP per action. Filter by team, position, and minimum actions. Select a point to inspect that player. A very high average based on few actions should be interpreted cautiously.

## Troubleshooting

- **The UI shows an API error:** confirm the API is running on port 3000 and Vite's `API_URL` points to it.
- **The API reports an invalid database URL:** use the PostgreSQL connection string from Supabase **Connect**, not the HTTPS project URL.
- **Pages are empty:** run the SQL schema, generate `data/seed_data.json`, and run the seed importer.
- **A scored match has no goal recap:** apply `supabase/migrations/20261010_goal_story.sql` in Supabase SQL Editor, then import `data/seed_data_64_goals.json` with `SEED_FILE` set to that path. Run `pnpm db:check` to verify the imported goal annotations and score totals.
- **A match has no replay actions:** confirm its actions were included in the generated seed data.
