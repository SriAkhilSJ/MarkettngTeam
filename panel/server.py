#!/usr/bin/env python3
"""Crusor Control Panel — a locked-surface marketing console.

Design principle (the "like Claude Code" part):
    The agent can only call the actions on ACTIONS below. Nothing else exists.
    Publishing is not an action. It is not disabled by a flag — there is no code
    path that posts to a platform. The console hands you copy to paste.

Run:
    python3 panel/server.py                 # http://0.0.0.0:8000
    ANTHROPIC_API_KEY=sk-... python3 panel/server.py   # real drafts

No third-party dependencies. Python 3.9+ stdlib only.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "projects" / "crusor-ai-ide"
STATIC = Path(__file__).resolve().parent / "static"
DATA = Path(__file__).resolve().parent / "data"
DB = DATA / "panel.db"

HOST = os.environ.get("PANEL_HOST", "0.0.0.0")
PORT = int(os.environ.get("PANEL_PORT", "8000"))

# ─────────────────────────────────────────────────────────────────────────────
# The entire permission surface. If it is not here, the agent cannot do it.
# ─────────────────────────────────────────────────────────────────────────────
ACTIONS = {
    "read_brand_context": {
        "label": "Read brand context",
        "scope": "projects/crusor-ai-ide/**",
        "mutates": False,
        "gated": False,
        "why": "Reads project.yaml, persona and targets to ground every draft.",
    },
    "draft_post": {
        "label": "Draft a post",
        "scope": "writes to drafts table",
        "mutates": True,
        "gated": False,
        "why": "Produces copy. Does not leave this machine.",
    },
    "score_draft": {
        "label": "Score against the rubric",
        "scope": "deterministic checks + optional model pass",
        "mutates": False,
        "gated": False,
        "why": "Voice gate. Failing drafts are held, never queued.",
    },
    "queue_for_approval": {
        "label": "Queue for approval",
        "scope": "writes to queue table",
        "mutates": True,
        "gated": False,
        "why": "Adds to the human approval inbox.",
    },
    "record_decision": {
        "label": "Record your approval",
        "scope": "queue row -> approved | rejected",
        "mutates": True,
        "gated": True,
        "why": "Only the owner can approve. The agent has no approval action.",
    },
    "export_copy": {
        "label": "Export ready-to-post copy",
        "scope": "stdout / clipboard file",
        "mutates": False,
        "gated": False,
        "why": "You paste it. That is the handoff.",
    },
}

# Deliberately absent, and why.
LOCKED = [
    ("publish_to_platform", "No platform credentials are loaded and no posting code exists in this repo."),
    ("send_dm", "Outreach DMs are a human send. MarketMeNow owns that adapter, not this panel."),
    ("spend_budget", "No ad or boost action is exposed at any layer."),
    ("edit_brand_voice", "owner/brand-voice input is read-only here. Change it in the YAML."),
    ("write_outside_project", "All paths resolve under projects/crusor-ai-ide."),
]

# Platform limits the generator must respect.
PLATFORM_RULES = {
    "twitter": {"max_chars": 280, "max_hashtags": 3, "style": "one idea, no threads unless asked"},
    "threads": {"max_chars": 500, "max_hashtags": 3, "style": "conversational, first person"},
    "linkedin": {"max_chars": 3000, "max_hashtags": 5, "style": "hook line, short paragraphs, no hype"},
    "reddit": {"max_chars": 4000, "max_hashtags": 0, "style": "peer voice, disclose affiliation, no links"},
    "instagram": {"max_chars": 2200, "max_hashtags": 8, "style": "caption + one clear idea"},
    "facebook": {"max_chars": 63206, "max_hashtags": 3, "style": "plain, conversational"},
    "youtube": {"max_chars": 5000, "max_hashtags": 3, "style": "title + description + Shorts tags"},
}

BANNED = [
    "revolutionary", "game-changer", "game changer", "10x", "unleash", "supercharge",
    "supercharged", "cutting-edge", "cutting edge", "seamless", "effortless",
    "best-in-class", "world-class", "synergy", "disrupt", "🚀", "🔥", "💯",
    "limited time", "act now", "don't miss out", "dont miss out",
    "guaranteed", "guarantee", "risk-free", "no-brainer",
    "as an ai", "in today's fast-paced", "in todays fast-paced",
]

HYPE_SHAPES = [
    (re.compile(r"\b\d+%?\s*(?:faster|better|more productive)\b", re.I),
     "unverified numeric claim — needs a source or a measured run"),
    (re.compile(r"!{2,}"), "multiple exclamation marks"),
    (re.compile(r"\b(?:ALL|EVERY)\s+CAPS\b"), "shouting"),
]


def load_yaml(path: Path):
    return yaml.safe_load(path.read_text(encoding="utf-8"))


# ─────────────────────────────────────────────────────────────────────────────
# Brand context (read-only projection of the MarketMeNow project)
# ─────────────────────────────────────────────────────────────────────────────
def brand_context() -> dict:
    proj = load_yaml(PROJECT / "project.yaml")
    persona = load_yaml(PROJECT / "personas" / f"{proj['default_persona']}.yaml")
    tw = load_yaml(PROJECT / "targets" / "twitter.yaml")
    camp = load_yaml(PROJECT / "campaigns" / "twitter-outreach.yaml")
    return {
        "slug": proj["slug"],
        "brand": proj["brand"],
        "customer": proj["target_customer"],
        "persona": persona,
        "targets": {
            "twitter_hashtags": tw.get("hashtags", []),
            "twitter_influencers": tw.get("influencers", []),
            "messaging": tw.get("messaging", {}),
        },
        "rubric": camp["ideal_customer"]["rubric"],
        "min_score": camp["ideal_customer"].get("min_score", 50),
        "platforms": proj["target_customer"]["platforms"],
        "platform_rules": PLATFORM_RULES,
        "actions": ACTIONS,
        "locked": [{"action": a, "why": w} for a, w in LOCKED],
        "generator": "anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "offline",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Drafting
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class Draft:
    platform: str
    body: str
    hashtags: list[str]
    source: str
    note: str = ""


def _prompt(ctx: dict, platform: str, idea: str) -> str:
    b, p = ctx["brand"], ctx["persona"]
    rules = PLATFORM_RULES[platform]
    feats = "\n".join(f"- {f}" for f in b["features"][:8])
    return f"""You write social copy for {b['name']}. You are the account, not a marketer.

