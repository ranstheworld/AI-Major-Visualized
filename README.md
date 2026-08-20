# AI-MAJOR-VISUALIZED
# Which College Majors Sit Closest to What AI Can Already Do?

A treemap of 91 U.S. bachelor's degree fields, sized by annual degrees conferred and colored by a
real, cited AI-exposure score — not a guess dressed up as one.

[Live demo →][(https://ranstheworld.github.io/AI-Major-Visualized/)]
---

## The finding worth your two minutes

Foreign Languages & Linguistics (8.5/10) and Mathematics & Statistics (8.0/10) sit at the top of the
exposure scale — translation and symbolic reasoning are exactly what current models are best at.
Fire Science and Fitness & Wellness (1.0/10) sit at the bottom — physical, in-person, high-stakes work
doesn't automate the same way.

The more interesting number is the one in between: **Computer Science scores 6.5–7.0**, and real
enrollment data (National Student Clearinghouse, Spring 2026) shows Computer & Information Sciences
enrollment falling 8.4% at four-year schools — a second straight declining term, with the lowest
second-year persistence rate of any top-10 major — while Health Professions grows for a third
consecutive year. Students appear to be pricing in AI exposure to the major *itself*, not just the
jobs it used to guarantee. That's not a conclusion this project reaches — it's a pattern sitting in
public data that nobody had put in the same chart before.

## What's in here

- `index.html` — the visualization (D3.js, single file, no build step)
- Grouped treemap by field, color = exposure score, size = annual degree completions
- Toggle between coloring by exposure and by field category
- Every major's tooltip shows its exact source citation, not just a number

## Data & methodology

| Layer | Source |
|---|---|
| Degree sizes | NCES Digest of Education Statistics / IPEDS, Table 322.10 (2021–22 — the newest finalized detailed breakdown; there's a structural ~4-year publication lag here, which is itself worth knowing) |
| Enrollment momentum (▲/▼ badges) | National Student Clearinghouse Research Center, Final Fall/Spring Enrollment Trends & 2026 Persistence and Retention Report |
| Exposure scores | Eloundou, Manning, Mishkin & Rock, *"GPTs are GPTs: Labor Market Impact Potential of LLMs"* (arXiv:2303.10130 / *Science*, 2024) — their published `occ_level.csv`, not a re-derived estimate |
| Context stats | Anthropic Economic Index reports (Jan & Mar 2026) |
| Format | Modeled on Andrej Karpathy's occupational exposure treemap ([github.com/karpathy/jobs](https://github.com/karpathy/jobs)) |

**89 of 91 majors** are mapped to their real closest occupation(s) in the Eloundou dataset (e.g.
Computer Science → Software Developers, SOC 15-1252.00) and scored using the average of that
occupation's human-rated and GPT-4-rated exposure measure. Only *Liberal Arts & General Studies* and
*Interdisciplinary & General Studies* remain rubric estimates — genuinely too heterogeneous for one
occupation to represent honestly. Every rectangle's tooltip shows exactly which.

## How this was actually built

I don't think "I used AI to build this" is an interesting disclosure in 2026 — knowing how to direct
it without abdicating judgment is. So here's the actual division of labor, so you can judge that
yourself instead of taking my word for it.

**What I decided:**
- Reframing Karpathy's occupation-level exposure chart at the *major* level — the decision point that
  actually matters to a prospective student is the major, not an occupation they haven't chosen yet
- Rejecting the first version's exposure scores once built, on the grounds that "my own qualitative
  0–10 estimate" isn't good enough to put in front of anyone, and specifying the fix: replace it with
  a real, published, peer-reviewed dataset
- Choosing the full-rigor rebuild (map all 91 majors to real occupations) over a faster partial patch
  when both were on the table
- When the automated pipeline hit a real wall — GitHub blocks scraper access to the raw dataset file —
  going and pulling the actual 924-row CSV by hand rather than shipping a version sourced from search
  fragments
- Every methodology judgment call disclosed in the caveats above and in-app — which occupation best
  represents a major, where the evidence is honestly too thin to cite anything, what "exposure" does
  and doesn't mean — is mine, made explicit rather than smoothed over

**What Claude did:** wrote the D3.js implementation, ran the searches, parsed the CSV, matched
occupations to majors against my specification, drafted this README's first pass.

That's the same division of labor as any tool-augmented analytical work: the tool executes, the
judgment is the deliverable. Judge the judgment, not the toolchain.

## Known limitations

- Exposure scores describe task overlap with current model capability, not job loss, wage effects, or
  a forecast of anything — same caveat the original Eloundou paper and Karpathy's project both gave
- The major → occupation mapping is my own judgment call, not an official government crosswalk; a
  different reasonable mapping would shift some scores
- Degree-conferral sizes are three years old by publication necessity — see the in-app note on why

## Project structure

```
data/
  majors.csv             degree sizes + descriptive notes, from NCES — no scores in here
  crosswalk.csv          which real occupation(s) represent each major — the one place my
                          own judgment does the most work, isolated so it's auditable on
                          its own, independent of any code
  occ_level.csv          Eloundou et al.'s published exposure dataset (the SOC codes this
                          project actually cites, pulled from their repo by hand — see below)
  uncited_overrides.csv  the 2 majors too heterogeneous to map to one occupation, and why
  momentum.json           enrollment-momentum badges (NSC) — a separately-sourced, faster-
                          moving signal, deliberately never blended into the exposure score
  exposure_scores.json   generated — output of build_exposure_scores.py
scripts/
  build_exposure_scores.py   crosswalk.csv + occ_level.csv -> exposure_scores.json
  build_site_data.py         majors.csv + exposure_scores.json + momentum.json -> site/data.json
site/
  index.html              markup only, no embedded data or scoring logic
  style.css                all styling
  chart.js                 D3 rendering, filtering, tooltips — fetches data.json at runtime
  data.json                generated — the only thing the frontend actually reads
```

Regenerate the data from scratch:
```
python3 scripts/build_exposure_scores.py
python3 scripts/build_site_data.py
```

**Why split it this way.** The first version of this was one HTML file with the data,
scoring, and rendering all inline — fine for a quick chat artifact, not fine for something
meant to be read, audited, and re-run by other people. Three boundaries matter here:

1. **Data is reviewable without reading code.** `crosswalk.csv` is a CSV — anyone can open
   it and check whether mapping Psychology to Clinical and Counseling Psychologists is a
   defensible call, without touching a line of JavaScript. That file is the actual claim
   this project makes; everything else is plumbing.
2. **Scoring is deterministic and re-runnable, not baked in.** If Eloundou et al. publish an
   update, or you want to score by a stricter measure, `build_exposure_scores.py` is the
   only file that changes. `chart.js` never needs to know.
3. **The frontend has no opinions about data provenance.** `chart.js` renders whatever's in
   `data.json` — it doesn't know or care whether a score came from a real citation or a
   disclosed override. That distinction lives entirely in the data layer, which keeps the
   frontend simple and keeps the honesty machinery in one auditable place instead of
   scattered through render logic.

Same shape as Karpathy's own repo, for the same reason: `code/` (his `score.py` +
`build_site_data.py`) produces `site/data.json`, and `site/index.html` just renders it. The
one deliberate difference — `build_exposure_scores.py` here does arithmetic on a published
dataset instead of calling an LLM to generate new scores, because the goal wasn't a fresh
judgment call, it was citing someone else's.



Format and inspiration: Andrej Karpathy(https://github.com/karpathy/jobs). Data: NCES, National
Student Clearinghouse, Eloundou et al. (OpenAI/UPenn), Anthropic Economic Index. Build: David Ran Ren,
directing Claude (Anthropic).

## License

MIT — see `LICENSE`.

---

Built by David Ran Ren — X:RanRenImagines
