"""Download a reproducible subset of StatsBomb Open Data for the VAEP demo."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen


BASE_URL = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, default=Path("data/statsbomb"))
    parser.add_argument("--competition-id", type=int, default=43)
    parser.add_argument("--season-id", type=int, default=106)
    parser.add_argument("--max-matches", type=int, default=12)
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def fetch(relative_path: str) -> bytes:
    request = Request(
        f"{BASE_URL}/{relative_path}",
        headers={"User-Agent": "VAEP-Explorer-data-pipeline"},
    )
    with urlopen(request, timeout=60) as response:
        return response.read()


def write_download(root: Path, relative_path: str, overwrite: bool) -> bytes:
    destination = root / relative_path
    if destination.exists() and not overwrite:
        return destination.read_bytes()
    payload = fetch(relative_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)
    return payload


def main() -> None:
    args = parse_args()
    if args.max_matches < 1:
        raise ValueError("--max-matches must be at least 1")

    write_download(args.data_root, "competitions.json", args.overwrite)
    matches_path = f"matches/{args.competition_id}/{args.season_id}.json"
    matches_payload = write_download(args.data_root, matches_path, args.overwrite)
    matches = json.loads(matches_payload)
    selected = matches[: args.max_matches]
    if not selected:
        raise ValueError("No matches found for the supplied competition and season")

    for index, match in enumerate(selected, start=1):
        match_id = int(match["match_id"])
        write_download(args.data_root, f"events/{match_id}.json", args.overwrite)
        write_download(args.data_root, f"lineups/{match_id}.json", args.overwrite)
        print(f"[{index}/{len(selected)}] Downloaded match {match_id}")

    print(
        f"StatsBomb subset ready: competition {args.competition_id}, "
        f"season {args.season_id}, {len(selected)} matches in {args.data_root}"
    )


if __name__ == "__main__":
    main()
