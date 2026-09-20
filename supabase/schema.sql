create table if not exists public.matches (
  id serial primary key,
  match_id integer not null,
  home_team text not null,
  away_team text not null,
  home_score integer not null,
  away_score integer not null,
  competition text not null,
  season text not null,
  constraint matches_match_id_unique unique (match_id),
  constraint matches_home_score_nonnegative check (home_score >= 0),
  constraint matches_away_score_nonnegative check (away_score >= 0)
);

create table if not exists public.players (
  id serial primary key,
  player_id integer not null,
  name text not null,
  team text not null,
  position text not null,
  constraint players_player_id_unique unique (player_id)
);

create table if not exists public.actions (
  id serial primary key,
  action_id integer not null,
  match_id integer not null references public.matches(id) on delete cascade,
  player_id integer not null references public.players(id) on delete restrict,
  period_id integer not null,
  time_seconds real not null,
  action_type text not null,
  result text not null,
  start_x real not null,
  start_y real not null,
  end_x real not null,
  end_y real not null,
  vaep_value real not null,
  offensive_value real not null,
  defensive_value real not null,
  constraint actions_match_action_unique unique (match_id, action_id),
  constraint actions_period_positive check (period_id > 0),
  constraint actions_time_nonnegative check (time_seconds >= 0),
  constraint actions_start_x_pitch_bounds check (start_x between 0 and 105),
  constraint actions_end_x_pitch_bounds check (end_x between 0 and 105),
  constraint actions_start_y_pitch_bounds check (start_y between 0 and 68),
  constraint actions_end_y_pitch_bounds check (end_y between 0 and 68)
);

create index if not exists actions_match_id_index on public.actions(match_id);
create index if not exists actions_player_id_index on public.actions(player_id);

create table if not exists public.player_stats (
  id serial primary key,
  player_id integer not null references public.players(id) on delete cascade,
  team text not null,
  total_vaep real not null,
  offensive_vaep real not null,
  defensive_vaep real not null,
  total_actions integer not null,
  vaep_per_action real not null,
  minutes_played real,
  constraint player_stats_player_id_unique unique (player_id),
  constraint player_stats_total_actions_nonnegative check (total_actions >= 0),
  constraint player_stats_minutes_nonnegative check (minutes_played is null or minutes_played >= 0)
);

create index if not exists player_stats_total_vaep_index on public.player_stats(total_vaep);

alter table public.matches enable row level security;
alter table public.players enable row level security;
alter table public.actions enable row level security;
alter table public.player_stats enable row level security;

revoke all on public.matches, public.players, public.actions, public.player_stats from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.matches, public.players, public.actions, public.player_stats to anon, authenticated;

drop policy if exists "public read matches" on public.matches;
drop policy if exists "public read players" on public.players;
drop policy if exists "public read actions" on public.actions;
drop policy if exists "public read player stats" on public.player_stats;

create policy "public read matches" on public.matches for select using (true);
create policy "public read players" on public.players for select using (true);
create policy "public read actions" on public.actions for select using (true);
create policy "public read player stats" on public.player_stats for select using (true);
