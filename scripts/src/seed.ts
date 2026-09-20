import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
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

async function loadSeedData(): Promise<SeedData> {
  const seedFile = process.env.SEED_FILE ?? path.join("data", "seed_data.json");
  const contents = await readFile(path.resolve(seedFile), "utf8");
  return seedSchema.parse(JSON.parse(contents));
}

async function seedDatabase(seedData: SeedData): Promise<void> {
  await db.transaction(async (transaction) => {
    const matchIds = new Map<number, number>();
    for (const match of seedData.matches) {
      const [row] = await transaction
        .insert(matches)
        .values(match)
        .onConflictDoUpdate({
          target: matches.matchId,
          set: match,
        })
        .returning({ id: matches.id, matchId: matches.matchId });
      matchIds.set(row.matchId, row.id);
    }

    const playerIds = new Map<number, number>();
    for (const player of seedData.players) {
      const [row] = await transaction
        .insert(players)
        .values(player)
        .onConflictDoUpdate({
          target: players.playerId,
          set: player,
        })
        .returning({ id: players.id, playerId: players.playerId });
      playerIds.set(row.playerId, row.id);
    }

    for (const action of seedData.actions) {
      const matchId = matchIds.get(action.matchId);
      const playerId = playerIds.get(action.playerId);
      if (matchId === undefined || playerId === undefined) {
        throw new Error(
          `Action ${action.actionId} references an unknown match or player`,
        );
      }

      await transaction
        .insert(actions)
        .values({ ...action, matchId, playerId })
        .onConflictDoUpdate({
          target: [actions.matchId, actions.actionId],
          set: {
            playerId,
            periodId: action.periodId,
            timeSeconds: action.timeSeconds,
            actionType: action.actionType,
            result: action.result,
            startX: action.startX,
            startY: action.startY,
            endX: action.endX,
            endY: action.endY,
            vaepValue: action.vaepValue,
            offensiveValue: action.offensiveValue,
            defensiveValue: action.defensiveValue,
          },
        });
    }

    for (const stats of seedData.playerStats) {
      const playerId = playerIds.get(stats.playerId);
      if (playerId === undefined) {
        throw new Error(`Stats reference an unknown player ${stats.playerId}`);
      }

      await transaction
        .insert(playerStats)
        .values({ ...stats, playerId })
        .onConflictDoUpdate({
          target: playerStats.playerId,
          set: {
            team: stats.team,
            totalVaep: stats.totalVaep,
            offensiveVaep: stats.offensiveVaep,
            defensiveVaep: stats.defensiveVaep,
            totalActions: stats.totalActions,
            vaepPerAction: stats.vaepPerAction,
            minutesPlayed: stats.minutesPlayed,
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