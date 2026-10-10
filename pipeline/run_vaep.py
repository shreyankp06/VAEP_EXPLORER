"""Build seed_data.json from StatsBomb event data with socceraction VAEP."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import catboost
import numpy as np
import pandas as pd
from catboost import CatBoostClassifier
from xgboost import XGBClassifier

from socceraction.data.statsbomb import StatsBombLoader
import socceraction.spadl as spadl
from socceraction.spadl import statsbomb as spadl_statsbomb
from socceraction.spadl import play_left_to_right
from socceraction.vaep import features as vaep_features
from socceraction.vaep import formula as vaep_formula
from socceraction.vaep import labels as vaep_labels

from goal_story import build_action_annotations

SHOOTOUT_PERIOD_ID = 5
VAEP_COLUMNS = ("vaep_value", "offensive_value", "defensive_value")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/seed_data.json"))
    parser.add_argument("--competition-id", type=int, required=True)
    parser.add_argument("--season-id", type=int, required=True)
    parser.add_argument(
        "--max-matches",
        type=int,
        help="Process only the first N matches (useful for a reproducible demo subset)",
    )
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


def standard_play_mask(actions: pd.DataFrame) -> pd.Series:
    """Select actions outside the penalty shootout period."""
    return actions["period_id"] != SHOOTOUT_PERIOD_ID


def prepare_features(features: pd.DataFrame) -> pd.DataFrame:
    """Convert socceraction feature frames into stable numeric model input."""
    prepared = features.copy()
    for column in prepared.columns:
        if isinstance(prepared[column].dtype, pd.CategoricalDtype):
            prepared[column] = prepared[column].cat.codes.replace(-1, pd.NA)
    return (
        prepared.apply(pd.to_numeric, errors="coerce")
        .replace([float("inf"), float("-inf")], pd.NA)
        .fillna(0)
        .astype(float)
    )


def prepare_catboost_features(features: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Keep categorical predictors categorical for CatBoost."""
    prepared = features.copy()
    categorical_columns = [
        column
        for column in prepared.columns
        if isinstance(prepared[column].dtype, pd.CategoricalDtype)
    ]
    for column in categorical_columns:
        prepared[column] = (
            prepared[column].astype("string").fillna("__MISSING__").astype(str)
        )
    numeric_columns = [
        column for column in prepared.columns if column not in categorical_columns
    ]
    prepared[numeric_columns] = prepared[numeric_columns].apply(
        pd.to_numeric,
        errors="coerce",
    )
    prepared = (
        prepared.replace([float("inf"), float("-inf")], pd.NA)
        .fillna(0)
    )
    return prepared, categorical_columns


def create_model(random_state: int) -> XGBClassifier:
    return XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=random_state,
    )


def create_catboost_model(random_state: int) -> CatBoostClassifier:
    return CatBoostClassifier(
        iterations=100,
        depth=5,
        learning_rate=0.05,
        loss_function="Logloss",
        eval_metric="Logloss",
        random_seed=random_state,
        verbose=False,
        allow_writing_files=False,
    )


def train_models(
    features: pd.DataFrame,
    labels: pd.DataFrame,
    random_state: int,
) -> dict[str, CatBoostClassifier]:
    x_values, categorical_columns = prepare_catboost_features(features)
    y_values = labels.loc[x_values.index]
    if len(x_values) < 2:
        raise ValueError("At least two usable actions are required to train VAEP models")

    models: dict[str, CatBoostClassifier] = {}
    for target in ("scores", "concedes"):
        if y_values[target].nunique() < 2:
            raise ValueError(f"The full dataset must contain both classes for '{target}'")
        model = create_catboost_model(random_state)
        model.fit(
            x_values,
            y_values[target],
            cat_features=categorical_columns,
        )
        models[target] = model
    return models


