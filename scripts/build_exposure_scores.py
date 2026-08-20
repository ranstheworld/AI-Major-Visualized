#!/usr/bin/env python3
"""
build_exposure_scores.py

Turns two inputs into one output:
  data/crosswalk.csv   — which real occupation(s) represent each major (human judgment)
  data/occ_level.csv   — Eloundou, Manning, Mishkin & Rock's published exposure scores
into:
  data/exposure_scores.json — one score per major, with its full citation attached

This is the ONLY place scoring logic lives. If you disagree with how a major maps to an
occupation, edit crosswalk.csv — not this script, and not the frontend. If you want to score
by a different measure (e.g. the stricter "gamma" instead of "beta", or GPT-4-only instead of
the human/GPT-4 average), that change belongs here too, and nowhere else.

Deliberately NOT an LLM-scoring step (contrast with Karpathy's score.py, which sends each
occupation to an LLM with a rubric). We're not asking a model to judge exposure — we're citing
someone else's published, peer-reviewed measurement of it. The judgment call we ARE making is
which occupation represents which major, and that's isolated in crosswalk.csv specifically so
it's auditable on its own, independent of this arithmetic.
"""
import csv
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

# Two majors are genuinely too heterogeneous to map to one occupation (Liberal Arts &
# General Studies, Interdisciplinary & General Studies). Their scores are disclosed as
# uncited rubric estimates in data/uncited_overrides.csv — never silently substituted here.
def load_occ_level():
    occs = {}
    with open(DATA_DIR / "occ_level.csv") as f:
        for row in csv.DictReader(f):
            occs[row["O*NET-SOC Code"]] = {
                "title": row["Title"],
                "gpt4_beta": float(row["dv_rating_beta"]),
                "human_beta": float(row["human_rating_beta"]),
            }
    return occs


def load_crosswalk():
    rows = []
    with open(DATA_DIR / "crosswalk.csv") as f:
        for row in csv.DictReader(f):
            socs = [s.strip() for s in row["soc_codes"].split("/")]
            rows.append((row["major_id"], row["major_name"], socs))
    return rows


def load_uncited_overrides():
    overrides = {}
    with open(DATA_DIR / "uncited_overrides.csv") as f:
        for row in csv.DictReader(f):
            overrides[row["major_id"]] = {
                "score": float(row["score"]),
                "reason": row["reason"],
            }
    return overrides


def score_major(socs, occs):
    """Average this major's mapped occupation(s)' human and GPT-4 beta scores,
    scale 0-1 -> 0-10, round to the nearest 0.5 (matches the paper's own granularity)."""
    gpt4_sum = human_sum = 0.0
    titles = []
    for soc in socs:
        occ = occs[soc]  # raises KeyError loudly if a crosswalk SOC isn't in occ_level.csv —
                          # intentional; a silent fallback here would hide a real data gap.
        gpt4_sum += occ["gpt4_beta"]
        human_sum += occ["human_beta"]
        titles.append(occ["title"])
    n = len(socs)
    gpt4_avg = round(gpt4_sum / n, 3)
    human_avg = round(human_sum / n, 3)
    score = round(((gpt4_avg + human_avg) / 2) * 10 * 2) / 2  # nearest 0.5
    return score, human_avg, gpt4_avg, titles


def main():
    occs = load_occ_level()
    crosswalk = load_crosswalk()
    overrides = load_uncited_overrides()

    out = {}
    for major_id, major_name, socs in crosswalk:
        score, human_avg, gpt4_avg, titles = score_major(socs, occs)
        out[major_id] = {
            "score": score,
            "human_beta": human_avg,
            "gpt4_beta": gpt4_avg,
            "soc_codes": socs,
            "occupation_titles": titles,
            "cited": True,
        }

    for major_id, o in overrides.items():
        out[major_id] = {
            "score": o["score"],
            "human_beta": None,
            "gpt4_beta": None,
            "soc_codes": [],
            "occupation_titles": [],
            "cited": False,
            "reason": o["reason"],
        }

    dest = DATA_DIR / "exposure_scores.json"
    dest.write_text(json.dumps(out, indent=2))
    print(f"Wrote {len(out)} major scores ({sum(1 for v in out.values() if v['cited'])} cited) -> {dest}")


if __name__ == "__main__":
    main()
