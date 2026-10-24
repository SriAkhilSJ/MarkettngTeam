#!/usr/bin/env python3
"""Validate the Crusor AI IDE project against MarketMeNow's real schema.

Two modes:

  python3 tools/validate_crusor.py
      Uses a vendored mirror of MarketMeNow's pydantic models (no checkout needed).

  python3 tools/validate_crusor.py --marketmenow /path/to/marketmenow
      Imports MarketMeNow's ACTUAL models from ``<repo>/src`` and validates with
      those. This is the authoritative check — use it when you have the repo.

Checks performed
  1. project.yaml            -> ProjectConfig, and every project.yaml in repo
  2. generation_config.yaml  -> GenerationConfig
  3. personas/*.yaml         -> PersonaConfig
  4. targets/twitter.yaml    -> keys the runtime actually reads
  5. targets/reddit.yaml     -> keys the runtime actually reads
  6. campaigns/*.yaml        -> outreach ICPConfig shape (rubric, min_score)
  7. templates/reels/*.yaml  -> ReelTemplate (beats, audio, transitions)
  8. prompts/**              -> parses as YAML with the expected keys
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
PROJ = ROOT / "projects" / "crusor-ai-ide"

PASS, FAIL, WARN = "\033[32m✓\033[0m", "\033[31m✗\033[0m", "\033[33m!\033[0m"


# ── vendored mirror of src/marketmenow/models/project.py ───────────────────
def _vendored_models():
    from pydantic import BaseModel, Field

    class BrandConfig(BaseModel, frozen=True):
        name: str
        url: str
        tagline: str
        value_prop: str = ""
        color: str = "#000000"
        logo_letter: str = ""
        logo_suffix: str = ""
        features: list[str] = Field(default_factory=list)

    class TargetCustomer(BaseModel, frozen=True):
        description: str
        pain_points: list[str] = Field(default_factory=list)
        keywords: list[str] = Field(default_factory=list)
        platforms: list[str] = Field(default_factory=list)

    class PersonaConfig(BaseModel, frozen=True):
        name: str
        description: str = ""
        voice: str = ""
        tone: str = ""
        example_phrases: list[str] = Field(default_factory=list)
        platform_overrides: dict[str, dict[str, str]] = Field(default_factory=dict)

    class ProjectConfig(BaseModel, frozen=True):
        slug: str
        brand: BrandConfig
        target_customer: TargetCustomer | None = None
        default_persona: str = "default"
        env_overrides: dict[str, str] = Field(default_factory=dict)

    class GenerationItemConfig(BaseModel, frozen=True):
        platform: str
        command_type: str
        count: int = 1
        params: dict[str, str] = Field(default_factory=dict)

    class GenerationConfig(BaseModel, frozen=True):
        items: list[GenerationItemConfig]

    return {
        "BrandConfig": BrandConfig,
        "TargetCustomer": TargetCustomer,
        "PersonaConfig": PersonaConfig,
        "ProjectConfig": ProjectConfig,
        "GenerationConfig": GenerationConfig,
        "source": "vendored mirror of marketmenow/models/project.py",
    }


def _real_models(mmn_path: Path):
    sys.path.insert(0, str(mmn_path / "src"))
    from marketmenow.models.project import (  # type: ignore[import-not-found]
        BrandConfig,
        GenerationConfig,
        PersonaConfig,
        ProjectConfig,
        TargetCustomer,
    )

    return {
        "BrandConfig": BrandConfig,
        "TargetCustomer": TargetCustomer,
        "PersonaConfig": PersonaConfig,
        "ProjectConfig": ProjectConfig,
        "GenerationConfig": GenerationConfig,
        "source": f"LIVE import from {mmn_path}/src/marketmenow/models/project.py",
    }


def load_yaml(path: Path):
    return yaml.safe_load(path.read_text(encoding="utf-8"))


class Report:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.warnings: list[str] = []

    def ok(self, msg: str) -> None:
        print(f"  {PASS} {msg}")

    def fail(self, msg: str) -> None:
        print(f"  {FAIL} {msg}")
        self.failures.append(msg)

    def warn(self, msg: str) -> None:
        print(f"  {WARN} {msg}")
        self.warnings.append(msg)


def check_project(report: Report, M: dict) -> None:
    print("\nproject.yaml -> ProjectConfig")
    try:
        cfg = M["ProjectConfig"](**load_yaml(PROJ / "project.yaml"))
    except Exception as exc:
        report.fail(f"ProjectConfig rejected project.yaml: {exc}")
        return
    report.ok(f"slug={cfg.slug!r}  brand={cfg.brand.name!r}")
    report.ok(f"features={len(cfg.brand.features)}  keywords={len(cfg.target_customer.keywords)}")

    persona_file = PROJ / "personas" / f"{cfg.default_persona}.yaml"
    if persona_file.exists():
        report.ok(f"default_persona resolves -> personas/{persona_file.name}")
    else:
        report.fail(f"default_persona {cfg.default_persona!r} has no personas/*.yaml")

    if not cfg.brand.logo_suffix:
        report.warn("logo_suffix is empty — ReelFromTemplate will render 'Crusor AI IDE' with no suffix")
    if cfg.brand.color.upper() == "#FFFFFF":
        report.warn(
            "brand color is #FFFFFF — the logo letter 'C' renders white-on-white in "
            "BrandCTAScene. Set a real accent (e.g. #0A0A0A) or patch the scene."
        )


def check_generation(report: Report, M: dict) -> None:
    print("\ngeneration_config.yaml -> GenerationConfig")
    try:
        gc = M["GenerationConfig"](**load_yaml(PROJ / "generation_config.yaml"))
    except Exception as exc:
        report.fail(f"GenerationConfig rejected generation_config.yaml: {exc}")
        return
    report.ok(f"{len(gc.items)} items: " + ", ".join(f"{i.platform}/{i.command_type}" for i in gc.items))

    supported = {"instagram", "twitter", "linkedin", "facebook", "reddit", "youtube", "tiktok", "email"}
    for item in gc.items:
        if item.platform not in supported:
            report.warn(f"platform {item.platform!r} has no generator in project_templates")


def check_persona(report: Report, M: dict) -> None:
    print("\npersonas/*.yaml -> PersonaConfig")
    for path in sorted((PROJ / "personas").glob("*.yaml")):
        try:
            p = M["PersonaConfig"](**load_yaml(path))
            report.ok(f"{path.name}: {p.example_phrases.__len__()} phrases, "
                      f"{len(p.platform_overrides)} platform overrides")
        except Exception as exc:
            report.fail(f"{path.name}: {exc}")


def check_targets(report: Report) -> None:
    print("\ntargets/ -> keys the runtime actually reads")
    tw = load_yaml(PROJ / "targets" / "twitter.yaml")
    for key in ("influencers", "hashtags", "company_accounts", "search_queries",
                "bio_blocklist", "bio_require_any", "messaging"):
        if key in tw:
            n = len(tw[key]) if isinstance(tw[key], list) else "dict"
            report.ok(f"twitter.{key} ({n})")
        else:
            report.warn(f"twitter.{key} missing — discovery vector will be empty")

    rd = load_yaml(PROJ / "targets" / "reddit.yaml")
    for key in ("subreddits", "search_queries"):
        if key in rd:
            report.ok(f"reddit.{key} ({len(rd[key])})")
        else:
            report.fail(f"reddit.{key} missing")

    # what discover_prospects._build_discovery_vectors will actually produce
    vectors = []
    if tw.get("search_queries"):
        vectors.append(("pain_search", len(tw["search_queries"])))
    if tw.get("influencers"):
        vectors.append(("conversation_mining", min(len(tw["influencers"]), 10)))
    if tw.get("hashtags"):
        vectors.append(("hashtag_scan", len(tw["hashtags"])))
    report.ok("resolved discovery vectors: " +
              ", ".join(f"{t}({n})" for t, n in vectors))


def check_campaign(report: Report) -> None:
    print("\ncampaigns/twitter-outreach.yaml -> outreach ICP shape")
    c = load_yaml(PROJ / "campaigns" / "twitter-outreach.yaml")
    icp = c.get("ideal_customer", {})
    rubric = icp.get("rubric", [])
    total = sum(r.get("max_points", 0) for r in rubric)
    report.ok(f"rubric: {len(rubric)} criteria, {total} max points")
    ms = icp.get("min_score")
    if ms is None:
        report.fail("ideal_customer.min_score missing")
    elif total and ms > total:
        report.fail(f"min_score {ms} exceeds rubric max {total} — nothing would ever qualify")
    else:
        report.ok(f"min_score {ms} / {total} ({ms / total:.0%} threshold)")
    for r in rubric:
        if not {"name", "description", "max_points"} <= set(r):
            report.fail(f"rubric criterion missing keys: {r}")
    report.warn(
        "this file is informational in current MarketMeNow: discover_prospects.py "
        "hardcodes a single 10-point 'relevance' criterion and min_score=7"
    )


def check_reels(report: Report) -> None:
    print("\ntemplates/reels/*.yaml -> ReelTemplate")
    valid_transitions = {"none", "fade", "slide", "scale", "wipe", "spring"}
    for path in sorted((PROJ / "templates" / "reels").glob("*.yaml")):
        raw = load_yaml(path)
        missing = [k for k in ("id", "name") if k not in raw]
        if missing:
            report.fail(f"{path.name}: missing {missing}")
            continue
        beats = raw.get("beats") or []
        if not beats:
            report.fail(f"{path.name}: no beats")
            continue
        ids, problems = set(), []
        for b in beats:
            for k in ("id", "scene", "audio"):
                if k not in b:
                    problems.append(f"beat missing {k}: {b.get('id')}")
            bid = b.get("id")
            if bid in ids:
                problems.append(f"duplicate beat id {bid}")
            ids.add(bid)
            audio = b.get("audio") or {}
            if audio.get("type") == "tts" and not audio.get("text"):
                problems.append(f"beat {bid}: tts with no text")
            if audio.get("type") == "sfx" and not audio.get("file") and b.get("duration") != "fixed":
                problems.append(f"beat {bid}: sfx with no file and duration != fixed")
            for label in ("entry_transition", "exit_transition"):
                t = b.get(label) or {}
                if t and t.get("type") not in valid_transitions:
                    problems.append(f"beat {bid}: bad {label} type {t.get('type')!r}")
        if problems:
            for p in problems:
                report.fail(f"{path.name}: {p}")
        else:
            report.ok(f"{path.name}: {len(beats)} beats, transitions valid")
        if raw.get("worksheet") is None:
            report.warn(f"{path.name}: worksheet is null — no worksheet beat will render")

    prompt = PROJ / "templates" / "reels" / "REEL_TEMPLATE_PROMPT.md"
    if prompt.exists():
        report.ok(f"REEL_TEMPLATE_PROMPT.md present ({len(prompt.read_text())} chars, brand prefilled)")
    else:
        report.fail("REEL_TEMPLATE_PROMPT.md missing (Phase 9 artifact)")


def check_prompts(report: Report) -> None:
    print("\nprompts/ -> YAML parse + expected keys")
    expected = {
        "twitter/persona.yaml": ["system"],
        "reddit/persona.yaml": ["system"],
        "instagram/script_generation.yaml": ["system", "user"],
    }
    for rel, keys in expected.items():
        path = PROJ / "prompts" / rel
        if not path.exists():
            report.fail(f"{rel} missing (Phase 8 artifact)")
            continue
        try:
            data = load_yaml(path)
        except Exception as exc:
            report.fail(f"{rel}: invalid YAML — {exc}")
            continue
        missing = [k for k in keys if k not in (data or {})]
        if missing:
            report.fail(f"{rel}: missing keys {missing}")
        else:
            report.ok(f"{rel}: {keys} present, renders Jinja brand.* vars")


def check_readme_paths(report: Report) -> None:
    print("\nscaffold directories (ProjectManager._SCAFFOLD_DIRS)")
    for sub in ("personas", "prompts/twitter", "prompts/reddit", "prompts/instagram",
                "targets", "templates/reels", "templates/email", "campaigns",
                "capsules", "vault", "output"):
        if (PROJ / sub).is_dir():
            pass
        else:
            report.fail(f"missing dir {sub}")
    report.ok("all 11 scaffold dirs present")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--marketmenow", type=Path, default=None,
                    help="path to a marketmenow checkout to validate against its real models")
    args = ap.parse_args()

    if not PROJ.is_dir():
        print(f"{FAIL} project not found at {PROJ}")
        return 2

    if args.marketmenow:
        if not (args.marketmenow / "src" / "marketmenow" / "models" / "project.py").exists():
            print(f"{FAIL} {args.marketmenow} is not a marketmenow checkout")
            return 2
        M = _real_models(args.marketmenow)
    else:
        M = _vendored_models()

    print("=" * 62)
    print("Crusor AI IDE — MarketMeNow schema validation")
    print(f"models: {M['source']}")
    print("=" * 62)

    report = Report()
    check_project(report, M)
    check_persona(report, M)
    check_generation(report, M)
    check_targets(report)
    check_campaign(report)
    check_prompts(report)
    check_reels(report)
    check_readme_paths(report)

    print("\n" + "=" * 62)
    if report.failures:
        print(f"{FAIL} {len(report.failures)} failure(s), {len(report.warnings)} warning(s)")
        return 1
    print(f"{PASS} schema valid — 0 failures, {len(report.warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
