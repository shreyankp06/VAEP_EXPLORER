"""Write an offline model-validation and stored-VAEP consistency report."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import catboost
from catboost import CatBoostClassifier
import sklearn
import xgboost
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from xgboost import XGBClassifier

from socceraction.data.statsbomb import StatsBombLoader
import socceraction.spadl as spadl
from socceraction.spadl import statsbomb as spadl_statsbomb
from socceraction.spadl import play_left_to_right
from socceraction.vaep import labels as vaep_labels

from run_vaep import (
    SHOOTOUT_PERIOD_ID,
    build_features,
    create_model,
    prepare_features,
    standard_play_mask,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, default=Path("data/statsbomb"))
    parser.add_argument("--seed-data", type=Path, default=Path("data/seed_data.json"))
    parser.add_argument("--output", type=Path, default=Path("data/validation_report.txt"))
    parser.add_argument(
        "--paper-summary-output",
        type=Path,
        default=Path("data/paper_validation_addendum.txt"),
    )
    parser.add_argument("--competition-id", type=int, default=43)
    parser.add_argument("--season-id", type=int, default=106)
    parser.add_argument("--max-matches", type=int, default=64)
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument("--test-size", type=float, default=0.25)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument("--threshold", type=float, default=0.5)
    return parser.parse_args()


def load_validation_data(
    data_root: Path,
    competition_id: int,
    season_id: int,
    max_matches: int,
) -> tuple[pd.DataFrame, pd.DataFrame, list[int], int]:
    loader = StatsBombLoader(getter="local", root=str(data_root))
    games = loader.games(competition_id=competition_id, season_id=season_id)
    if max_matches < 2:
        raise ValueError("--max-matches must be at least 2 for held-out-match validation")
    games = games.head(max_matches)
    if len(games) < 2:
        raise ValueError("At least two matching StatsBomb games are required for validation")

    feature_frames: list[pd.DataFrame] = []
    label_frames: list[pd.DataFrame] = []
    game_ids: list[int] = []
    shootout_action_count = 0
    for game in games.itertuples(index=False):
        actions = spadl_statsbomb.convert_to_actions(loader.events(game.game_id), game.home_team_id)
        actions = spadl.add_names(actions)
        actions = play_left_to_right(actions, game.home_team_id)
        shootout_action_count += int((~standard_play_mask(actions)).sum())
        actions = actions.loc[standard_play_mask(actions)]
        features = build_features(actions, game.home_team_id)
        labels = pd.concat(
            [vaep_labels.scores(actions), vaep_labels.concedes(actions)],
            axis=1,
        )
        feature_frames.append(features.reset_index(drop=True))
        label_frames.append(labels.reset_index(drop=True))
        game_ids.extend([int(game.game_id)] * len(actions))

    return (
        pd.concat(feature_frames, ignore_index=True),
        pd.concat(label_frames, ignore_index=True),
        game_ids,
        shootout_action_count,
    )


def validation_split(
    features: pd.DataFrame,
    labels: pd.DataFrame,
    game_ids: list[int],
    test_size: float,
    random_state: int,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, list[int], list[int]]:
    x_values = prepare_features(features)
    y_values = labels.loc[x_values.index]
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
    try:
        train_indices, test_indices = next(
            splitter.split(x_values, y_values, groups=game_ids)
        )
    except ValueError as error:
        raise ValueError(
            "Could not split matches for validation; check --test-size and available games"
        ) from error

    train_labels = y_values.iloc[train_indices]
    for target in ("scores", "concedes"):
        if train_labels[target].nunique() < 2:
            raise ValueError(
                f"The training matches contain only one class for '{target}'. "
                "Use a different --random-state or include more matches."
            )

    return (
        x_values.iloc[train_indices],
        x_values.iloc[test_indices],
        train_labels,
        y_values.iloc[test_indices],
        sorted({game_ids[index] for index in train_indices}),
        sorted({game_ids[index] for index in test_indices}),
    )


def format_metric(value: float | None) -> str:
    return "N/A (test set has one class)" if value is None else f"{value:.4f}"


METRIC_NAMES = (
    "accuracy",
    "balanced_accuracy",
    "precision",
    "recall",
    "f1",
    "roc_auc",
    "pr_auc",
    "brier",
    "log_loss",
)


def calculate_metrics(
    y_test: pd.Series,
    probabilities: Any,
    threshold: float,
) -> dict[str, float | None]:
    predictions = (probabilities >= threshold).astype(int)
    auc = roc_auc_score(y_test, probabilities) if y_test.nunique() == 2 else None
    pr_auc = average_precision_score(y_test, probabilities) if y_test.nunique() == 2 else None
    return {
        "accuracy": accuracy_score(y_test, predictions),
        "balanced_accuracy": balanced_accuracy_score(y_test, predictions),
        "precision": precision_score(y_test, predictions, zero_division=0),
        "recall": recall_score(y_test, predictions, zero_division=0),
        "f1": f1_score(y_test, predictions, zero_division=0),
        "roc_auc": auc,
        "pr_auc": pr_auc,
        "brier": brier_score_loss(y_test, probabilities),
        "log_loss": log_loss(y_test, probabilities, labels=[0, 1]),
    }


def format_mean_sd(values: list[float | None]) -> str:
    usable = [value for value in values if value is not None]
    if not usable:
        return "N/A"
    mean = sum(usable) / len(usable)
    if len(usable) == 1:
        return f"{mean:.4f}"
    variance = sum((value - mean) ** 2 for value in usable) / (len(usable) - 1)
    return f"{mean:.4f} +/- {math.sqrt(variance):.4f}"


def format_metric_block(
    target: str,
    model_metrics: dict[str, list[dict[str, float | None]]],
    baseline_metrics: list[dict[str, float | None]],
    fold_summaries: list[dict[str, Any]],
) -> list[str]:
    lines = [f"{target.title()} outcome model (mean +/- SD across random splits)"]
    for label in ("XGBoost", "CatBoost"):
        collection = model_metrics[label]
        lines.append(f"  {label}:")
        for metric in METRIC_NAMES:
            lines.append(
                f"    {metric.replace('_', ' ').title()}: "
                f"{format_mean_sd([result[metric] for result in collection])}"
            )
    lines.append("  Training-prevalence baseline:")
    for metric in METRIC_NAMES:
        lines.append(
            f"    {metric.replace('_', ' ').title()}: "
            f"{format_mean_sd([result[metric] for result in baseline_metrics])}"
        )
    lines.append("  Per-split held-out matches and positive counts:")
    for fold in fold_summaries:
        lines.append(
            f"    Split {fold['split']}: {len(fold['test_matches'])} matches "
            f"({', '.join(map(str, fold['test_matches']))}); "
            f"{fold['positives']} positive / {fold['test_actions']} actions"
        )
    return lines


def paper_summary(
    target_metrics: dict[str, dict[str, list[dict[str, float | None]]]],
    baseline_metrics: dict[str, list[dict[str, float | None]]],
    repeats: int,
    test_size: float,
    threshold: float,
    matches: int,
    shootout_actions: int,
    audit_lines: list[str],
) -> str:
    lines = [
        "PAPER-READY VALIDATION ADDENDUM (edit into manuscript after review)",
        "",
        "Methods. We evaluated the scoring and conceding classifiers using "
        f"{repeats} repeated random group holdouts at the match level. In each "
        f"split, {test_size:.0%} of matches were held out, and all actions from "
        "a match remained in the same partition. Period-5 penalty shootout "
        f"actions ({shootout_actions} in the source matches) were excluded. "
        "XGBoost and CatBoost were fit "
        "with fixed settings and random seeds recorded in the accompanying "
        "validation report, and both used the same match partitions. CatBoost "
        "received categorical features as categorical values; XGBoost used the "
        "pipeline's numeric encoding. A constant training-prevalence "
        "probability predictor was used as a baseline. Classification metrics "
        f"use a fixed probability threshold of {threshold:.2f}. Values below "
        "are means and sample standard deviations across splits; repeated "
        "holdouts overlap and these standard deviations are descriptive, not "
        "confidence intervals.",
        "",
        f"Results. The evaluation used {matches} FIFA World Cup 2022 matches. "
        "Metrics are reported as XGBoost / CatBoost / prevalence baseline:",
    ]
    for target in ("scores", "concedes"):
        lines.append(f"{target.title()} model:")
        for metric in ("brier", "log_loss", "roc_auc", "pr_auc", "recall", "f1"):
            xgb_value = format_mean_sd(
                [result[metric] for result in target_metrics["XGBoost"][target]]
            )
            catboost_value = format_mean_sd(
                [result[metric] for result in target_metrics["CatBoost"][target]]
            )
            baseline_value = format_mean_sd(
                [result[metric] for result in baseline_metrics[target]]
            )
            lines.append(
                f"  {metric.replace('_', ' ').title()}: "
                f"{xgb_value} / {catboost_value} / {baseline_value}"
            )
    lines.extend(
        [
            "",
            "Published-paper reference (Decroos et al., 2019, Table 3). The "
            "original paper reported CatBoost Brier/AUC of 0.01376/0.7693 for "
            "scoring and 0.00547/0.7313 for conceding; its XGBoost Brier/AUC "
            "were 0.01390/0.7556 and 0.00550/0.7255, respectively. These "
            "published results are contextual only and are not directly "
            "comparable because the data, feature processing, and evaluation "
            "protocol differ.",
        ]
    )
    audit_result = next(
        (line.strip() for line in audit_lines if "Result:" in line),
        "Result: not reported",
    )
    lines.extend(
        [
            "",
            "Stored-value verification. The separate audit of the supplied seed "
            "checks that each stored VAEP value equals its offensive plus "
            "defensive components and that stored player aggregates agree with "
            f"their action rows. {audit_result}",
            "",
            "Limitations. This is an exploratory within-competition evaluation "
            "on a single tournament, not evidence of cross-season or "
            "cross-competition generalization. The repeated random holdouts "
            "share matches and are not independent replications. The metrics "
            "evaluate fresh fits, not the full-data model used to produce the "
            "seed values. The arithmetic audit verifies internal "
            "consistency, not whether the underlying action valuations are "
            "causally or tactically correct. Threshold-dependent metrics "
            "should be interpreted alongside ranking and probability-quality "
            "metrics, particularly because positive outcomes are rare.",
            "",
            "Do not submit this addendum without checking the values against "
            "the report and reconciling the manuscript's claims and references.",
        ]
    )
    return "\n".join(lines) + "\n"


def evaluate_repeated_holdouts(
    features: pd.DataFrame,
    labels: pd.DataFrame,
    game_ids: list[int],
    repeats: int,
    test_size: float,
    random_state: int,
    threshold: float,
) -> tuple[
    dict[str, dict[str, list[dict[str, float | None]]]],
    dict[str, list[dict[str, float | None]]],
    dict[str, list[dict[str, Any]]],
    list[dict[str, Any]],
]:
    if repeats < 2:
        raise ValueError("--repeats must be at least 2")
    x_catboost = features.copy()
    categorical_columns = [
        column
        for column in x_catboost.columns
        if isinstance(x_catboost[column].dtype, pd.CategoricalDtype)
    ]
    for column in categorical_columns:
        x_catboost[column] = (
            x_catboost[column].astype("string").fillna("__MISSING__").astype(str)
        )
    numeric_columns = [column for column in x_catboost.columns if column not in categorical_columns]
    x_catboost[numeric_columns] = x_catboost[numeric_columns].apply(
        pd.to_numeric,
        errors="coerce",
    )
    x_catboost = x_catboost.replace([float("inf"), float("-inf")], pd.NA).fillna(0)
    x_values = prepare_features(features)
    y_values = labels.loc[x_values.index]
    model_metrics: dict[str, dict[str, list[dict[str, float | None]]]] = {
        "XGBoost": {"scores": [], "concedes": []},
        "CatBoost": {"scores": [], "concedes": []},
    }
    baseline_metrics: dict[str, list[dict[str, float | None]]] = {
        "scores": [],
        "concedes": [],
    }
    fold_summaries: dict[str, list[dict[str, Any]]] = {
        "scores": [],
        "concedes": [],
    }
    all_split_summaries: list[dict[str, Any]] = []

    for split_index in range(repeats):
        split_seed = random_state + split_index
        train_x, test_x, train_y, test_y, train_games, test_games = validation_split(
            x_values,
            y_values,
            game_ids,
            test_size,
            split_seed,
        )
        split_summary = {
            "split": split_index + 1,
            "seed": split_seed,
            "train_matches": train_games,
            "test_matches": test_games,
            "test_actions": len(test_y),
        }
        all_split_summaries.append(split_summary)
        train_mask = pd.Series(game_ids).isin(train_games).to_numpy()
        test_mask = pd.Series(game_ids).isin(test_games).to_numpy()
        cat_train_x = x_catboost.loc[train_mask]
        cat_test_x = x_catboost.loc[test_mask]
        cat_train_y = y_values.loc[train_mask]
        cat_test_y = y_values.loc[test_mask]
        for target in ("scores", "concedes"):
            xgb_model = create_model(split_seed)
            xgb_model.fit(train_x, train_y[target])
            xgb_probabilities = xgb_model.predict_proba(test_x)[:, 1]
            model_metrics["XGBoost"][target].append(
                calculate_metrics(test_y[target], xgb_probabilities, threshold)
            )

            catboost_model = CatBoostClassifier(
                iterations=100,
                depth=5,
                learning_rate=0.05,
                loss_function="Logloss",
                eval_metric="Logloss",
                random_seed=split_seed,
                verbose=False,
                thread_count=4,
                allow_writing_files=False,
            )
            catboost_model.fit(
                cat_train_x,
                cat_train_y[target],
                cat_features=categorical_columns,
            )
            catboost_probabilities = catboost_model.predict_proba(cat_test_x)[:, 1]
            model_metrics["CatBoost"][target].append(
                calculate_metrics(cat_test_y[target], catboost_probabilities, threshold)
            )
            training_prevalence = float(train_y[target].mean())
            baseline_probabilities = pd.Series(
                training_prevalence,
                index=test_y.index,
            )
            baseline_metrics[target].append(
                calculate_metrics(test_y[target], baseline_probabilities, threshold)
            )
            fold_summaries[target].append(
                {
                    **split_summary,
                    "positives": int(test_y[target].sum()),
                    "prevalence": training_prevalence,
                }
            )

    return model_metrics, baseline_metrics, fold_summaries, all_split_summaries


def report_split_details(splits: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    for split in splits:
        lines.append(
            f"  Split {split['split']} (seed {split['seed']}): "
            f"train matches={len(split['train_matches'])}, "
            f"test matches={len(split['test_matches'])}, "
            f"test actions={split['test_actions']}"
        )
    return lines


def render_audit_lines(audit_lines: list[str]) -> list[str]:
    return [line for line in audit_lines if line]


def audit_seed_data(seed_path: Path, tolerance: float = 1e-8) -> list[str]:
    payload = json.loads(seed_path.read_text(encoding="utf-8"))
    actions = payload.get("actions")
    player_stats = payload.get("playerStats")
    if not isinstance(actions, list) or not isinstance(player_stats, list):
        raise ValueError("Seed JSON must contain 'actions' and 'playerStats' arrays")
    if not actions:
        raise ValueError("Seed JSON contains no actions to audit")

    component_mismatches: list[int] = []
    shootout_value_mismatches: list[int] = []
    shootout_action_count = 0
    computed: dict[int, dict[str, float]] = {}
    for index, action in enumerate(actions):
        try:
            vaep_value = float(action["vaepValue"])
            offensive = float(action["offensiveValue"])
            defensive = float(action["defensiveValue"])
            player_id = int(action["playerId"])
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError(f"Invalid VAEP or player field in action row {index}") from error
        if not all(math.isfinite(value) for value in (vaep_value, offensive, defensive)):
            raise ValueError(f"Non-finite VAEP value in action row {index}")
        if not math.isclose(vaep_value, offensive + defensive, abs_tol=tolerance):
            component_mismatches.append(index)
        if int(action.get("periodId", 0)) == SHOOTOUT_PERIOD_ID:
            shootout_action_count += 1
            if (
                not all(
                    math.isclose(value, 0.0, abs_tol=tolerance)
                    for value in (vaep_value, offensive, defensive)
                )
                or not str(action.get("actionType", "")).endswith("_shootout")
            ):
                shootout_value_mismatches.append(index)
            continue

        totals = computed.setdefault(
            player_id,
            {"totalVaep": 0.0, "offensiveVaep": 0.0, "defensiveVaep": 0.0, "totalActions": 0.0},
        )
        totals["totalVaep"] += vaep_value
        totals["offensiveVaep"] += offensive
        totals["defensiveVaep"] += defensive
        totals["totalActions"] += 1

    stat_mismatches: list[str] = []
    audited_player_ids: set[int] = set()
    for stat in player_stats:
        player_id = int(stat["playerId"])
        audited_player_ids.add(player_id)
        actual = computed.get(
            player_id,
            {"totalVaep": 0.0, "offensiveVaep": 0.0, "defensiveVaep": 0.0, "totalActions": 0.0},
        )
        for field in ("totalVaep", "offensiveVaep", "defensiveVaep", "totalActions"):
            if not math.isclose(
                float(stat[field]),
                actual[field],
                rel_tol=tolerance,
                abs_tol=tolerance,
            ):
                stat_mismatches.append(f"player {player_id} {field}")
                break
    stat_mismatches.extend(
        f"player {player_id} missing from playerStats"
        for player_id in sorted(set(computed) - audited_player_ids)
    )

    return [
        "Stored VAEP consistency audit",
        f"  Stored actions checked: {len(actions)}",
        f"  Shootout actions excluded from VAEP: {shootout_action_count}",
        f"  Shootout rows with nonzero VAEP or missing label: {len(shootout_value_mismatches)}",
        f"  VAEP != offensive + defensive: {len(component_mismatches)}",
        f"  Player-stat aggregation mismatches: {len(stat_mismatches)}",
        (
            "  Result: PASS"
            if not component_mismatches
            and not stat_mismatches
            and not shootout_value_mismatches
            else "  Result: FAIL"
        ),
        (
            "  First component mismatches (action row indexes): "
            + ", ".join(map(str, component_mismatches[:10]))
            if component_mismatches
            else ""
        ),
        (
            "  First player-stat mismatches: " + ", ".join(stat_mismatches[:10])
            if stat_mismatches
            else ""
        ),
        (
            "  First shootout mismatches: "
            + ", ".join(map(str, shootout_value_mismatches[:10]))
            if shootout_value_mismatches
            else ""
        ),
    ]


def main() -> None:
    args = parse_args()
    if not 0 < args.test_size < 1:
        raise ValueError("--test-size must be between 0 and 1")
    if not 0 <= args.threshold <= 1:
        raise ValueError("--threshold must be between 0 and 1")
    if args.output.resolve() == args.seed_data.resolve():
        raise ValueError("--output must not point to the seed-data file")
    if args.paper_summary_output.resolve() in {
        args.seed_data.resolve(),
        args.output.resolve(),
    }:
        raise ValueError("--paper-summary-output must differ from seed and report paths")
    if not args.seed_data.is_file():
        raise FileNotFoundError(f"Seed data not found: {args.seed_data}")

    features, labels, game_ids, shootout_action_count = load_validation_data(
        args.data_root,
        args.competition_id,
        args.season_id,
        args.max_matches,
    )
    model_metrics, baseline_metrics, fold_summaries, splits = evaluate_repeated_holdouts(
        features,
        labels,
        game_ids,
        args.repeats,
        args.test_size,
        args.random_state,
        args.threshold,
    )
    audit_lines = audit_seed_data(args.seed_data)

    report = [
        "VAEP EXPLORER - OFFLINE VALIDATION REPORT",
        "=" * 46,
        "No database connection or Supabase writes were used.",
        "Supplied seed JSON was read only; it was not regenerated or modified.",
        "Metrics evaluate fresh XGBoost and CatBoost fits on repeated held-out match groups.",
        "These are not predictions from the full-data model used to generate the seed.",
        "The repeated random holdouts overlap; mean +/- SD is descriptive, not a CI.",
        "XGBoost uses numeric categorical codes; CatBoost receives categorical fields as categories.",
        "Model settings: XGBoost 100 estimators, depth 5, learning rate 0.05; "
        "CatBoost 100 iterations, depth 5, learning rate 0.05.",
        "Both use the split seed; results compare these configured implementations, "
        "not a hyperparameter-tuned leaderboard.",
        "Package versions: "
        f"XGBoost {xgboost.__version__}, CatBoost {catboost.__version__}, "
        f"scikit-learn {sklearn.__version__}, pandas {pd.__version__}, "
        f"NumPy {np.__version__}",
        "",
        f"Competition / season: {args.competition_id} / {args.season_id}",
        f"Matches used: {len(set(game_ids))}",
        f"Penalty shootout actions excluded: {shootout_action_count}",
        f"Repeated holdouts: {args.repeats}",
        f"Test fraction per split: {args.test_size:.2f}",
        "Split seeds: " + ", ".join(str(args.random_state + index) for index in range(args.repeats)),
        "Match partitions per split:",
        *report_split_details(splits),
        f"Decision threshold: {args.threshold:.2f}",
        "Baseline: constant probability equal to training-set outcome prevalence.",
        "",
    ]

    for target in ("scores", "concedes"):
        report.extend(
            format_metric_block(
                target,
                {name: values[target] for name, values in model_metrics.items()},
                baseline_metrics[target],
                fold_summaries[target],
            )
        )
        report.append("")

    report.extend(render_audit_lines(audit_lines))
    report_text = "\n".join(line for line in report if line is not None).rstrip() + "\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report_text, encoding="utf-8")
    summary_text = paper_summary(
        model_metrics,
        baseline_metrics,
        args.repeats,
        args.test_size,
        args.threshold,
        len(set(game_ids)),
        shootout_action_count,
        audit_lines,
    )
    args.paper_summary_output.parent.mkdir(parents=True, exist_ok=True)
    args.paper_summary_output.write_text(summary_text, encoding="utf-8")
    print(report_text)
    print(f"\nReport saved to {args.output}")
    print(f"Paper addendum saved to {args.paper_summary_output}")


if __name__ == "__main__":
    main()