def value_actions(
    actions: pd.DataFrame,
    features: pd.DataFrame,
    models: dict[str, CatBoostClassifier],
) -> pd.DataFrame:
    valid_features, _ = prepare_catboost_features(features)
    probabilities = {
        target: pd.Series(
            model.predict_proba(valid_features)[:, 1],
            index=actions.index,
            name=target,
        )
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
                "actionType": (
                    f"{action['type_name']}_shootout"
                    if int(action["period_id"]) == SHOOTOUT_PERIOD_ID
                    else str(action["type_name"])
                ),
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
    if args.max_matches is not None:
        if args.max_matches < 1:
            raise ValueError("--max-matches must be at least 1")
        games = games.head(args.max_matches)
    if games.empty:
        raise ValueError("No matches found for the supplied competition and season")

    prepared: list[dict[str, Any]] = []
    all_features: list[pd.DataFrame] = []
    all_labels: list[pd.DataFrame] = []

    for game in games.itertuples(index=False):
        events = loader.events(game.game_id)
        actions = spadl_statsbomb.convert_to_actions(events, game.home_team_id)
        actions = spadl.add_names(actions)
        actions = play_left_to_right(actions, game.home_team_id)
        standard_actions = actions.loc[standard_play_mask(actions)]
        features = build_features(standard_actions, game.home_team_id)
        labels = pd.concat(
            [
                vaep_labels.scores(standard_actions),
                vaep_labels.concedes(standard_actions),
            ],
            axis=1,
        )
        all_features.append(features)
        all_labels.append(labels)
        prepared.append(
            {
                "game": game,
                "actions": actions,
                "events": events,
                "standard_actions": standard_actions,
                "features": features,
            }
        )

    features = pd.concat(all_features, ignore_index=True)
    labels = pd.concat(all_labels, ignore_index=True)
    models = train_models(features, labels, args.random_state)

    matches: list[dict[str, Any]] = []
    players: dict[int, dict[str, Any]] = {}
    action_rows: list[dict[str, Any]] = []
    stats: dict[int, dict[str, Any]] = {}
    for item in prepared:
        game = item["game"]
        actions = item["actions"]
        standard_actions = item["standard_actions"]
        features = item["features"]
        standard_values = value_actions(standard_actions, features, models)
        values = pd.DataFrame(0.0, index=actions.index, columns=VAEP_COLUMNS)
        values.loc[standard_values.index, list(VAEP_COLUMNS)] = standard_values.loc[
            :, list(VAEP_COLUMNS)
        ]
        match_id = int(game.game_id)
        match_row = games.loc[games["game_id"] == match_id].iloc[0]
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
        annotations = build_action_annotations(
            actions,
            item["events"],
            int(game.home_team_id),
            int(game.away_team_id),
            int(match_row["home_score"]),
            int(match_row["away_score"]),
        )
        records = action_records(actions, values, match_id)
        for record in records:
            record.update(annotations[record["actionId"]])
        action_rows.extend(records)

        lineup = loader.players(match_id)
        for player in lineup.itertuples(index=False):
            player_id = int(player.player_id)
            team_name = str(teams.get(player.team_id, "Unknown"))
            players[player_id] = {
                "playerId": player_id,
                "name": str(player.player_name),
                "team": team_name,
                "position": str(getattr(player, "starting_position_name", "Unknown") or "Unknown"),
            }
            if player_id not in stats:
                stats[player_id] = {
                    "playerId": player_id,
                    "team": team_name,
                    "totalVaep": 0.0,
                    "offensiveVaep": 0.0,
                    "defensiveVaep": 0.0,
                    "totalActions": 0,
                    "vaepPerAction": 0.0,
                    "minutesPlayed": 0.0,
                }
            stats[player_id]["minutesPlayed"] += number(
                getattr(player, "minutes_played", 0)
            )
        for action, value in zip(actions.to_dict("records"), values.to_dict("records")):
            player_id = int(action["player_id"])
            if player_id not in stats:
                continue
            if int(action["period_id"]) == SHOOTOUT_PERIOD_ID:
                continue
            stats[player_id]["totalVaep"] += number(value["vaep_value"])
            stats[player_id]["offensiveVaep"] += number(value["offensive_value"])
            stats[player_id]["defensiveVaep"] += number(value["defensive_value"])
            stats[player_id]["totalActions"] += 1
    for player_stat in stats.values():
        if player_stat["totalActions"]:
            player_stat["vaepPerAction"] = player_stat["totalVaep"] / player_stat["totalActions"]

    model_dir = args.output.parent / f"{args.output.stem}_models"
    model_dir.mkdir(parents=True, exist_ok=True)
    model_files: dict[str, str] = {}
    for target, model in models.items():
        model_path = model_dir / f"{target}.cbm"
        model.save_model(str(model_path))
        model_files[target] = str(model_path)

    output = {
        "matches": matches,
        "players": list(players.values()),
        "actions": action_rows,
        "playerStats": list(stats.values()),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2), encoding="utf-8")
    metadata = {
        "model": "CatBoostClassifier",
        "modelParameters": {
            "iterations": 100,
            "depth": 5,
            "learningRate": 0.05,
            "lossFunction": "Logloss",
            "randomState": args.random_state,
        },
        "training": "fit on all selected matches after independent match-level validation",
        "competitionId": args.competition_id,
        "seasonId": args.season_id,
        "matchIds": [int(item["game"].game_id) for item in prepared],
        "matchCount": len(matches),
        "playerCount": len(players),
        "actionCount": len(action_rows),
        "standardPlayActionCount": sum(
            len(item["standard_actions"]) for item in prepared
        ),
        "shootoutActionCount": sum(
            len(item["actions"]) - len(item["standard_actions"])
            for item in prepared
        ),
        "shootoutTreatment": (
            "retained in replay as *_shootout action types with zero VAEP; "
            "excluded from model training, validation, and player VAEP aggregates"
        ),
        "featureHistoryActions": 3,
        "labelHorizonActions": 10,
        "catboostVersion": catboost.__version__,
        "pandasVersion": pd.__version__,
        "numpyVersion": np.__version__,
        "modelFiles": model_files,
    }
    metadata_path = args.output.with_suffix(".metadata.json")
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(
        f"Wrote {len(matches)} matches and {len(action_rows)} actions to {args.output} "
        f"using CatBoost fit on all selected matches; metadata saved to {metadata_path}"
    )


if __name__ == "__main__":
    main()
