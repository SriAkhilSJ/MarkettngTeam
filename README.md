# MarkettngTeam — AUTO 🤖

**One idea in. Every platform out.**

Give one idea → get a full week of ready-to-review social content for
Instagram, TikTok, YouTube Shorts, LinkedIn, X, Threads, Pinterest & Reddit.
Built from the "AUTO — Build an AI That Runs All Your Socials" system.

`IDEA → WRITE → ADAPT → CAPTIONS → APPROVE (you) → SCHEDULE → POST → TRACK → IMPROVE`

---

## 💸 Cost: $0 to start

- **No credentials needed** — the app runs in free **demo mode** out of the box.
- Add **one free AI key** (Gemini or Groq) for real AI writing → still $0.
- Posting = copy-paste + free native schedulers (Meta Business Suite, YouTube Studio…) → $0.
- Full list of every account/key, free first: **[CREDENTIALS.md](./CREDENTIALS.md)**

## 🚀 Quick start

```bash
npm install
npm run dev        # → http://localhost:3000
```

1. **Create tab** — enter Topic / Audience / Goal / CTA, tick platforms, Generate.
2. **🔌 Connections tab** — connect platforms (env tokens or OAuth), Test Connection per platform.
3. **Review & Publish tab** — edit, add Media URLs, APPROVE, **🧪 Dry run → 🚀 Publish via API** (PUBLISHED only on real platform confirmation; copy-paste remains as free fallback).
4. **Week Plan tab** — your Mon–Fri calendar (weekend off).
5. **Track & Learn tab** — **📊 Fetch real metrics** from the APIs or type them in (blank = N/A, never guessed), export CSV tracker.

**Testing the integrations with your own credentials: [TESTING.md](./TESTING.md)**
Verify everything offline first: `npm run build && npm run test:integrations` (mock APIs, 37 checks).

Your work auto-saves in your browser. Use **Backup JSON / CSV** buttons to keep copies.

## 🤖 Turn on real AI (free, 2 minutes)

```bash
cp .env.example .env.local
# add ONE of:
# GEMINI_API_KEY=...   → https://aistudio.google.com/apikey
# GROQ_API_KEY=...     → https://console.groq.com/keys
npm run dev            # restart — badge switches to AI MODE
```

Never commit `.env.local`. Details + all later/optional keys: [CREDENTIALS.md](./CREDENTIALS.md)

## 🌐 Deploy free

Vercel (Hobby): vercel.com → Add New Project → import this repo → Deploy.
Add the same AI key under Project → Settings → Environment Variables. No database needed.

## 📁 What's in here

| Path | What |
|------|------|
| `PLAN.md` | The simple full plan from the PDF |
| `CREDENTIALS.md` | Every credential needed, free-first, step by step |
| `TESTING.md` | **Your end-to-end test playbook** — add creds → test → dry-run → publish, per platform + troubleshooting |
| `scripts/` | Mock social APIs + `test:integrations` harness (proves wiring with zero real credentials) |
| `app/` | Next.js app (UI + `/api/generate`, `/api/health`) |
| `lib/` | AI providers (Gemini/Groq/OpenRouter/OpenAI/demo), platform rules, prompts, analytics |
| `lib/social/` | **Full publishing integrations**: Meta/Instagram, Threads, YouTube, LinkedIn, TikTok, X, Pinterest, Reddit — publishers, OAuth connect, metrics, encrypted token cookie |
| `prompts/` | The 6 copy-paste prompts from the PDF (use free in ChatGPT/Claude) |
| `templates/` | Content tracker CSV for Google Sheets/Notion |

## 📏 House rules (from the system)

- ✅ **Human approval always** — nothing auto-posts without you reading it.
- ✅ Different hook per platform. Never copy-paste the same post everywhere.
- ✅ Real numbers only. Missing metric = `N/A`. Never invent stats.
- ✅ Official APIs / approved tools only — never browser-automation bots.
- ❌ X API is paid in 2026 → post to X manually (free). Reddit → manual too.

## 🗺️ Roadmap

- [x] **Phase 1** — Prompts + tracker template (run manually, $0)
- [x] **Phase 2** — MVP app: idea → master → platform versions → captions
- [x] **Phase 3** — Approval board + week plan + statuses
- [x] **Phase 5** — Analytics: local analysis + **real metric fetching from platform APIs**, CSV export
- [x] **Phase 4** — Publishing via official APIs for all 9 formats + OAuth Connect + connection tests (verified vs mock APIs; your turn: TESTING.md)
- [ ] Optional — Free DB sync (Supabase/Neon) for multi-device use

---

*AI writes your posts. Replying to comments and being human is still your job — that's the part that builds an audience.*
