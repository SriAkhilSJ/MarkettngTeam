# Crusor Control Panel

A locked-surface marketing console. The "system where the agent can only control
this platform" — the same idea as Claude Code's permission model, applied to social.

```bash
python3 panel/server.py                             # http://localhost:8000
ANTHROPIC_API_KEY=sk-ant-... python3 panel/server.py  # real Claude drafts
PANEL_PORT=8080 python3 panel/server.py             # different port
```

Python 3.9+, **stdlib only**. `pyyaml` is the sole import beyond stdlib.

---

## The permission surface

Six actions exist. Five have code. One requires you.

| Action | Mutates | Gated | What it does |
|---|---|---|---|
| `read_brand_context` | no | — | Reads `projects/crusor-ai-ide/**` |
| `draft_post` | yes | — | Writes a row to `drafts` |
| `score_draft` | no | — | Deterministic voice gate |
| `queue_for_approval` | yes | — | Writes a row to `queue`; **refuses `hold` drafts** |
| `record_decision` | yes | **you** | Approve / reject. The agent has no equivalent. |
| `export_copy` | no | — | Copy to clipboard. You paste. |

Locked by absence, not by a flag:

- `publish_to_platform` — no posting code exists in this repo, and no credentials are loaded
- `send_dm` — outreach sending belongs to MarketMeNow's adapter, not this panel
- `spend_budget` — there is no ad action at any layer
- `edit_brand_voice` — `owner/brand-voice` is read-only here; edit the YAML
- `write_outside_project` — every path resolves under `projects/crusor-ai-ide`

The distinction that matters: a disabled button is a flag someone can flip.
A missing function is a capability the agent does not have.

---

## The voice gate is deterministic

No LLM grades its own draft. `score()` runs in ~1ms and returns the same verdict
every time for the same input:

- **banned phrases** — `revolutionary`, `10x`, `supercharge`, `guaranteed`, `🚀`… (full list in `server.py`)
- **hype shapes** — unverified "N% faster" claims, `!!`, `ALL CAPS`
- **per-platform limits** — chars, hashtag count, from `PLATFORM_RULES`
- **Reddit rules** — no links, first-person required, must disclose affiliation if naming the product
- **pitch CTAs** — `dm me`, `link in bio`, `sign up now`

Verdicts: `pass` (queue it), `review` (warnings, queue it and look), `hold` (blocked —
`POST /api/queue` returns **409**).

Why deterministic: the same model that wrote the copy, told to sound confident, will
approve its own copy. That is not a check, it is a mirror.

---

## Drafting

If `ANTHROPIC_API_KEY` is set, drafts come from the Claude Messages API using the
brand context, persona voice/tone, and per-platform rules. If the call fails — no
network, bad key, rate limit — it falls back to a deterministic skeleton and **says so**
in the response (`note`). No silent degradation.

With no key at all, every draft is a structure to edit by hand. The gate still runs.

---

## API

```
GET  /api/project          brand context, actions, locked list, platform rules
GET  /api/queue            queue + joined drafts
GET  /api/health
POST /api/draft            {platform, idea}       -> draft + score
POST /api/queue            {draft_id}             -> 409 if verdict=hold
POST /api/decision         {id, decision}         -> approved | rejected
```

State lives in `panel/data/panel.db` (SQLite, gitignored). Tables: `drafts`,
`queue`, `audit`. Every mutation writes an `audit` row — `audit()` is called
inside each handler, so the log is not optional.

---

## What this is not

- Not a scheduler. Nothing runs on a timer.
- Not connected to any platform. There is no publish path, by design.
- Not multi-brand. It reads one project: `projects/crusor-ai-ide`.
- Not a replacement for MarketMeNow's adapters — it's the approval layer those
  adapters are missing.
