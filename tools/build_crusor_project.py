#!/usr/bin/env python3
"""Build the Crusor AI IDE project for MarketMeNow.

Writes ``projects/crusor-ai-ide/`` using the EXACT models and YAML shapes that
MarketMeNow's own onboarding wizard produces:

  src/marketmenow/models/project.py        -> ProjectConfig / BrandConfig /
                                              TargetCustomer / PersonaConfig
  src/marketmenow/core/onboarding.py       -> the 10-phase wizard
  src/marketmenow/core/project_templates.py-> YAML shapes for targets,
                                              campaigns, generation_config
  src/marketmenow/outreach/models.py       -> CustomerProfile (outreach)

Run:  python3 tools/build_crusor_project.py
"""

from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
PROJ = ROOT / "projects" / "crusor-ai-ide"

SLUG = "crusor-ai-ide"

# ── Phase 1: Brand identity ────────────────────────────────────────────────
BRAND = {
    "name": "Crusor AI IDE",
    "url": "https://www.crusor.in",
    "tagline": "Crusor AI: Build and Ship with Ease",
    "value_prop": (
        "An AI-powered IDE that helps developers build, test, debug, and ship "
        "software faster with intelligent agents."
    ),
    "color": "#FFFFFF",
    "logo_letter": "C",
    "logo_suffix": "",
}

# ── Phase 2: Product features ──────────────────────────────────────────────
FEATURES = [
    "Autonomous AI Agent — Plan, Build, Debug & Execute",
    "Smart Context Engine — Understands the Entire Codebase",
    "Multi-Agent Workflow — Parallel Agents for Complex Tasks",
    "AI Code Generation & Editing",
    "AI UI Editing — Visually Modify & Refine Interfaces",
    "Live UI Preview — See Changes Instantly While Editing",
    "Web Agent Testing — Test & Verify Web Applications",
    "Android Agent Testing — Test & Verify Android Applications",
    "Desktop Agent Testing — Test & Verify Desktop Applications",
    "Verification & Testing — Tests and Verifies Generated Work",
    "Web & SaaS Development",
    "Android App Development",
    "Desktop App Development",
    "Deployment Workflow — Build, Test & Deploy",
    "MCP & Tool Integrations",
    "Safety & Approval Controls",
    "Multi-LLM Support — No Single-Model Lock-In",
    "AgentOps — Monitor Sessions, Tools, Tokens & Costs",
]

# ── Phase 3: Target customer ───────────────────────────────────────────────
CUSTOMER = {
    "description": (
        "AI-native developers, students, startups, and small engineering teams "
        "who want to build, test, and ship software faster in one desktop IDE."
    ),
    "pain_points": [
        "AI can generate code quickly, but testing, debugging, deployment, and maintenance are still difficult.",
        "Generated code can look finished in a demo but still requires verification before production.",
        "Building across Web, Android, Desktop, and Backend often requires switching between different workflows and tools.",
        "AI coding tools accelerate code generation but do not fully handle the end-to-end journey from building to verified software.",
        "AI tools can generate code quickly, but developers still have to manually test whether it actually works.",
        "UI bugs can remain hidden because generated code is not automatically tested against the real user interface.",
        "Developers must manually find bugs, reproduce failures, and debug issues after code is generated.",
        "There is a gap between AI-generated code and software that has actually been tested and verified.",
    ],
    "keywords": [
        "AI coding",
        "AI IDE",
        "AI-native development",
        "Agentic coding",
        "Autonomous AI agents",
        "AI software development",
        "AI code generation",
        "AI code editing",
        "AI UI editing",
        "AI-powered development",
        "Codebase context",
        "Smart context",
        "Multi-agent workflows",
        "AI debugging",
        "Automated testing",
        "UI testing",
        "Agent testing",
        "Software verification",
        "Web development",
        "Android development",
        "Desktop development",
        "SaaS development",
        "AI developer tools",
        "Developer productivity",
        "Build test deploy",
        "AI development workflow",
        "MCP integrations",
        "Multi-LLM",
    ],
    "platforms": [
        "twitter",
        "reddit",
        "instagram",
        "linkedin",
        "youtube",
        "facebook",
        "threads",
    ],
}

