import { pool } from "@workspace/db";

type AuditRow = {
  table_name: string;
  row_count: string;
  rls_enabled: boolean;
  anon_select: boolean;
  anon_insert: boolean;
  authenticated_select: boolean;
  authenticated_insert: boolean;
};

async function main(): Promise<void> {
  const result = await pool.query<AuditRow>(`
    with expected(table_name) as (
      values ('matches'), ('players'), ('actions'), ('player_stats')
    )
    select
      e.table_name,
      case e.table_name
        when 'matches' then (select count(*)::text from public.matches)
        when 'players' then (select count(*)::text from public.players)
        when 'actions' then (select count(*)::text from public.actions)
        when 'player_stats' then (select count(*)::text from public.player_stats)
      end as row_count,
      c.relrowsecurity as rls_enabled,
      has_table_privilege('anon', format('public.%I', e.table_name), 'select') as anon_select,
      has_table_privilege('anon', format('public.%I', e.table_name), 'insert') as anon_insert,
      has_table_privilege('authenticated', format('public.%I', e.table_name), 'select') as authenticated_select,
      has_table_privilege('authenticated', format('public.%I', e.table_name), 'insert') as authenticated_insert
    from expected e
    join pg_class c on c.relname = e.table_name
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    order by e.table_name
  `);

  if (result.rows.length !== 4) {
    throw new Error(`Expected 4 VAEP tables, found ${result.rows.length}`);
  }

  for (const row of result.rows) {
    if (
      !row.rls_enabled ||
      !row.anon_select ||
      row.anon_insert ||
      !row.authenticated_select ||
      row.authenticated_insert
    ) {
      throw new Error(`Security verification failed for ${row.table_name}`);
    }
  }

  const bounds = await pool.query<{
    invalid_coordinates: string;
    invalid_values: string;
  }>(`
    select
      count(*) filter (
        where start_x not between 0 and 105
           or end_x not between 0 and 105
           or start_y not between 0 and 68
           or end_y not between 0 and 68
      )::text as invalid_coordinates,
      count(*) filter (
        where vaep_value::text in ('NaN', 'Infinity', '-Infinity')
           or offensive_value::text in ('NaN', 'Infinity', '-Infinity')
           or defensive_value::text in ('NaN', 'Infinity', '-Infinity')
      )::text as invalid_values
    from public.actions
  `);

  if (
    bounds.rows[0]?.invalid_coordinates !== "0" ||
    bounds.rows[0]?.invalid_values !== "0"
  ) {
    throw new Error("Action data validation failed");
  }

  const goalAudit = await pool.query<{
    goal_count: string;
    shootout_goal_count: string;
    goals_without_possession: string;
    score_mismatches: string;
  }>(`
    with credited_goals as (
      select
        match_id,
        count(*) filter (where goal_team = 'home') as home_goals,
        count(*) filter (where goal_team = 'away') as away_goals
      from public.actions
      where is_goal
      group by match_id
    )
    select
      (select count(*) from public.actions where is_goal)::text as goal_count,
      (select count(*) from public.actions where is_goal and period_id = 5)::text as shootout_goal_count,
      (select count(*) from public.actions where is_goal and possession_id is null)::text as goals_without_possession,
      (
        select count(*)
        from public.matches m
        left join credited_goals g on g.match_id = m.id
        where coalesce(g.home_goals, 0) <> m.home_score
           or coalesce(g.away_goals, 0) <> m.away_score
      )::text as score_mismatches
  `);
  const goals = goalAudit.rows[0];
  if (
    !goals ||
    goals.goal_count !== "172" ||
    goals.shootout_goal_count !== "0" ||
    goals.goals_without_possession !== "0" ||
    goals.score_mismatches !== "0"
  ) {
    throw new Error(
      `Goal data validation failed: ${JSON.stringify(goals)}`,
    );
  }

  console.table(
    result.rows.map((row) => ({
      table: row.table_name,
      rows: Number(row.row_count),
      rls: row.rls_enabled,
      publicRead: row.anon_select && row.authenticated_select,
      publicWrite: row.anon_insert || row.authenticated_insert,
    })),
  );
  console.log(
    `Goal annotations: ${goals.goal_count}; shootout goals: ${goals.shootout_goal_count}; goals without possession: ${goals.goals_without_possession}; score mismatches: ${goals.score_mismatches}.`,
  );
}

try {
  await main();
} finally {
  await pool.end();
}
