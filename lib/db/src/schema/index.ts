import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgTable,
	real,
	serial,
	text,
	unique,
} from "drizzle-orm/pg-core";

export const matches = pgTable(
	"matches",
	{
		id: serial("id").primaryKey(),
		matchId: integer("match_id").notNull(),
		homeTeam: text("home_team").notNull(),
		awayTeam: text("away_team").notNull(),
		homeScore: integer("home_score").notNull(),
		awayScore: integer("away_score").notNull(),
		competition: text("competition").notNull(),
		season: text("season").notNull(),
	},
	(table) => [
		unique("matches_match_id_unique").on(table.matchId),
		check("matches_home_score_nonnegative", sql`${table.homeScore} >= 0`),
		check("matches_away_score_nonnegative", sql`${table.awayScore} >= 0`),
	],
);

export const players = pgTable(
	"players",
	{
		id: serial("id").primaryKey(),
		playerId: integer("player_id").notNull(),
		name: text("name").notNull(),
		team: text("team").notNull(),
		position: text("position").notNull(),
	},
	(table) => [unique("players_player_id_unique").on(table.playerId)],
);

export const actions = pgTable(
	"actions",
	{
		id: serial("id").primaryKey(),
		actionId: integer("action_id").notNull(),
		matchId: integer("match_id")
			.notNull()
			.references(() => matches.id, { onDelete: "cascade" }),
		playerId: integer("player_id")
			.notNull()
			.references(() => players.id, { onDelete: "restrict" }),
		periodId: integer("period_id").notNull(),
		timeSeconds: real("time_seconds").notNull(),
		actionType: text("action_type").notNull(),
		result: text("result").notNull(),
		startX: real("start_x").notNull(),
		startY: real("start_y").notNull(),
		endX: real("end_x").notNull(),
		endY: real("end_y").notNull(),
		vaepValue: real("vaep_value").notNull(),
		offensiveValue: real("offensive_value").notNull(),
		defensiveValue: real("defensive_value").notNull(),
	},
	(table) => [
		unique("actions_match_action_unique").on(table.matchId, table.actionId),
		index("actions_match_id_index").on(table.matchId),
		index("actions_player_id_index").on(table.playerId),
		check("actions_period_positive", sql`${table.periodId} > 0`),
		check("actions_time_nonnegative", sql`${table.timeSeconds} >= 0`),
		check("actions_start_x_pitch_bounds", sql`${table.startX} between 0 and 105`),
		check("actions_end_x_pitch_bounds", sql`${table.endX} between 0 and 105`),
		check("actions_start_y_pitch_bounds", sql`${table.startY} between 0 and 68`),
		check("actions_end_y_pitch_bounds", sql`${table.endY} between 0 and 68`),
	],
);

export const playerStats = pgTable(
	"player_stats",
	{
		id: serial("id").primaryKey(),
		playerId: integer("player_id")
			.notNull()
			.references(() => players.id, { onDelete: "cascade" }),
		team: text("team").notNull(),
		totalVaep: real("total_vaep").notNull(),
		offensiveVaep: real("offensive_vaep").notNull(),
		defensiveVaep: real("defensive_vaep").notNull(),
		totalActions: integer("total_actions").notNull(),
		vaepPerAction: real("vaep_per_action").notNull(),
		minutesPlayed: real("minutes_played"),
	},
	(table) => [
		unique("player_stats_player_id_unique").on(table.playerId),
		index("player_stats_total_vaep_index").on(table.totalVaep),
		check("player_stats_total_actions_nonnegative", sql`${table.totalActions} >= 0`),
		check("player_stats_minutes_nonnegative", sql`${table.minutesPlayed} is null or ${table.minutesPlayed} >= 0`),
	],
);

export const matchesRelations = relations(matches, ({ many }) => ({
	actions: many(actions),
}));

export const playersRelations = relations(players, ({ many }) => ({
	actions: many(actions),
	stats: many(playerStats),
}));

export const actionsRelations = relations(actions, ({ one }) => ({
	match: one(matches, {
		fields: [actions.matchId],
		references: [matches.id],
	}),
	player: one(players, {
		fields: [actions.playerId],
		references: [players.id],
	}),
}));

export const playerStatsRelations = relations(playerStats, ({ one }) => ({
	player: one(players, {
		fields: [playerStats.playerId],
		references: [players.id],
	}),
}));

export type Match = typeof matches.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Action = typeof actions.$inferSelect;
export type PlayerStat = typeof playerStats.$inferSelect;
