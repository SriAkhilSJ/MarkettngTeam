# Crusor AI IDE — MarketMeNow onboarding, completed

Everything here is generated against **the real MarketMeNow schema**, not a guessed one.
Source of truth: [`thearnavrustagi/marketmenow`](https://github.com/thearnavrustagi/marketmenow), commit `HEAD` at time of writing.

```
projects/crusor-ai-ide/          ← the 10-phase onboarding output
  project.yaml                   ← Phases 1–4 + 6 (brand, features, customer, persona)
  personas/crusor-ai.yaml        ← Phase 4
  targets/twitter.yaml           ← Phase 5 (+ the keys the runtime ACTUALLY reads)
  targets/reddit.yaml            ← Phase 6
  campaigns/twitter-outreach.yaml← Phase 7 (8-criterion rubric, min_score 50)
  prompts/twitter/persona.yaml   ← Phase 8
  prompts/reddit/persona.yaml    ← Phase 8
  prompts/instagram/script_generation.yaml ← Phase 8
  templates/reels/REEL_TEMPLATE_PROMPT.md  ← Phase 9
  templates/reels/dev_workflow_demo.yaml   ← Phase 9
  generation_config.yaml         ← written between Phase 9 and Phase 10
tools/build_crusor_project.py    ← reproducible generator
tools/validate_crusor.py         ← validates against the real pydantic models
panel/                           ← the control surface (see panel/README.md)
```

Validate:

```bash
python3 tools/validate_crusor.py --marketmenow /path/to/marketmenow
```

Result: **0 failures**, validated by importing `marketmenow.models.project` directly.
The reel template also loads clean in MarketMeNow's own `ReelTemplateLoader.validate()`.

---

## Your Phase 8 / 9 / 10 instructions were wrong — here's what they really are

You asked me to inspect and not guess, so: your prompts assumed Phase 8 = positioning,
Phase 9 = differentiation, Phase 10 = final config. In `onboarding.py` they are:

| Phase | Actual function | Writes | Fields |
|---|---|---|---|
| **8** | `_phase_prompts` — *Platform Prompts* | `prompts/{twitter,reddit,instagram}/…` | No data entry. Iterates `customer.platforms`, keeps only twitter/reddit/instagram, and calls `generate_*_prompt(brand, persona)`. |
| **9** | `_phase_reel_templates` — *Reel Templates* | `templates/reels/REEL_TEMPLATE_PROMPT.md` + `templates/reels/<id>.yaml` | Writes a prefilled meta-prompt from `src/adapters/instagram/reels/templates/prompt.md`, then reads YAML until an `END` sentinel. |
| **10** | `_phase_summary` — *Summary & Activation* | nothing | Prints a Rich panel, offers "Set as active project" → writes `.mmn_active_project`. **No fields exist.** |

`generation_config.yaml` is **not** a phase — `run_onboarding` writes it between 9 and 10,
via `generate_default_generation_config(platforms)`.

So Phase 9 is not a place to put positioning copy. Positioning lives in
`project.yaml → brand.tagline / brand.value_prop` and `personas/*.yaml → description`.
I put your positioning there, where the runtime reads it.

---

## Four real bugs I hit in MarketMeNow (not style opinions)

**1. Phase 8 crashes on a clean checkout.**
`_load_template()` reads `<repo>/prompts/templates/<name>.yaml`. That directory does not
exist, because `.gitignore` contains `/prompts/` and `/templates/`. The files were never
committed. Fresh clone → `FileNotFoundError` the moment you reach Phase 8.

```python
# project_templates.py
_TEMPLATES_DIR = Path(__file__).resolve().parents[3] / "prompts" / "templates"
```

Fix: delete the `/prompts/` and `/templates/` lines from `.gitignore` and commit
`prompts/templates/{twitter_persona,reddit_persona,instagram_script}.yaml`.
I wrote equivalent prompt files into the project directly, so Crusor is not blocked.

**2. `campaigns/twitter-outreach.yaml` — including your whole Phase 7 rubric — is dead config.**
`generate_outreach_campaign()` writes it, and `generation_config.yaml` references it as
`params.profile`, but nothing loads it as a `CustomerProfile`. The actual outreach run
builds its profile in `src/marketmenow/steps/discover_prospects.py::_build_customer_profile`,
which reads `project.yaml` + `targets/twitter.yaml` and **hardcodes**:

```python
rubric=[RubricCriterion(name="relevance", description="General relevance…", max_points=10)]
min_score=7
```

Your 8 criteria × 10 points, min 50, are therefore not enforced anywhere. Everything the
runtime *does* read — `search_queries`, `influencers`, `hashtags`, `bio_blocklist`,
`bio_require_any`, `messaging` — I put in `targets/twitter.yaml`, duplicated into the
campaign file so both shapes are present and correct.

**3. The generated outreach YAML doesn't match its own model.**
`CustomerProfile` requires `discovery_vectors: list[DiscoveryVectorConfig]` with
`vector_type`. `generate_outreach_campaign()` emits `discovery:` with `type:`. Two
different key names for the same concept in one repo.

**4. `min_score` is ignored at generation time.**
`generate_outreach_campaign()` accepts `messaging` but hardcodes `min_score: 8` and
`max_prospects_to_enrich: 50` in `ideal_customer`, so Phase 7's `min_score` prompt value
silently vanishes even in the file it writes.

---

## Two things to fix in this config

- **Brand color `#FFFFFF`.** `BrandCTAScene` draws the logo letter in `brand_color` on
  `panel_background: #0A0A0A`… but the reel's own `default_visual` sets white-on-near-black,
  and any white-on-white surface renders an invisible `C`. I kept your value and set the
  panel dark. If you want a real accent, give me one hex and I'll rebuild in seconds.
- **`threads` is not a supported platform.** `generate_default_generation_config` knows
  instagram / twitter / linkedin / facebook / reddit / youtube / email. `threads` is in
  `project.yaml → platforms` (harmless, it's just ICP metadata) but gets no generator.
  I did not invent one.

`dev_workflow_demo.yaml` has `worksheet: null` deliberately — the worksheet pipeline is
built for education/quiz reels (`WorksheetConfig`, question types). A dev-tool reel has no
worksheet beat, and the loader accepts null.

---

## What to run

```bash
# inside a marketmenow checkout
cp -r /path/to/MarkettngTeam/projects/crusor-ai-ide projects/
mmn run twitter-thread --project crusor-ai-ide
mmn run reddit-engage   --project crusor-ai-ide
mmn run twitter-outreach --project crusor-ai-ide --dry-run
```

Or skip MarketMeNow entirely and use the panel:

```bash
python3 panel/server.py              # http://localhost:8000
ANTHROPIC_API_KEY=sk-... python3 panel/server.py   # real Claude drafts
```