BRAND
name: {b['name']}
url: {b['url']}
tagline: {b['tagline']}
value_prop: {b['value_prop']}
features:
{feats}

AUDIENCE
{ctx['customer']['description']}
They are burned by AI code that looked finished and wasn't.

VOICE: {p['voice']}
TONE: {p['tone']}

HARD RULES
- Max {rules['max_chars']} characters. Max {rules['max_hashtags']} hashtags.
- Style: {rules['style']}
- Never use these words: {', '.join(BANNED)}.
- Do not invent metrics, percentages, customer names, or benchmarks.
- No emoji beyond one, usually none.
- Open with a concrete observation, not a claim about the product.

TASK
Platform: {platform}
Idea: {idea}

Return ONLY the post body, no preamble, no quotes."""


def draft_with_model(ctx: dict, platform: str, idea: str) -> Draft:
    key = os.environ["ANTHROPIC_API_KEY"]
    payload = json.dumps({
        "model": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
        "max_tokens": 700,
        "messages": [{"role": "user", "content": _prompt(ctx, platform, idea)}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    body = "".join(b.get("text", "") for b in data.get("content", [])).strip()
    tags = [] if platform == "reddit" else ctx["targets"]["twitter_hashtags"][: PLATFORM_RULES[platform]["max_hashtags"]]
    return Draft(platform, body, tags, "claude")


def draft_offline(ctx: dict, platform: str, idea: str) -> Draft:
    """Deterministic fallback so the panel is usable with no key and no network."""
    b = ctx["brand"]
    structures = {
        "twitter": "{idea}\n\nThe part nobody shows in the demo: it compiled, then it broke.\n\nPlan. Build. Test. Verify. Ship.",
        "threads": "{idea}\n\nWhich is why I stopped trusting a diff and started trusting a test run.",
        "linkedin": "{idea}\n\nThe demo always works. Production is the test.\n\n{build}",
        "reddit": "{idea}\n\nWhat actually caught it for me was running the UI, not reading the diff. Curious how others are verifying agent output before it hits main.",
        "instagram": "{idea}\n\nCode that compiles is not code that works.\n\n{build}",
        "facebook": "{idea}\n\n{build}",
        "youtube": "{idea}\n\nWe walk through what breaks between generated code and verified software, and the check that catches it. {build}",
    }
    body = structures.get(platform, "{idea}").format(
        idea=idea.strip(),
        build=f"{b['tagline']} — {b['url']}",
    )
    tags = [] if platform == "reddit" else ctx["targets"]["twitter_hashtags"][: PLATFORM_RULES[platform]["max_hashtags"]]
    return Draft(platform, body, tags, "offline", "no ANTHROPIC_API_KEY — deterministic skeleton, edit before queueing")


# ─────────────────────────────────────────────────────────────────────────────
# Voice gate — deterministic. The model never grades its own homework.
# ─────────────────────────────────────────────────────────────────────────────
def score(draft: Draft, ctx: dict) -> dict:
    text = draft.body
    low = text.lower()
    lower = low
    findings: list[dict] = []

    def add(sev, code, msg):
        findings.append({"severity": sev, "code": code, "message": msg})

    for word in BANNED:
        if word in lower:
            add("block", "banned_phrase", f"banned phrase: {word!r}")

    for pattern, msg in HYPE_SHAPES:
        if pattern.search(text):
            add("block", "hype_shape", msg)

    rules = PLATFORM_RULES[draft.platform]
    n = len(text)
    if n > rules["max_chars"]:
        add("block", "over_length", f"{n} chars > {rules['max_chars']} for {draft.platform}")
    elif n > rules["max_chars"] * 0.9:
        add("warn", "near_length", f"{n}/{rules['max_chars']} chars — close to the limit")

    if len(draft.hashtags) > rules["max_hashtags"]:
        add("block", "too_many_hashtags",
            f"{len(draft.hashtags)} hashtags > {rules['max_hashtags']} for {draft.platform}")

    if draft.platform == "reddit":
        if re.search(r"https?://", text):
            add("block", "reddit_link", "Reddit drafts carry no links")
        if not re.search(r"\b(i|we|my|our|me)\b", lower):
            add("warn", "reddit_voice", "no first-person — likely reads like a vendor")
        if b"crusor" in text.encode() and not re.search(r"i work on|we build|i build|disclos", lower):
            add("warn", "reddit_disclosure", "names the product without disclosing affiliation")

    if not re.search(r"[.!?]$", text.strip()) and draft.platform not in {"youtube"}:
        add("warn", "no_closing", "no terminal punctuation")

    if re.search(r"\b(dm|dm me|link in bio|sign up now)\b", lower):
        add("block", "cta_pitch", "sales CTA — drops the peer voice")

    blocks = [f for f in findings if f["severity"] == "block"]
    warns = [f for f in findings if f["severity"] == "warn"]
    verdict = "hold" if blocks else ("review" if warns else "pass")

    # Map findings onto the project's 8-criterion rubric (rubric is brand-owned).
    rubric_hits = []
    for crit in ctx["rubric"]:
        name = crit["name"]
        if name == "Relevant Pain Point":
            hit = any(w in lower for w in ("test", "broke", "broken", "debug", "verif", "fail"))
        elif name == "AI Coding / Agent Interest":
            hit = any(w in lower for w in ("agent", "ai", "code", "ide", "llm", "model"))
        elif name in ("AI/Developer Tool Relevance", "Active Developer or Builder"):
            hit = any(w in lower for w in ("code", "ship", "build", "dev", "repo", "commit"))
        elif name == "Web, Android, or Desktop Development":
            hit = any(w in lower for w in ("web", "android", "desktop", "backend", "ui"))
        elif name in ("Startup or SaaS Activity",):
            hit = any(w in lower for w in ("ship", "startup", "saas", "launch", "user"))
        elif name == "Audience Influence":
            hit = any(w in lower for w in ("team", "people", "community", "everyone", "most"))
        else:  # Early Adopter Potential
            hit = "?"
        rubric_hits.append({"criterion": name, "signal": hit})

    return {
        "verdict": verdict,
        "chars": n,
        "max_chars": rules["max_chars"],
        "hashtags": len(draft.hashtags),
        "findings": findings,
        "blocks": len(blocks),
        "warnings": len(warns),
        "rubric_signals": rubric_hits,
        "note": "Deterministic. Same draft always scores the same.",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Storage
# ─────────────────────────────────────────────────────────────────────────────
def db() -> sqlite3.Connection:
    DATA.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS drafts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT, idea TEXT, body TEXT, hashtags TEXT,
            source TEXT, verdict TEXT, score_json TEXT, created_at TEXT
        )""")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            draft_id INTEGER, status TEXT, decided_at TEXT, decided_by TEXT
        )""")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT, detail TEXT, at TEXT
        )""")
    conn.commit()
    return conn


