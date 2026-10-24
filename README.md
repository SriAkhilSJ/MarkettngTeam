# MarkettngTeam

Marketing system for **Crusor AI IDE** — an AI-native desktop IDE
([crusor.in](https://www.crusor.in)).

Two parts:

| Path | What it is |
|---|---|
| `projects/crusor-ai-ide/` | The MarketMeNow project, built against the real schema — 10-phase onboarding output, validated |
| `panel/` | A locked-surface control console: draft → voice gate → approval queue. Nothing publishes itself |

```bash
python3 panel/server.py          # → http://localhost:8000
python3 tools/validate_crusor.py # → schema check
```

- **`ONBOARDING-MAP.md`** — how each MarketMeNow phase maps to these files, what
  Phase 8/9/10 actually are, and the four bugs found in MarketMeNow
- **`panel/README.md`** — the permission surface and why publishing is absent, not disabled
- `tools/build_crusor_project.py` — regenerate the project config
- `tools/validate_crusor.py` — validate against MarketMeNow's own pydantic models