# ── Phase 4: Social media persona ──────────────────────────────────────────
PERSONA = {
    "name": "crusor-ai",
    "description": (
        "Crusor AI is an AI-native desktop IDE that helps developers plan, build, "
        "edit, test, debug, verify, and deploy software across Web, Android, "
        "Desktop, and Backend."
    ),
    "voice": "confident, clear, technical, concise, and approachable",
    "tone": "professional, confident, clear, practical, and developer-focused",
    "example_phrases": [
        "Build it. Test it. Ship it.",
        "AI that builds beyond the code.",
        "From idea to verified software.",
        "Build faster. Test smarter. Ship with confidence.",
        "Your codebase. One intelligent agent.",
        "Don't just generate code. Build software.",
        "Plan. Build. Test. Verify. Ship.",
        "One IDE. The entire development workflow.",
    ],
    "platform_overrides": {
        "reddit": {
            "voice": "A working developer who ships, not a vendor",
            "tone": (
                "Plain, specific, peer-to-peer. Talk about what breaks in practice. "
                "No launch talk, no hashtags, no marketing cadence."
            ),
        },
        "linkedin": {
            "voice": "Engineer-turned-builder explaining a workflow, not a pitch",
            "tone": "Measured, concrete, outcome-first. Technical detail over adjectives.",
        },
        "instagram": {
            "voice": "Short, visual, confident",
            "tone": "Punchy captions built around a single visible result.",
        },
    },
}

# ── Phase 5: Twitter targets ───────────────────────────────────────────────
TWITTER_INFLUENCERS = [
    "@karpathy",
    "@svpino",
    "@swyx",
    "@levelsio",
    "@rauchg",
]

TWITTER_HASHTAGS = [
    "#AI",
    "#AICoding",
    "#AIIDE",
    "#Coding",
    "#CodingAgents",
    "#AgenticAI",
    "#AIEngineering",
    "#DeveloperTools",
    "#DevTools",
    "#SoftwareDevelopment",
    "#DeveloperProductivity",
    "#BuildInPublic",
    "#IndieHackers",
    "#Startups",
    "#SaaS",
    "#WebDevelopment",
    "#AndroidDevelopment",
    "#DesktopDevelopment",
    "#AITools",
]

TWITTER_COMPANIES = [
    "@cursor_ai",
    "@windsurf",
    "@codeium",
    "@GitHub",
    "@AnthropicAI",
    "@OpenAI",
    "@GoogleDeepMind",
    "@Replit",
    "@vercel",
    "@emergent",
]

# Keys the runtime ACTUALLY reads (see steps/discover_prospects.py).
# `search_queries` -> pain_search, `influencers` -> conversation_mining,
# `hashtags` -> hashtag_scan. bio_* filter prospects. messaging overrides tone.
TWITTER_SEARCH_QUERIES = [
    '"AI wrote this" (bug OR broken OR "doesn\'t work" OR failed) -is:retweet lang:en',
    '(cursor OR windsurf OR copilot OR "claude code") (test OR testing OR broke OR debugging) -is:retweet lang:en',
    '("my AI agent" OR "coding agent") (hallucinat OR "doesn\'t compile" OR "wrong file") -is:retweet lang:en',
    '"vibe coded" OR "vibe coding" (bug OR bugs OR broken OR "shipped broken") -is:retweet lang:en',
    '(android OR "react native" OR flutter) (AI OR agent) (test OR emulator OR broken) -is:retweet lang:en',
    '"UI testing" OR "e2e tests" OR "integration tests" (AI OR agent OR generated) -is:retweet lang:en',
]

TWITTER_BIO_BLOCKLIST = [
    "crypto",
    "forex",
    "nft",
    "dropship",
    "casino",
    "betting",
    "onlyfans",
    "giveaway",
    "follow back",
    "dm for promo",
]

TWITTER_BIO_REQUIRE_ANY = [
    "developer",
    "engineer",
    "dev ",
    "software",
    "coding",
    "programmer",
    "founder",
    "indie hacker",
    "indiehacker",
    "swe",
    "sre",
    "devops",
    "full stack",
    "fullstack",
    "frontend",
    "backend",
    "android",
    "mobile dev",
    "saas",
    "build in public",
    "ai",
    "llm",
    "ml",
    "ship",
]