def audit(action: str, detail: str) -> None:
    with db() as conn:
        conn.execute("INSERT INTO audit (action, detail, at) VALUES (?,?,?)",
                     (action, detail, datetime.now(timezone.utc).isoformat(timespec="seconds")))


# ─────────────────────────────────────────────────────────────────────────────
# HTTP
# ─────────────────────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    server_version = "CrusorPanel/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    # helpers ---------------------------------------------------------------
    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, obj) -> None:
        self._send(code, json.dumps(obj, indent=2).encode(), "application/json")

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n))
        except json.JSONDecodeError:
            return {}

    # routes ----------------------------------------------------------------
    def do_GET(self) -> None:
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            return self._send(200, (STATIC / "index.html").read_bytes(), "text/html; charset=utf-8")
        if path == "/app.js":
            return self._send(200, (STATIC / "app.js").read_bytes(), "text/javascript; charset=utf-8")
        if path == "/styles.css":
            return self._send(200, (STATIC / "styles.css").read_bytes(), "text/css; charset=utf-8")
        if path == "/api/project":
            return self._json(200, brand_context())
        if path == "/api/queue":
            with db() as conn:
                rows = conn.execute("""
                    SELECT q.id, q.status, q.decided_at, q.decided_by,
                           d.platform, d.body, d.hashtags, d.verdict, d.source, d.created_at
                    FROM queue q JOIN drafts d ON d.id = q.draft_id
                    ORDER BY q.id DESC LIMIT 100""").fetchall()
            return self._json(200, [dict(r) for r in rows])
        if path == "/api/health":
            return self._json(200, {"ok": True, "project": str(PROJECT), "db": str(DB)})
        return self._json(404, {"error": "not found", "path": path})

    def do_POST(self) -> None:
        path = self.path.split("?")[0]
        if path == "/api/draft":
            return self._draft()
        if path == "/api/queue":
            return self._queue()
        if path == "/api/decision":
            return self._decision()
        return self._json(404, {"error": "not found", "path": path})

    def _draft(self) -> None:
        data = self._body()
        platform = (data.get("platform") or "twitter").lower()
        idea = (data.get("idea") or "").strip()
        if platform not in PLATFORM_RULES:
            return self._json(400, {"error": f"platform must be one of {list(PLATFORM_RULES)}"})
        if not idea:
            return self._json(400, {"error": "idea required"})

        ctx = brand_context()
        note = ""
        if ctx["generator"] == "anthropic":
            try:
                d = draft_with_model(ctx, platform, idea)
            except Exception as exc:  # noqa: BLE001
                d = draft_offline(ctx, platform, idea)
                note = f"model call failed ({type(exc).__name__}: {exc}) — used offline skeleton"
        else:
            d = draft_offline(ctx, platform, idea)

        s = score(d, ctx)
        with db() as conn:
            cur = conn.execute(
                "INSERT INTO drafts (platform, idea, body, hashtags, source, verdict, score_json, created_at)"
                " VALUES (?,?,?,?,?,?,?,?)",
                (d.platform, idea, d.body, json.dumps(d.hashtags), d.source, s["verdict"],
                 json.dumps(s), datetime.now(timezone.utc).isoformat(timespec="seconds")),
            )
            draft_id = cur.lastrowid
        audit("draft_post", f"draft {draft_id} {platform} verdict={s['verdict']}")

        return self._json(200, {
            "id": draft_id,
            "platform": d.platform,
            "body": d.body,
            "hashtags": d.hashtags,
            "source": d.source,
            "note": d.note or note,
            "score": s,
        })

    def _queue(self) -> None:
        data = self._body()
        draft_id = data.get("draft_id")
        with db() as conn:
            row = conn.execute("SELECT verdict FROM drafts WHERE id = ?", (draft_id,)).fetchone()
            if not row:
                return self._json(404, {"error": "draft not found"})
            if row["verdict"] == "hold":
                audit("queue_for_approval", f"REFUSED draft {draft_id} (voice gate: hold)")
                return self._json(409, {
                    "error": "voice gate blocked this draft",
                    "detail": "Fix the blocking findings, re-draft, then queue.",
                })
            cur = conn.execute("INSERT INTO queue (draft_id, status) VALUES (?, 'pending')", (draft_id,))
        audit("queue_for_approval", f"draft {draft_id} queued")
        return self._json(200, {"queued": cur.lastrowid, "status": "pending"})

    def _decision(self) -> None:
        data = self._body()
        qid, decision = data.get("id"), (data.get("decision") or "").lower()
        if decision not in ("approved", "rejected"):
            return self._json(400, {"error": "decision must be approved|rejected"})
        with db() as conn:
            row = conn.execute("SELECT id FROM queue WHERE id = ?", (qid,)).fetchone()
            if not row:
                return self._json(404, {"error": "queue item not found"})
            conn.execute("UPDATE queue SET status = ?, decided_at = ?, decided_by = 'owner' WHERE id = ?",
                         (decision, datetime.now(timezone.utc).isoformat(timespec="seconds"), qid))
        audit("record_decision", f"queue {qid} -> {decision}")
        return self._json(200, {"id": qid, "status": decision})


def main() -> None:
    if not (PROJECT / "project.yaml").exists():
        print(f"project not found at {PROJECT}", file=sys.stderr)
        raise SystemExit(2)
    ctx = brand_context()
    print(f"Crusor Control Panel")
    print(f"  project : {PROJECT}")
    print(f"  brand   : {ctx['brand']['name']}")
    print(f"  drafts  : {ctx['generator']}" +
          (" (ANTHROPIC_API_KEY detected)" if ctx["generator"] == "anthropic" else " (no API key — offline skeletons)"))
    print(f"  actions : {len(ACTIONS)} allowed, {len(LOCKED)} locked")
    print(f"  listen  : http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
