"""Add goal and possession metadata to an existing seed without recalculating VAEP."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from socceraction.data.statsbomb import StatsBombLoader
import socceraction.spadl as spadl
from socceraction.spadl import statsbomb as spadl_statsbomb

from goal_story import build_action_annotations


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--competition-id", type=int, required=True)
    parser.add_argument("--season-id", type=int, required=True)
    return parser.parse_args()


def enrich_seed(
    seed: dict[str, Any],
    loader: StatsBombLoader,
    competition_id: int,
    season_id: int,
) -> None:
    games = loader.games(competition_id=competition_id, season_id=season_id).set_index(
        "game_id"
    )
    actions_by_match: dict[int, list[dict[str, Any]]] = {}
    for action in seed["actions"]:
        actions_by_match.setdefault(action["matchId"], []).append(action)

    for match in seed["matches"]:
        match_id = match["matchId"]
        if match_id not in games.index:
            raise ValueError(f"Match {match_id} is not in the selected StatsBomb season")
        game = games.loc[match_id]
        events = loader.events(match_id)
        spadl_actions = spadl.add_names(
            spadl_statsbomb.convert_to_actions(events, int(game.home_team_id))
        )
        annotations = build_action_annotations(
            spadl_actions,
            events,
            int(game.home_team_id),
            int(game.away_team_id),
            match["homeScore"],
            match["awayScore"],
        )
        seed_actions = actions_by_match.get(match_id, [])
        action_ids = {action["actionId"] for action in seed_actions}
        if action_ids != set(annotations):
            raise ValueError(f"Seed/SPADL action IDs do not match for match {match_id}")
        for action in seed_actions:
            action.update(annotations[action["actionId"]])


def main() -> None:
    args = parse_args()
    seed = json.loads(args.input.read_text(encoding="utf-8"))
    loader = StatsBombLoader(getter="local", root=str(args.data_root))
    enrich_seed(seed, loader, args.competition_id, args.season_id)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(seed, indent=2), encoding="utf-8")
    goal_count = sum(action["isGoal"] for action in seed["actions"])
    print(
        f"Added possession metadata and reconciled {goal_count} goals across "
        f"{len(seed['matches'])} matches; VAEP values were preserved in {args.output}."
    )


if __name__ == "__main__":
    main()
