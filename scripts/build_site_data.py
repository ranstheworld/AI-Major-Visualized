#!/usr/bin/env python3
"""
build_site_data.py

The last step of the pipeline. Joins:
  data/majors.csv            — degree sizes and descriptive notes (NCES)
  data/exposure_scores.json  — output of build_exposure_scores.py
  data/momentum.json         — enrollment-momentum badges (NSC), a separately-sourced,
                                faster-moving signal that is layered on top, never blended in
into one file:
  site/data.json — the single thing the frontend fetches at runtime

Mirrors Karpathy's own build_site_data.py, which merges his CSV stats and AI-exposure
scores into site/data.json for the same reason: the site should never need to know how a
number was derived, only what the number is. Re-running the two build scripts and refreshing
this file is the entire "update the data" workflow — chart.js and index.html never change for
a data update, only for a presentation change.
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
SITE_DIR = ROOT / "site"


def main():
    scores = json.loads((DATA_DIR / "exposure_scores.json").read_text())
    momentum = json.loads((DATA_DIR / "momentum.json").read_text())

    majors = []
    with open(DATA_DIR / "majors.csv") as f:
        for row in csv.DictReader(f):
            mid = row["major_id"]
            s = scores.get(mid)
            if s is None:
                raise ValueError(f"No exposure score for major_id={mid!r} — "
                                  f"add it to crosswalk.csv or uncited_overrides.csv")
            majors.append({
                "id": mid,
                "name": row["name"],
                "cat": row["category"],
                "degrees": int(row["degrees_per_year"]),
                "note": row["note"],
                "exposure": s["score"],
                "cited": s["cited"],
                "citation": None if not s["cited"] else {
                    "soc": " / ".join(s["soc_codes"]),
                    "occ": " + ".join(s["occupation_titles"]),
                    "human": s["human_beta"],
                    "gpt4": s["gpt4_beta"],
                },
            })

    out = {"majors": majors, "momentum": momentum}
    dest = SITE_DIR / "data.json"
    dest.write_text(json.dumps(out, indent=1))
    cited = sum(1 for m in majors if m["cited"])
    print(f"Wrote {len(majors)} majors ({cited} cited) -> {dest}")


if __name__ == "__main__":
    main()