# ── Phase 6: Reddit targets ────────────────────────────────────────────────
REDDIT_SUBREDDITS = [
    "ChatGPT",
    "ClaudeAI",
    "LocalLLaMA",
    "ArtificialIntelligence",
    "MachineLearning",
    "programming",
    "learnprogramming",
    "webdev",
    "androiddev",
    "Frontend",
    "SideProject",
    "startups",
    "indiehackers",
    "SaaS",
]

REDDIT_QUERIES = [
    "AI coding tools",
    "AI IDE",
    "AI coding agent",
    "AI generated code testing",
    "AI code debugging",
    "AI UI testing",
    "AI coding tools testing",
    "AI software development workflow",
    "AI agent coding",
    "coding agent debugging",
    "AI generated code bugs",
    "AI IDE alternatives",
    "Cursor alternatives",
    "Windsurf alternatives",
    "AI coding workflow",
    "build test deploy AI",
    "automated UI testing",
    "developer productivity AI",
    "AI app development",
    "AI software development",
    "Antigravity Alternative",
]

# ── Phase 7: Outreach profile (8-criterion rubric, 10 pts each, min 50) ────
RUBRIC = [
    {
        "name": "AI/Developer Tool Relevance",
        "description": (
            "How closely the person or account is connected to AI development, "
            "developer tools, coding, or software engineering."
        ),
        "max_points": 10,
    },
    {
        "name": "Active Developer or Builder",
        "description": (
            "Shows active involvement in building software, AI products, "
            "applications, or technical projects."
        ),
        "max_points": 10,
    },
    {
        "name": "AI Coding / Agent Interest",
        "description": (
            "Shows interest in AI coding tools, AI IDEs, coding agents, "
            "autonomous agents, or AI-assisted development."
        ),
        "max_points": 10,
    },
    {
        "name": "Relevant Pain Point",
        "description": (
            "Experiences problems with testing, UI testing, debugging, "
            "verification, fragmented workflows, or moving from generated code "
            "to working software."
        ),
        "max_points": 10,
    },
    {
        "name": "Early Adopter Potential",
        "description": (
            "Likely to try and provide feedback on a new AI-native development tool."
        ),
        "max_points": 10,
    },
    {
        "name": "Startup or SaaS Activity",
        "description": (
            "Builds, runs, or works with startups, SaaS products, or software businesses."
        ),
        "max_points": 10,
    },
    {
        "name": "Audience Influence",
        "description": (
            "Has a relevant developer, AI, startup, or technical audience that "
            "could amplify Crusor."
        ),
        "max_points": 10,
    },
    {
        "name": "Web, Android, or Desktop Development",
        "description": (
            "Works on software across Web, Android, Desktop, or related "
            "application development workflows."
        ),
        "max_points": 10,
    },
]

MIN_SCORE = 50

MESSAGING_TONE = (
    "professional, confident, clear, practical, and developer-focused"
)


# ── writers ────────────────────────────────────────────────────────────────
def dump(data: dict) -> str:
    return yaml.dump(data, default_flow_style=False, sort_keys=False, allow_unicode=True)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    print(f"  ✓ {path.relative_to(ROOT)}")


