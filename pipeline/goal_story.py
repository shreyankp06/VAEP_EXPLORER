"""Attach StatsBomb goal and possession facts to existing SPADL action IDs."""

from __future__ import annotations

from typing import Any

import pandas as pd


def _event_possession(event: pd.Series) -> int | None:
    value = event.get("possession")
    return None if pd.isna(value) else int(value)


def build_action_annotations(
    actions: pd.DataFrame,
    events: pd.DataFrame,
    home_team_id: int,
    away_team_id: int,
    home_score: int,
    away_score: int,
) -> dict[int, dict[str, Any]]:
    """Map each action to its source possession and annotate goals with score-after."""
    event_by_id = events.set_index("event_id", drop=False)
    annotations: dict[int, dict[str, Any]] = {}
    source_actions: dict[str, int] = {}

    for action in actions.itertuples(index=False):
        source_event_id = action.original_event_id
        event_id = None if pd.isna(source_event_id) else str(source_event_id)
        event = event_by_id.loc[event_id] if event_id in event_by_id.index else None
        if event is None:
            candidates = events.loc[
                (events["period_id"] == action.period_id)
                & (events["team_id"] == action.team_id)
                & (events["player_id"] == action.player_id)
            ]
            if not candidates.empty:
                distances = candidates["timestamp"].map(
                    lambda timestamp: abs(timestamp.total_seconds() - action.time_seconds)
                )
                nearest_index = distances.idxmin()
                if distances.loc[nearest_index] <= 8:
                    event = candidates.loc[nearest_index]
        annotations[int(action.action_id)] = {
            "isGoal": False,
            "goalTeam": None,
            "goalScoreHome": None,
            "goalScoreAway": None,
            "possessionId": None if event is None else _event_possession(event),
        }
        if event_id is not None:
            source_actions[event_id] = int(action.action_id)

    goal_events: list[tuple[int, int, str, int]] = []
    for event in events.itertuples(index=False):
        if int(event.period_id) == 5:
            continue
        event_type = str(event.type_name).lower()
        extra = event.extra if isinstance(event.extra, dict) else {}
        shot = extra.get("shot", {})
        is_scored_shot = (
            event_type == "shot"
            and isinstance(shot, dict)
            and shot.get("outcome", {}).get("name") == "Goal"
        )
        is_own_goal = event_type == "own goal against"
        if is_scored_shot or is_own_goal:
            if str(event.event_id) not in source_actions:
                raise ValueError(f"Goal event {event.event_id} has no matching SPADL action")
            credited_team_id = int(event.team_id)
            if is_own_goal:
                credited_team_id = (
                    home_team_id if credited_team_id == away_team_id else away_team_id
                )
            goal_events.append(
                (int(event.period_id), int(event.index), str(event.event_id), credited_team_id)
            )

    scores = {home_team_id: 0, away_team_id: 0}
    for _, _, event_id, credited_team_id in sorted(goal_events):
        if credited_team_id not in scores:
            raise ValueError(f"Goal event {event_id} belongs to an unexpected team")
        scores[credited_team_id] += 1
        annotations[source_actions[event_id]].update(
            {
                "isGoal": True,
                "goalTeam": (
                    "home" if credited_team_id == home_team_id else "away"
                ),
                "goalScoreHome": scores[home_team_id],
                "goalScoreAway": scores[away_team_id],
            }
        )

    if scores[home_team_id] != home_score or scores[away_team_id] != away_score:
        raise ValueError(
            "StatsBomb goal events do not reconcile with the final score: "
            f"events {scores[home_team_id]}-{scores[away_team_id]}, "
            f"match {home_score}-{away_score}"
        )
    return annotations
