import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, sql, type SQLWrapper } from "drizzle-orm";
import { db, actions, matches, players, playerStats } from "@workspace/db";

const router: IRouter = Router();

const numberParam = (value: string | undefined, fallback?: number): number | undefined => {
  const parsed = value === undefined ? Number.NaN : Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const actionResponse = (row: {
  actionId: number;
  matchId: number;
  playerId: number;
  playerName: string;
  team: string;
  periodId: number;
  timeSeconds: number;
  actionType: string;
  result: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  vaepValue: number;
  offensiveValue: number;
  defensiveValue: number;
}) => ({
  id: row.actionId,
  actionId: row.actionId,
  matchId: row.matchId,
  playerId: row.playerId,
  playerName: row.playerName,
  team: row.team,
  periodId: row.periodId,
  timeSeconds: row.timeSeconds,
  actionType: row.actionType,
  result: row.result,
  startX: row.startX,
  startY: row.startY,
  endX: row.endX,
  endY: row.endY,
  vaepValue: row.vaepValue,
  offensiveValue: row.offensiveValue,
  defensiveValue: row.defensiveValue,
});

router.get("/matches", async (_request, response, next) => {
  try {
    const rows = await db.select().from(matches).orderBy(desc(matches.id));
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/matches/:matchId/actions", async (request, response, next) => {
  try {
    const externalMatchId = numberParam(request.params.matchId);
    if (externalMatchId === undefined) {
      response.status(400).json({ error: "matchId must be an integer" });
      return;
    }

    const rows = await db
      .select({
        actionId: actions.actionId,
        matchId: matches.matchId,
        playerId: players.playerId,
        playerName: players.name,
        team: players.team,
        periodId: actions.periodId,
        timeSeconds: actions.timeSeconds,
        actionType: actions.actionType,
        result: actions.result,
        startX: actions.startX,
        startY: actions.startY,
        endX: actions.endX,
        endY: actions.endY,
        vaepValue: actions.vaepValue,
        offensiveValue: actions.offensiveValue,
        defensiveValue: actions.defensiveValue,
      })
      .from(actions)
      .innerJoin(matches, eq(actions.matchId, matches.id))
      .innerJoin(players, eq(actions.playerId, players.id))
      .where(eq(matches.matchId, externalMatchId))
      .orderBy(asc(actions.periodId), asc(actions.timeSeconds), asc(actions.actionId));

    if (rows.length === 0) {
      const match = await db
        .select({ id: matches.id })
        .from(matches)
        .where(eq(matches.matchId, externalMatchId));
      if (match.length === 0) {
        response.status(404).json({ error: "Match not found" });
        return;
      }
    }

    response.json(rows.map(actionResponse));
  } catch (error) {
    next(error);
  }
});

router.get("/leaderboard", async (request, response, next) => {
  try {
    let sort: SQLWrapper = playerStats.totalVaep;
    if (request.query.sort === "vaep_per_action") {
      sort = playerStats.vaepPerAction;
    } else if (request.query.sort === "offensive_vaep") {
      sort = playerStats.offensiveVaep;
    } else if (request.query.sort === "defensive_vaep") {
      sort = playerStats.defensiveVaep;
    }
    const limit = Math.min(Math.max(numberParam(request.query.limit as string | undefined, 50) ?? 50, 1), 100);
    const offset = Math.max(numberParam(request.query.offset as string | undefined, 0) ?? 0, 0);
    const rows = await db
      .select({ stats: playerStats, player: players })
      .from(playerStats)
      .innerJoin(players, eq(playerStats.playerId, players.id))
      .orderBy(desc(sort))
      .limit(limit)
      .offset(offset);
    const total = await db.select({ count: sql<number>`count(*)` }).from(playerStats);
    response.json({
      players: rows.map(({ stats, player }) => ({ ...stats, id: stats.id, playerId: player.playerId, name: player.name, position: player.position })),
      total: Number(total[0]?.count ?? 0),
      offset,
      limit,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/players/:playerId", async (request, response, next) => {
  try {
    const externalPlayerId = numberParam(request.params.playerId);
    if (externalPlayerId === undefined) {
      response.status(400).json({ error: "playerId must be an integer" });
      return;
    }
    const rows = await db
      .select({ player: players, stats: playerStats })
      .from(players)
      .leftJoin(playerStats, eq(playerStats.playerId, players.id))
      .where(eq(players.playerId, externalPlayerId));
    const row = rows[0];
    if (!row) {
      response.status(404).json({ error: "Player not found" });
      return;
    }
    if (!row.stats) {
      response.status(404).json({ error: "Player statistics not found" });
      return;
    }
    response.json({
      ...row.player,
      playerId: row.player.playerId,
      stats: { ...row.stats, playerId: row.player.playerId, name: row.player.name, position: row.player.position },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/players/:playerId/actions", async (request, response, next) => {
  try {
    const externalPlayerId = numberParam(request.params.playerId);
    const limit = Math.min(Math.max(numberParam(request.query.limit as string | undefined, 100) ?? 100, 1), 500);
    if (externalPlayerId === undefined) {
      response.status(400).json({ error: "playerId must be an integer" });
      return;
    }
    const rows = await db
      .select({
        actionId: actions.actionId,
        matchId: matches.matchId,
        playerId: players.playerId,
        playerName: players.name,
        team: players.team,
        periodId: actions.periodId,
        timeSeconds: actions.timeSeconds,
        actionType: actions.actionType,
        result: actions.result,
        startX: actions.startX,
        startY: actions.startY,
        endX: actions.endX,
        endY: actions.endY,
        vaepValue: actions.vaepValue,
        offensiveValue: actions.offensiveValue,
        defensiveValue: actions.defensiveValue,
      })
      .from(actions)
      .innerJoin(matches, eq(actions.matchId, matches.id))
      .innerJoin(players, eq(actions.playerId, players.id))
      .where(eq(players.playerId, externalPlayerId))
      .orderBy(desc(actions.vaepValue))
      .limit(limit);
    response.json(rows.map(actionResponse));
  } catch (error) {
    next(error);
  }
});

router.get("/scatter", async (request, response, next) => {
  try {
    const minActions = Math.max(numberParam(request.query.minActions as string | undefined, 10) ?? 10, 0);
    const filters = [gte(playerStats.totalActions, minActions)];
    if (typeof request.query.team === "string" && request.query.team) filters.push(eq(playerStats.team, request.query.team));
    if (typeof request.query.position === "string" && request.query.position) filters.push(eq(players.position, request.query.position));
    const rows = await db
      .select({ stats: playerStats, player: players })
      .from(playerStats)
      .innerJoin(players, eq(playerStats.playerId, players.id))
      .where(and(...filters));
    response.json(rows.map(({ stats, player }) => ({ playerId: player.playerId, name: player.name, team: player.team, position: player.position, vaepPerAction: stats.vaepPerAction, totalActions: stats.totalActions, totalVaep: stats.totalVaep })));
  } catch (error) {
    next(error);
  }
});

router.get("/stats/overview", async (_request, response, next) => {
  try {
    const [playersCount, matchesCount, actionsCount, average, top] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(players),
      db.select({ count: sql<number>`count(*)` }).from(matches),
      db.select({ count: sql<number>`count(*)` }).from(actions),
      db.select({ value: sql<number>`coalesce(avg(${playerStats.vaepPerAction}), 0)` }).from(playerStats),
      db.select({ name: players.name, value: playerStats.totalVaep }).from(playerStats).innerJoin(players, eq(playerStats.playerId, players.id)).orderBy(desc(playerStats.totalVaep)).limit(1),
    ]);
    response.json({ totalPlayers: Number(playersCount[0]?.count ?? 0), totalMatches: Number(matchesCount[0]?.count ?? 0), totalActions: Number(actionsCount[0]?.count ?? 0), avgVaepPerAction: Number(average[0]?.value ?? 0), topPlayer: top[0]?.name ?? "", topPlayerVaep: Number(top[0]?.value ?? 0) });
  } catch (error) {
    next(error);
  }
});

router.get("/stats/top-players", async (_request, response, next) => {
  try {
    const rows = await db.select({ stats: playerStats, player: players }).from(playerStats).innerJoin(players, eq(playerStats.playerId, players.id)).orderBy(desc(playerStats.totalVaep)).limit(5);
    response.json(rows.map(({ stats, player }) => ({ ...stats, playerId: player.playerId, name: player.name, position: player.position })));
  } catch (error) {
    next(error);
  }
});

router.get("/stats/action-type-breakdown", async (_request, response, next) => {
  try {
    const rows = await db.select({ actionType: actions.actionType, totalVaep: sql<number>`coalesce(sum(${actions.vaepValue}), 0)`, count: sql<number>`count(*)`, avgVaep: sql<number>`coalesce(avg(${actions.vaepValue}), 0)` }).from(actions).groupBy(actions.actionType).orderBy(desc(sql`sum(${actions.vaepValue})`));
    response.json(rows.map((row) => ({ actionType: row.actionType, totalVaep: Number(row.totalVaep), count: Number(row.count), avgVaep: Number(row.avgVaep) })));
  } catch (error) {
    next(error);
  }
});

export default router;
