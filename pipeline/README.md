# VAEP data pipeline

`run_vaep.py` loads local StatsBomb Open Data, converts events to named SPADL actions, trains scoring and conceding CatBoost models, computes VAEP values, aggregates player statistics, and writes the JSON consumed by `pnpm --filter @workspace/scripts seed`.

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r pipeline\requirements.txt
```

StatsBomb Open Data must have this layout:

```text
statsbomb/
  competitions.json
  matches/<competition_id>/<season_id>.json
  events/<match_id>.json
  lineups/<match_id>.json
```

## Build the 64-match application dataset

```powershell
python pipeline\download_statsbomb.py `
  --data-root data\statsbomb `
  --competition-id 43 `
  --season-id 106 `
  --max-matches 64

python pipeline\run_vaep.py `
  --data-root data\statsbomb `
  --competition-id 43 `
  --season-id 106 `
  --max-matches 64 `
  --output data\seed_data_64.json
```

The 64 World Cup 2022 match records are downloaded from the free StatsBomb
Open Data repository. The new application seed uses CatBoost for both the
scoring and conceding classifiers, with categorical features preserved as
categories, and trains the final display models on all selected matches after
the separate match-level validation experiment. The generated JSON contains
`matches`, `players`, `actions`, and `playerStats` using external StatsBomb
IDs; the importer resolves those IDs to database keys. It also writes a local
metadata file and scoring/conceding CatBoost model artifacts beside the seed.
Penalty shootout actions (StatsBomb period 5) remain in replay with
`_shootout` appended to the action type, but have zero VAEP components and are
excluded from model training and player VAEP aggregates. Player-stat
`totalActions` counts standard-play actions only. The previous 12-match
`data/seed_data.json` is not overwritten.

StatsBomb Open Data is subject to its user agreement and attribution requirements.

## Validate the model and stored values

Generate an offline report without writing to Supabase or changing `seed_data.json`:

```powershell
python pipeline\validate_vaep.py `
  --data-root data\statsbomb `
  --seed-data data\seed_data_64.json `
  --output data\validation_report.txt `
  --paper-summary-output data\paper_validation_addendum.txt `
  --competition-id 43 `
  --season-id 106 `
  --max-matches 64 `
  --repeats 5 `
  --test-size 0.25 `
  --random-state 42
```

The script trains fresh scoring and conceding classifiers using the pipeline's
existing XGBoost settings and a CatBoost model over five repeated, seeded,
whole-match holdouts. Both models use the same matches in each split.
XGBoost uses the pipeline's numeric categorical encoding; CatBoost receives
the categorical feature columns as categorical data. This compares the current
configurations, not hyperparameter-tuned versions. Each model is compared
against a constant-probability baseline using the training label prevalence.
The report includes mean and standard deviation for accuracy, balanced
accuracy, precision, recall, F1, ROC AUC, PR AUC, Brier score, and log loss.
Period-5 penalty shootout actions are excluded from training and evaluation.
The supplied seed file is read only and audited; it is not regenerated or
written to Supabase. The audit checks that retained shootout actions are
labeled, have zero VAEP, and are omitted from player VAEP aggregates.
`validation_report.txt` contains detailed split metrics;
`paper_validation_addendum.txt` contains draft methods/results/limitations
text for review and adaptation into the paper, including reference values from
Decroos et al. (2019). The published values are context only because their data
and evaluation protocol differ from this project.

## Initialize the new Supabase project and import the 64-match seed

Set `DATABASE_URL` in the repository-root `.env` to the new project's PostgreSQL
session-pooler connection string. Never put the Supabase HTTPS project URL or a
browser/anon key in `DATABASE_URL`. Then initialize and check the empty project:

```powershell
pnpm db:setup
pnpm db:check
```

Import the new seed explicitly (this does not use or overwrite the old
12-match seed file):

```powershell
$env:SEED_FILE = "data/seed_data_64.json"
pnpm --filter @workspace/scripts seed
Remove-Item Env:SEED_FILE
pnpm db:check
```

The seeder uses transactional upserts, so rerunning this import updates the
existing records with corrected VAEP values while keeping the shootout events
available in replay. The API and frontend read the active
database configured by `DATABASE_URL`; no frontend data-source change is
needed when the new Supabase project has the same schema. Keep the old
connection string backed up securely if the old project must remain available.

Repeated random holdouts can overlap and are not independent trials: report
their variability descriptively, not as a confidence interval. A separate
fixed-threshold test report does not replace model calibration, feature
baselines, or external-season evaluation.

## Add goal stories without rerunning VAEP

Existing seeds can be enriched from their corresponding StatsBomb events
without fitting models or changing any VAEP fields:

```powershell
python pipeline\enrich_goal_stories.py `
  --data-root data\statsbomb `
  --input data\seed_data_64.json `
  --output data\seed_data_64_goals.json `
  --competition-id 43 `
  --season-id 106
```

The enrichment maps source event IDs to the existing SPADL action IDs, stores
possession IDs, identifies scored shots and own goals, and adds the score after
each goal. It checks that goal events reconcile with every match's final score.
VAEP values and player aggregates are copied unchanged. Apply
`supabase/migrations/20261010_goal_story.sql` to an existing database before
importing the enriched seed; for a new database, `supabase/schema.sql` already
includes the new columns. Set `SEED_FILE` to the enriched output when running
the normal seed importer. For example, after running the enrichment command
above and applying the migration in Supabase SQL Editor:

```powershell
$env:SEED_FILE = "data/seed_data_64_goals.json"
pnpm --filter @workspace/scripts seed
Remove-Item Env:SEED_FILE
pnpm db:check
```

The importer transactionally upserts the existing dataset. The database check
also verifies 172 regular-play goal annotations, no shootout goals, and that
credited goal totals reconcile with all 64 final scores. It does not refit
models or recompute VAEP.

These classification metrics describe a fresh held-out validation fit, not the
historical model instance: the generated seed data does not include that model
or its probability predictions. The audit checks stored values without recalculating VAEP or contacting the
database.

For the current 64-match dataset counts, metric summary, stored-value audit
results, and interpretation limits, see
[`docs/RESEARCH_AND_DATA.md`](../docs/RESEARCH_AND_DATA.md).
