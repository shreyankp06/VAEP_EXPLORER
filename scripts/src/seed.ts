import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db, actions, matches, players, playerStats } from "@workspace/db";

const seedSchema = z.object({
  matches: z.array(
    z.object({
      matchId: z.number().int(),
      homeTeam: z.string(),
      awayTeam: z.string(),
      homeScore: z.number().int(),
      awayScore: z.number().int(),
      competition: z.string(),
      season: z.string(),
    }),
  ),
  players: z.array(
    z.object({
      playerId: z.number().int(),
      name: z.string(),
      team: z.string(),
      position: z.string(),
    }),
  ),
  actions: z.array(
    z.object({
      actionId: z.number().int(),
      matchId: z.number().int(),
      playerId: z.number().int(),
      periodId: z.number().int(),
      timeSeconds: z.number(),
      actionType: z.string(),
      result: z.string(),
      startX: z.number(),
      startY: z.number(),
      endX: z.number(),
      endY: z.number(),
      vaepValue: z.number(),
      offensiveValue: z.number(),
      defensiveValue: z.number(),
    }),
  ),
  playerStats: z.array(
    z.object({
      playerId: z.number().int(),
      team: z.string(),
      totalVaep: z.number(),
      offensiveVaep: z.number(),
      defensiveVaep: z.number(),
      totalActions: z.number().int(),
      vaepPerAction: z.number(),
      minutesPlayed: z.number().nullable().optional(),
    }),
  ),
});

type SeedData = z.infer<typeof seedSchema>;

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from(
    { length: Math.ceil(items.length / size) },
    (_, index) => items.slice(index * size, (index + 1) * size),
  );
}

async function loadSeedData(): Promise<SeedData> {
  const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));
  const seedFile = process.env.SEED_FILE ?? path.join("data", "seed_data.json");
  const contents = await readFile(path.resolve(workspaceRoot, seedFile), "utf8");
  return seedSchema.parse(JSON.parse(contents));
}

async function seedDatabase(seedData: SeedData): Promise<void> {
  await db.transaction(async (transaction) => {
    const matchIds = new Map<number, number>();
    const matchRows = await transaction
        .insert(matches)
        .values(seedData.matches)
        .onConflictDoUpdate({
          target: matches.matchId,
          set: {
            homeTeam: sql`excluded.home_team`,
            awayTeam: sql`excluded.away_team`,
            homeScore: sql`excluded.home_score`,
            awayScore: sql`excluded.away_score`,
            competition: sql`excluded.competition`,
            season: sql`excluded.season`,
          },
        })
        .returning({ id: matches.id, matchId: matches.matchId });
    for (const row of matchRows) {
      matchIds.set(row.matchId, row.id);
    }

    const playerIds = new Map<number, number>();
    const playerRows = await transaction
        .insert(players)
        .values(seedData.players)
        .onConflictDoUpdate({
          target: players.playerId,
          set: {
            name: sql`excluded.name`,
            team: sql`excluded.team`,
            position: sql`excluded.position`,
          },
        })
        .returning({ id: players.id, playerId: players.playerId });
    for (const row of playerRows) {
      playerIds.set(row.playerId, row.id);
    }

    const actionRows = seedData.actions.map((action) => {
      const matchId = matchIds.get(action.matchId);
      const playerId = playerIds.get(action.playerId);
      if (matchId === undefined || playerId === undefined) {
        throw new Error(
          `Action ${action.actionId} references an unknown match or player`,
        );
      }
      return { ...action, matchId, playerId };
    });

    for (const batch of chunks(actionRows, 500)) {
      await transaction
        .insert(actions)
        .values(batch)
        .onConflictDoUpdate({
          target: [actions.matchId, actions.actionId],
          set: {
            playerId: sql`excluded.player_id`,
            periodId: sql`excluded.period_id`,
            timeSeconds: sql`excluded.time_seconds`,
            actionType: sql`excluded.action_type`,
            result: sql`excluded.result`,
            startX: sql`excluded.start_x`,
            startY: sql`excluded.start_y`,
            endX: sql`excluded.end_x`,
            endY: sql`excluded.end_y`,
            vaepValue: sql`excluded.vaep_value`,
            offensiveValue: sql`excluded.offensive_value`,
            defensiveValue: sql`excluded.defensive_value`,
          },
        });
    }

    const statsRows = seedData.playerStats.map((stats) => {
      const playerId = playerIds.get(stats.playerId);
      if (playerId === undefined) {
        throw new Error(`Stats reference an unknown player ${stats.playerId}`);
      }
      return { ...stats, playerId };
    });

    for (const batch of chunks(statsRows, 500)) {
      await transaction
        .insert(playerStats)
        .values(batch)
        .onConflictDoUpdate({
          target: playerStats.playerId,
          set: {
            team: sql`excluded.team`,
            totalVaep: sql`excluded.total_vaep`,
            offensiveVaep: sql`excluded.offensive_vaep`,
            defensiveVaep: sql`excluded.defensive_vaep`,
            totalActions: sql`excluded.total_actions`,
            vaepPerAction: sql`excluded.vaep_per_action`,
            minutesPlayed: sql`excluded.minutes_played`,
          },
        });
    }
  });
}

async function main(): Promise<void> {
  const seedData = await loadSeedData();
  await seedDatabase(seedData);
  console.log(
    `Seeded ${seedData.matches.length} matches, ${seedData.players.length} players, ${seedData.actions.length} actions, and ${seedData.playerStats.length} player stats.`,
  );
}

try {
  await main();
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
