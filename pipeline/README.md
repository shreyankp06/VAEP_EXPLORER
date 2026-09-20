# VAEP data pipeline

`run_vaep.py` loads local StatsBomb Open Data, converts events to named SPADL actions, trains scoring and conceding XGBoost models, computes VAEP values, aggregates player statistics, and writes the JSON consumed by `pnpm --filter @workspace/scripts seed`.

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

## Generate seed data

```powershell
python pipeline\download_statsbomb.py `
  --data-root data\statsbomb `
  --competition-id 43 `
  --season-id 106 `
  --max-matches 12

python pipeline\run_vaep.py `
  --data-root data\statsbomb `
  --competition-id 43 `
  --season-id 106 `
  --max-matches 12 `
  --output data\seed_data.json
```

The downloader defaults to a 12-match FIFA World Cup 2022 subset so the demo is reproducible without cloning the entire StatsBomb repository. Use the same `--max-matches` value for downloading and processing. The model is trained from the selected subset; a single match is not a meaningful training set. The output contains `matches`, `players`, `actions`, and `playerStats` using external StatsBomb IDs. The Node importer resolves those IDs to internal PostgreSQL foreign keys.

StatsBomb Open Data is subject to its user agreement and attribution requirements.
