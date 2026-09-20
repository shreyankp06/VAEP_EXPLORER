"""Build seed_data.json from StatsBomb event data with socceraction VAEP."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from socceraction.data.statsbomb import StatsBombLoader
import socceraction.spadl as spadl
from socceraction.spadl import statsbomb as spadl_statsbomb
from socceraction.spadl import play_left_to_right
from socceraction.vaep import features as vaep_features
from socceraction.vaep import formula as vaep_formula
from socceraction.vaep import labels as vaep_labels


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/seed_data.json"))
    parser.add_argument("--competition-id", type=int, required=True)
    parser.add_argument("--season-id", type=int, required=True)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--random-state", type=int, default=42)
    return parser.parse_args()


def build_features(actions: pd.DataFrame, home_team_id: int) -> pd.DataFrame:
    game_states = vaep_features.gamestates(actions, nb_prev_actions=3)
    game_states = vaep_features.play_left_to_right(game_states, home_team_id)
    feature_functions = [
        vaep_features.actiontype,
        vaep_features.result,
        vaep_features.bodypart,
        vaep_features.time,
        vaep_features.startlocation,
        vaep_features.endlocation,
        vaep_features.startpolar,
        vaep_features.endpolar,
        vaep_features.movement,
        vaep_features.team,
        vaep_features.time_delta,
        vaep_features.space_delta,
        vaep_features.goalscore,
    ]
    return pd.concat([feature_function(game_states) for feature_function in feature_functions], axis=1)


def train_models(features: pd.DataFrame, labels: pd.DataFrame, test_size: float, random_state: int) -> dict[str, XGBClassifier]:
    usable = features.replace([float("inf"), float("-inf")], pd.NA).dropna().index
    x_values = features.loc[usable]
    y_values = labels.loc[usable]
    if len(x_values) < 2:
        raise ValueError("At least two usable actions are required to train VAEP models")

    train_indices, _ = train_test_split(
        x_values.index,
        test_size=test_size,
        random_state=random_state,
    )
    models: dict[str, XGBClassifier] = {}
    for target in ("scores", "concedes"):
        model = XGBClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=random_state,
        )
        model.fit(x_values.loc[train_indices], y_values.loc[train_indices, target])
        models[target] = model
    return models


def value_actions(actions: pd.DataFrame, features: pd.DataFrame, models: dict[str, XGBClassifier]) -> pd.DataFrame:
    valid_features = features.replace([float("inf"), float("-inf")], pd.NA).fillna(0)
    probabilities = {
        target: model.predict_proba(valid_features)[:, 1]
        for target, model in models.items()
    }
    return vaep_formula.value(actions, probabilities["scores"], probabilities["concedes"])


def number(value: Any, fallback: float = 0.0) -> float:
    return fallback if pd.isna(value) else float(value)


def action_records(actions: pd.DataFrame, values: pd.DataFrame, game_id: int) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for position, action in actions.reset_index(drop=True).iterrows():
        value = values.iloc[position]
        records.append(
            {
                "actionId": int(position),
                "matchId": game_id,
                "playerId": int(action["player_id"]),
                "periodId": int(action["period_id"]),
                "timeSeconds": number(action["time_seconds"]),
                "actionType": str(action["type_name"]),
                "result": str(action["result_name"]),
                "startX": number(action.get("start_x")),
                "startY": number(action.get("start_y")),
                "endX": number(action.get("end_x")),
                "endY": number(action.get("end_y")),
                "vaepValue": number(value["vaep_value"]),
                "offensiveValue": number(value["offensive_value"]),
                "defensiveValue": number(value["defensive_value"]),
            }
        )
    return records


def main() -> None:
    args = parse_args()
    loader = StatsBombLoader(getter="local", root=str(args.data_root))
    games = loader.games(competition_id=args.competition_id, season_id=args.season_id)
    if games.empty:
        raise ValueError("No matches found for the supplied competition and season")

    prepared: list[dict[str, Any]] = []
    all_actions: list[pd.DataFrame] = []
    all_features: list[pd.DataFrame] = []
    all_labels: list[pd.DataFrame] = []

    for game in games.itertuples(index=False):
        events = loader.events(game.game_id)
        actions = spadl_statsbomb.convert_to_actions(events, game.home_team_id)
        actions = spadl.add_names(actions)
        actions = play_left_to_right(actions, game.home_team_id)
        features = build_features(actions, game.home_team_id)
        labels = pd.concat(
            [vaep_labels.scores(actions), vaep_labels.concedes(actions)], axis=1
        )
        all_actions.append(actions)
        all_features.append(features)
        all_labels.append(labels)
        prepared.append({"game": game, "actions": actions, "features": features})

    features = pd.concat(all_features, ignore_index=True)
    labels = pd.concat(all_labels, ignore_index=True)
    models = train_models(features, labels, args.test_size, args.random_state)

    matches: list[dict[str, Any]] = []
    players: dict[int, dict[str, Any]] = {}
    action_rows: list[dict[str, Any]] = []
    stats: dict[int, dict[str, Any]] = {}
    for item in prepared:
        game = item["game"]
        actions = item["actions"]
        features = item["features"]
        values = value_actions(actions, features, models)
        match_id = int(game.game_id)
        teams = loader.teams(match_id).set_index("team_id")["team_name"].to_dict()
        matches.append(
            {
                "matchId": match_id,
                "homeTeam": str(teams[game.home_team_id]),
                "awayTeam": str(teams[game.away_team_id]),
                "homeScore": int(game.home_score),
                "awayScore": int(game.away_score),
                "competition": str(args.competition_id),
                "season": str(args.season_id),
            }
        )
        action_rows.extend(action_records(actions, values, match_id))

        lineup = loader.players(match_id)
        for player in lineup.itertuples(index=False):
            player_id = int(player.player_id)
            players[player_id] = {
                "playerId": player_id,
                "name": str(player.player_name),
                "team": str(player.team_name),
                "position": str(getattr(player, "starting_position_name", "Unknown") or "Unknown"),
            }
            stats.setdefault(
                player_id,
                {
                    "playerId": player_id,
                    "team": str(player.team_name),
                    "totalVaep": 0.0,
                    "offensiveVaep": 0.0,
                    "defensiveVaep": 0.0,
                    "totalActions": 0,
                    "vaepPerAction": 0.0,
                    "minutesPlayed": number(getattr(player, "minutes_played", 0)),
                },
            )
        for action, value in zip(actions.to_dict("records"), values.to_dict("records")):
            player_id = int(action["player_id"])
            if player_id not in stats:
                continue
            stats[player_id]["totalVaep"] += number(value["vaep_value"])
            stats[player_id]["offensiveVaep"] += number(value["offensive_value"])
            stats[player_id]["defensiveVaep"] += number(value["defensive_value"])
            stats[player_id]["totalActions"] += 1
    for player_stat in stats.values():
        if player_stat["totalActions"]:
            player_stat["vaepPerAction"] = player_stat["totalVaep"] / player_stat["totalActions"]

    output = {
        "matches": matches,
        "players": list(players.values()),
        "actions": action_rows,
        "playerStats": list(stats.values()),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"Wrote {len(matches)} matches and {len(action_rows)} actions to {args.output}")


if __name__ == "__main__":
    main()
