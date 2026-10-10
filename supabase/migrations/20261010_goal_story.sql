alter table public.actions
  add column if not exists is_goal boolean not null default false,
  add column if not exists goal_team text,
  add column if not exists goal_score_home integer,
  add column if not exists goal_score_away integer,
  add column if not exists possession_id integer;

alter table public.actions
  drop constraint if exists actions_goal_team_valid,
  add constraint actions_goal_team_valid
    check (goal_team is null or goal_team in ('home', 'away')),
  drop constraint if exists actions_goal_score_nonnegative,
  add constraint actions_goal_score_nonnegative
    check (
      (goal_score_home is null and goal_score_away is null)
      or (goal_score_home >= 0 and goal_score_away >= 0)
    );