def main() -> None:
    print(f"Building project '{SLUG}' -> {PROJ}")

    # Scaffold dirs — mirrors ProjectManager._SCAFFOLD_DIRS
    for sub in (
        "personas",
        "prompts/twitter",
        "prompts/reddit",
        "prompts/instagram",
        "targets",
        "templates/reels",
        "templates/email",
        "campaigns",
        "capsules",
        "vault",
        "output",
    ):
        (PROJ / sub).mkdir(parents=True, exist_ok=True)

    # ── project.yaml (Phase 1-4) ───────────────────────────────────────────
    project = {
        "slug": SLUG,
        "brand": {**BRAND, "features": FEATURES},
        "target_customer": CUSTOMER,
        "default_persona": PERSONA["name"],
        "env_overrides": {
            "TWITTER_USERNAME": "crusorai",
            "SMTP_FROM_NAME": "Crusor AI",
        },
    }
    write(PROJ / "project.yaml", dump(project))

    # ── personas/<name>.yaml (Phase 4) ─────────────────────────────────────
    write(PROJ / "personas" / f"{PERSONA['name']}.yaml", dump(PERSONA))

    # ── targets/twitter.yaml (Phase 5) ─────────────────────────────────────
    write(
        PROJ / "targets" / "twitter.yaml",
        dump(
            {
                "influencers": TWITTER_INFLUENCERS,
                "hashtags": TWITTER_HASHTAGS,
                "company_accounts": TWITTER_COMPANIES,
                "search_queries": TWITTER_SEARCH_QUERIES,
                "bio_blocklist": TWITTER_BIO_BLOCKLIST,
                "bio_require_any": TWITTER_BIO_REQUIRE_ANY,
                "messaging": {
                    "tone": MESSAGING_TONE,
                    "max_messages": 10,
                    "max_message_length": 280,
                    "min_delay_seconds": 120,
                    "max_delay_seconds": 300,
                    "pause_every_n": 5,
                    "long_pause_seconds": 600,
                    "reference_post": True,
                },
            }
        ),
    )

    # ── targets/reddit.yaml (Phase 6) ──────────────────────────────────────
    write(
        PROJ / "targets" / "reddit.yaml",
        dump({"subreddits": REDDIT_SUBREDDITS, "search_queries": REDDIT_QUERIES}),
    )

    # ── campaigns/twitter-outreach.yaml (Phase 7) ──────────────────────────
    campaign = {
        "platform": "twitter",
        "product": {
            "name": BRAND["name"],
            "url": BRAND["url"],
            "tagline": BRAND["tagline"],
            "value_prop": BRAND["value_prop"],
        },
        "ideal_customer": {
            "description": CUSTOMER["description"],
            "rubric": RUBRIC,
            "min_score": MIN_SCORE,
            "max_prospects_to_enrich": 50,
            "bio_blocklist": TWITTER_BIO_BLOCKLIST,
            "bio_require_any": TWITTER_BIO_REQUIRE_ANY,
        },
        "discovery": [
            {
                "type": "pain_search",
                "entries": TWITTER_SEARCH_QUERIES,
                "max_per_entry": 5,
            },
            {
                "type": "conversation_mining",
                "entries": TWITTER_INFLUENCERS,
                "max_per_entry": 5,
            },
            {
                "type": "hashtag_scan",
                "entries": TWITTER_HASHTAGS[:10],
                "max_per_entry": 5,
            },
        ],
        "messaging": {
            "tone": MESSAGING_TONE,
            "max_messages": 10,
            "max_message_length": 280,
            "min_delay_seconds": 120,
            "max_delay_seconds": 300,
            "pause_every_n": 5,
            "long_pause_seconds": 600,
            "reference_post": True,
        },
    }
    write(PROJ / "campaigns" / "twitter-outreach.yaml", dump(campaign))

    # ── Phase 8: platform prompts ──────────────────────────────────────────
    write(PROJ / "prompts" / "twitter" / "persona.yaml", TWITTER_PERSONA_PROMPT)
    write(PROJ / "prompts" / "reddit" / "persona.yaml", REDDIT_PERSONA_PROMPT)
    write(
        PROJ / "prompts" / "instagram" / "script_generation.yaml",
        INSTAGRAM_SCRIPT_PROMPT,
    )

    # ── generation_config.yaml (written between Phase 9 and 10) ────────────
    write(
        PROJ / "generation_config.yaml",
        dump(
            {
                "items": [
                    {"platform": "instagram", "command_type": "reel",
                     "params": {"template": "dev_workflow_demo"}},
                    {"platform": "instagram", "command_type": "carousel", "count": 2},
                    {"platform": "twitter", "command_type": "thread"},
                    {"platform": "twitter", "command_type": "engage"},
                    {"platform": "twitter", "command_type": "outreach",
                     "params": {"profile": "campaigns/twitter-outreach.yaml"}},
                    {"platform": "linkedin", "command_type": "post"},
                    {"platform": "facebook", "command_type": "post"},
                    {"platform": "reddit", "command_type": "engage"},
                    {"platform": "youtube", "command_type": "short", "count": 1},
                    {"platform": "tiktok", "command_type": "upload", "count": 1},
                ]
            }
        ),
    )

    print("Done. Templates (Phase 9) are written separately.")


