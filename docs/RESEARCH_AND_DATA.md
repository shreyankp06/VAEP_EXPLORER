# Research data, model and validation

Last reviewed: October 10, 2026.

## Dataset in the current 64-match build

- **Source:** StatsBomb Open Data, FIFA World Cup 2022 (competition ID 43, season ID 106).
- **Coverage:** all 64 tournament matches included in this project build.
- **Stored records:** 64 matches, 680 players, 138,946 actions, and 680 player-stat rows.
- **Standard-play actions:** 138,905.
- **Penalty shootout actions:** 41 across the matches. They remain visible in replay with a `_shootout` action type and zero VAEP components. They are excluded from fitting, validation, and player VAEP aggregates.
- **Goal facts:** regular-play scored shots and own goals are identified from StatsBomb event outcomes and joined to SPADL actions by source event ID. Goals include the credited team and score immediately after the goal; each action includes its source possession ID. The 64 match files contain 169 scored shots plus 3 own goals, reconciling to the 172 goals in the final match scores. Shootout goals are excluded.
- **Output:** `data/seed_data_64.json`; metadata and CatBoost model files are beside the seed. The goal-story enrichment produces `data/seed_data_64_goals.json` from that existing seed and the corresponding raw events. The legacy 12-match `data/seed_data.json` remains a separate file.
- **Persistence:** the 64-match seed, then the enriched goal-story seed, were imported into the configured Supabase PostgreSQL project. Rebuilding or enriching a local seed does not itself write to Supabase; the seed importer does.

StatsBomb Open Data is free to access subject to its license, user agreement, and attribution terms. See [`pipeline/README.md`](../pipeline/README.md) for reproduction commands and expected local raw-data layout.

## VAEP pipeline and model

The offline pipeline converts StatsBomb events into SPADL actions using `socceraction`, creates VAEP state features from the previous three actions, and fits two CatBoost classifiers. Goal and possession metadata is joined separately from event facts and does not affect model fitting or VAEP values:

1. the probability that the acting team scores within the VAEP label horizon;
2. the probability that the acting team concedes within that horizon.

The models use 100 iterations, depth 5, learning rate 0.05, and Logloss. Categorical predictors are passed as categories. The final display models are fitted on all standard-play actions in the 64 selected matches after the separate validation experiment. Shootout actions are preserved for replay but do not enter model fitting or VAEP player totals.

For a standard action, total VAEP is offensive VAEP plus defensive VAEP. In the UI, VAEP is described as an estimated change in the team's scoring/conceding outlook—not a goal, percentage-point probability, causal attribution, or complete player rating. The current API stores VAEP components, not the model probabilities before and after each action; the action inspector therefore does not display reconstructed probabilities.

## Offline match-grouped validation

`pipeline/validate_vaep.py` evaluated fresh CatBoost and XGBoost fits using the same five repeated whole-match holdouts: 48 training matches and 16 test matches per split, with seeds 42–46 and 25% test size. Each action from a match remains in one partition. Results are mean ± sample standard deviation across splits; the splits overlap, so this variability is descriptive and is not a confidence interval.

The fixed classification threshold is 0.50. Because scoring and conceding are rare, accuracy can be misleading. The table reports accuracy / balanced accuracy / precision / recall / F1 / ROC AUC / PR AUC / Brier / log loss:

| Target and model | Accuracy | Balanced accuracy | Precision | Recall | F1 | ROC AUC | PR AUC | Brier | Log loss |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Scores — XGBoost | .9905 ± .0011 | .5544 ± .0035 | 1.0000 ± .0000 | .1089 ± .0070 | .1963 ± .0113 | .7352 ± .0149 | .1706 ± .0074 | .0094 ± .0010 | .0510 ± .0048 |
| Scores — CatBoost | .9906 ± .0010 | .5590 ± .0013 | 1.0000 ± .0000 | .1180 ± .0025 | .2110 ± .0040 | .7249 ± .0171 | .1662 ± .0061 | .0093 ± .0010 | .0512 ± .0045 |
| Concedes — XGBoost | .9980 ± .0004 | .5000 ± .0000 | .0000 ± .0000 | .0000 ± .0000 | .0000 ± .0000 | .7307 ± .0307 | .0169 ± .0038 | .0020 ± .0004 | .0136 ± .0024 |
| Concedes — CatBoost | .9980 ± .0004 | .5000 ± .0000 | .0000 ± .0000 | .0000 ± .0000 | .0000 ± .0000 | .7561 ± .0257 | .0227 ± .0062 | .0020 ± .0004 | .0134 ± .0025 |

The training-prevalence baseline scores .9893 ± .0011 accuracy for scoring and .9980 ± .0004 for conceding, while predicting no positive cases at the selected threshold (zero recall and F1). Its ROC AUC is .50. The very high accuracy is largely a consequence of class imbalance. In particular, conceding recall and F1 are zero at threshold .50 for both fitted models; do not claim that they reliably detect conceding events from accuracy alone.

The XGBoost/CatBoost comparison is between the reported fixed configurations, not a hyperparameter-tuned competition. XGBoost uses numeric categorical codes while CatBoost uses categorical values. The report does not establish generalization to another tournament, season, or competition.

Detailed per-split metrics and counts are in [`data/validation_report.txt`](../data/validation_report.txt); manuscript-ready draft language is in [`data/paper_validation_addendum.txt`](../data/paper_validation_addendum.txt). Published-paper values in the addendum are contextual only and are not directly comparable across datasets and protocols.

## Stored-seed integrity verification

The independent seed audit checked all 138,946 stored action rows. It found 41 shootout rows with nonzero VAEP or missing shootout labels, zero; rows where total VAEP did not equal offensive plus defensive VAEP, zero; and player-stat aggregation mismatches, zero. The database goal audit found 172 regular-play goals, zero shootout goals, and zero differences between credited goal totals and final match scores. Result: **PASS** for these internal integrity checks.

This is an internal integrity check, not an independent reconstruction of every feature, outcome label, model probability, or tactical interpretation. It verifies consistency of stored values and aggregates, not that every value is substantively correct.

## What remains to strengthen the research

- Use a predeclared, non-overlapping match-level test set or tournament-level external validation when new open data is available.
- Select operating thresholds on training/validation data and report precision-recall trade-offs, especially for rare conceding outcomes.
- Assess calibration and compare against more informative baselines before making claims about probability quality.
- Keep model-performance claims separate from the arithmetic integrity audit and from the frontend presentation.
- Cite and comply with the StatsBomb Open Data terms and the VAEP/socceraction methods used.