# ── Phase 8 prompt bodies (mirror prompts/twitter/persona.yaml shape) ──────
TWITTER_PERSONA_PROMPT = '''system: |
  You ARE {{ brand.name }} — the social account behind an AI-native desktop IDE.

  You are NOT a corporate account and NOT a hype merchant. You are a builder
  talking to builders, in public, about what actually happens when you let
  agents write software.

  YOUR PERSONALITY:
  - Confident but never inflated. You show the workflow, not the adjectives.
  - Technical and specific: real commands, real failures, real fixes.
  - Short sentences. You respect the reader's time.
  - You are honest about the hard part — testing, debugging, verification —
    because that is the part everyone else skips.
  - You have opinions about AI coding tools and you say them plainly, without
    trashing named competitors. Compare workflows, never products.
  - You celebrate shipped software, not generated code.
  - No emoji spam. At most one emoji, usually none.
  - Never use: "revolutionary", "game-changer", "10x", "unleash", "supercharge",
    "🚀", "🔥", "LIMITED TIME", or any fear-based hook.
  - Keep replies under 250 characters, 280 max.

  YOUR THESIS (say this in many ways, never the same way twice):
  - Generating code is the easy part. Verifying it is the job.
  - AI should take you from plan to verified software, not just to a diff.
  - One workflow: Plan. Build. Test. Verify. Ship.

  WHAT YOU DO:
  - {{ brand.value_prop }}
  - Home: {{ brand.url }}
  {% for feat in brand.features %}
  - {{ feat }}
  {% endfor %}

  HOW YOU POST:
  - Replying: one specific, useful sentence. Add information, never just agree.
  - Posting: lead with a concrete observation or a workflow detail, not a claim.
  - When someone complains about AI-generated code breaking: describe the test
    step that catches it. Teach first, mention the product only if it fits.
  - You never ask people to "DM you" or drop links in replies unprompted.
'''


REDDIT_PERSONA_PROMPT = '''system: |
  You ARE a working developer who uses AI coding agents daily. You are NOT a
  vendor account and you never sound like one.

  On Reddit you are a peer in the comments. You have shipped software, broken
  things, and spent Saturday debugging agent output. That experience is your
  only credential.

  HOW YOU COMMENT ON REDDIT:
  - Answer the actual question in the post first. Be genuinely useful.
  - Concrete over abstract: name the command, the test, the failure mode.
  - Admit limits. If something did not work for you, say so.
  - Short paragraphs, no bullet-point marketing, no headers.
  - No hashtags, no emoji, no exclamation marks.
  - Never open with "Great question" or "As a developer, ...".
  - Mention {{ brand.name }} only when directly relevant to a tool question,
    and disclose that you work on it in the same sentence.
  - Never link-drop. Never DM-pitch. Never post the same comment twice.
  - Assume the reader is more senior than you and will notice flattery instantly.

  WHAT YOU KNOW:
  - {{ brand.tagline }}
  - {{ brand.value_prop }}
  - Home: {{ brand.url }}
  {% for feat in brand.features %}
  - {{ feat }}
  {% endfor %}

  WHAT YOU CARE ABOUT:
  - Generated code that "looks done" in a demo and breaks in production.
  - The missing verification loop: UI testing, agent testing, real devices.
  - Fragmented workflows across web, Android, desktop and backend.
  - Developers who would rather see a working test than a feature list.
'''


INSTAGRAM_SCRIPT_PROMPT = '''system: |
  You write short-form video scripts for {{ brand.name }}.
  {{ brand.tagline }}
  {{ brand.value_prop }}

  The audience: developers and founders building with AI agents who have been
  burned by code that looked finished and was not.

  RULES:
  - The first line is the hook and it must land in under 2 seconds.
  - Show a real developer moment, not a product tour.
  - No feature lists. One idea per script.
  - Concrete specifics: the failing test, the broken screen, the missing check.
  - End on the workflow, not on a call to action shouted at the viewer.
  - Total spoken length: 25-40 seconds.
  - Never open with "Did you know" or "Tired of".
  - No emoji in the script body.

  VOICE: {{ persona_voice }}
  TONE: {{ persona_tone }}

  HOW THE BRAND TALKS:
  {% for phrase in brand_phrases %}
  - {{ phrase }}
  {% endfor %}

  Output JSON with: hook, beats (list of {voiceover, on_screen}), caption, hashtags.

user: |
  Write a 30-second script for this idea: {{ idea }}

  Format: vertical 9:16. One screen action per beat.
  Keep total voiceover under 90 words.
'''


if __name__ == "__main__":
    main()
