# Credentials Needed — Full Setup (Free as Much as Possible)

> **Short answer: to start, you need ZERO credentials and ₹0 / $0.**
> This app runs in free demo mode. Add **one free AI key** for real AI writing.
> **All social APIs are now fully integrated (v0.2)** — add platform credentials
> whenever you're ready and test them end-to-end with **TESTING.md**.
>
> 🔐 **Rules:** Never share keys in chat. Never commit `.env.local` to GitHub.
> Keys go in `.env.local` (local) or Vercel → Settings → Environment Variables.

---

## Cost Summary

| Stage | What | Cost |
|-------|------|------|
| **NOW** | Run the app (demo mode) | **$0 — no accounts, no keys** |
| **NOW** | Post content (copy-paste + free native schedulers) | **$0** |
| **Step 2** | Real AI writing (1 free key — Gemini or Groq) | **$0** |
| **Step 3** | Deploy online (Vercel Hobby + GitHub) | **$0** |
| Later | Database for multi-device sync (Supabase/Neon free) | **$0** (optional) |
| Integrated ✅ | Auto-publishing APIs (Meta, Threads, YouTube, LinkedIn, TikTok, Pinterest) | **$0** (approval-based, not paid) — add creds + test via TESTING.md |
| Later | X (Twitter) API | ⚠️ **PAID** (pay-per-use) — post manually instead = $0 |
| | **Total to run the full system** | **$0/month is possible** |

---

## 1) Needed NOW — Nothing ✅ $0

| Thing | Credential | Notes |
|-------|-----------|-------|
| This app | **None** | Demo mode generates template drafts with `[EDIT ME]` parts |
| Your data | **None** | Saved in your browser (localStorage). Export CSV/JSON backups anytime |
| Posting | Your normal social logins | Copy-paste from the app into each platform, or use free built-in schedulers: **Meta Business Suite** (Instagram/Facebook/Threads), **YouTube Studio**, **LinkedIn** native schedule, **TikTok** desktop upload |
| Analytics | Your normal social logins | Read free native analytics in each app, type numbers into the Track tab. Missing number = leave blank (`N/A`) |
| Design (carousels/pins) | Canva free account (email/Google) — optional | canva.com — free plan is enough |
| Tracker sheet (optional) | Google account | Open the exported CSV in Google Sheets, or use `templates/content-tracker.csv` |

---

## 2) For Real AI Writing — Pick ONE Free Key 🤖 $0

You need **only one** of these. Option A is recommended.

### Option A — Google Gemini (RECOMMENDED, free tier)

1. Go to **https://aistudio.google.com/apikey** and sign in with a Google account
2. Click **"Create API key"** (create/select a project — free, no billing needed for Flash models)
3. Copy the key → put it in `.env.local`:

```bash
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

- Free tier covers Gemini Flash / Flash-Lite text models; exact limits show in AI Studio for your project.
- ⚠️ On the free tier Google may use API data to improve products — don't send sensitive/private data through prompts.

### Option B — Groq (free, no credit card)

1. Go to **https://console.groq.com/keys** → sign up → **Create API Key**
2. Put it in `.env.local`:

```bash
GROQ_API_KEY=your_key_here
GROQ_MODEL=openai/gpt-oss-120b
```

- Free tier is roughly 30 requests/min and ~1,000 requests/day on main models — far more than this app needs (1 generation = 1 request).
- Note (2026): Llama models left Groq's free tier; the default above (`openai/gpt-oss-120b`) is the current free-friendly model. If it errors, pick any model marked available at console.groq.com/docs/models and set `GROQ_MODEL` to it.

### Option C — OpenRouter (free models available)

1. Go to **https://openrouter.ai/keys** → create a key
2. Pick a model whose ID ends in `:free` at openrouter.ai/models (free filter)

```bash
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

(Free model IDs change often — check the site and update `OPENROUTER_MODEL`.)

### Option D — OpenAI / Anthropic (PAID — skip for now)

```bash
OPENAI_API_KEY=          # platform.openai.com/api-keys (needs billing)
OPENAI_MODEL=gpt-4o-mini
```

Only if you later want it. The free options above are enough. You can also
just use **ChatGPT/Claude free chat + the prompts in `/prompts`** with no API at all.

**How the app picks:** `AI_PROVIDER` env if set, else first key found in this
order: Gemini → Groq → OpenRouter → OpenAI → otherwise demo mode.
Check anytime: open `/api/health` in the app (Setup tab shows it too).
After adding a key, **restart** the app (`npm run dev`) or redeploy.

---

## 3) To Deploy Online — Free 🌐 $0

| Service | Credential | Cost / Notes |
|---------|-----------|--------------|
| **GitHub** | Your GitHub account (you already have this repo) | Free |
| **Vercel** | "Continue with GitHub" login at vercel.com | Hobby plan free (personal/non-commercial use; 100 GB transfer, ~1M function calls/month) |

Steps: Vercel → **Add New → Project** → import `MarkettngTeam` repo → (optional: add your AI key under Environment Variables) → **Deploy**.
Then set `NEXT_PUBLIC_APP_URL` to your `https://…vercel.app` URL. Alternative free hosts: Netlify, Cloudflare Pages.

> ⚠️ Browser storage is per-device. A deployed site still works fully — your
> posts just live in the browser you use. Export JSON backups regularly,
> or add the optional free database below when you need multi-device sync.

---

## 4) Database — OPTIONAL, Later 🗄️ $0

**Not needed for this MVP.** Only add when you want the same data on
phone + laptop, or multiple users. Pick one:

| Option | Credentials you'll get | Free tier |
|--------|----------------------|-----------|
| **Supabase** (supabase.com) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secret!) | 500 MB DB, 1 GB files, 50k auth users; project pauses after 7 idle days |
| **Neon** (neon.tech) | `DATABASE_URL` (one connection string — treat as secret) | ~0.5–1 GB storage, 100 compute-hours/month, no card |

Sign up with GitHub/Google. Create a project → copy the values above into
`.env.local`. (Wiring the app to a DB is a future code step — ask when ready.)

---

## 5) Social Publishing APIs — FULLY INTEGRATED ✅ (Add Credentials One at a Time)

> **v0.2 update:** every publisher below is built and verified against mock APIs
> (`npm run test:integrations` — 37 checks). **Your testing playbook is TESTING.md**:
> add the env vars listed here → restart → Connections → Test Connection →
> Dry run → Publish. Each platform connects via env access token **or** the OAuth
> **Connect** button (register redirect URI `{APP_URL}/api/oauth/{provider}/callback`).

Posting manually or via free native schedulers still costs $0 and remains the
fallback for every platform. Add APIs one at a time — and only ever use
**official APIs**, never browser-automation bots. Also set `SESSION_SECRET`
(encrypts OAuth tokens) and, before any public deploy, `PUBLISH_SECRET`.

What you'll need per platform when that day comes:

### Meta — Instagram + Threads + Facebook · Free, approval-gated
- **Accounts:** Facebook account + Instagram **Business/Creator** account linked to a Facebook Page
- **Create:** Meta app at https://developers.facebook.com/apps
- **Credentials:** `META_APP_ID`, `META_APP_SECRET`, access token, `INSTAGRAM_BUSINESS_ACCOUNT_ID`, `THREADS_USER_ID`
- **Gate:** App Review (+ Business Verification to post for other people). Your own account as a tester is the fast path. Limits ≈ 100 IG posts/day, 250 Threads posts/day.
- **Free alternative now:** Meta Business Suite scheduler (business.facebook.com) — $0.

### YouTube — Free quota, OAuth
- **Accounts:** Google account + YouTube channel
- **Create:** Google Cloud project → enable **YouTube Data API v3** → OAuth client at https://console.cloud.google.com/apis/credentials
- **Credentials:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` (scope `youtube.upload`)
- **Gate:** Uploads need OAuth (an API key alone cannot upload). Default quota ≈ 100 uploads/day. Public apps need Google verification.
- **Free alternative now:** YouTube Studio → Upload → Schedule — $0.

### LinkedIn — Free, partly self-serve
- **Accounts:** LinkedIn account (+ a Company Page to verify the app)
- **Create:** App at https://www.linkedin.com/developers/apps → add product **"Share on LinkedIn"**
- **Credentials:** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN` (60-day tokens)
- **Gate:** Posting to **your own profile** (`w_member_social`) is self-serve, no review. Company Pages/analytics need the Community Management API approval.
- **Free alternative now:** LinkedIn's built-in "Schedule" — $0.

### TikTok — Free, audit for public posts
- **Accounts:** TikTok account
- **Create:** App at https://developers.tiktok.com → Content Posting API (`video.publish`)
- **Credentials:** `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_ACCESS_TOKEN`
- **Gate:** Unaudited apps can only post **privately** (SELF_ONLY, max 5 users/day). Public posting requires TikTok's audit (real website + privacy policy + demo video).
- **Free alternative now:** TikTok app / desktop upload + schedule — $0.

### X (Twitter) — ⚠️ NOT FREE (2026)
- X removed its free API tier for new developers (Feb 2026). Now **pay-per-use**: ≈ $0.015/post, $0.20 if the post contains a URL, paid reads too. New X accounts also face restrictions on links/replies until trust builds.
- **Recommendation: post to X manually — $0.** Only consider `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`, `X_BEARER_TOKEN` (+ prepaid credits at developer.x.com) if volume ever justifies paying.

### Pinterest — Free, review-gated
- **Accounts:** Pinterest business account
- **Create:** App at https://developers.pinterest.com/apps
- **Credentials:** `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, `PINTEREST_ACCESS_TOKEN`
- **Gate:** Trial access = sandbox (pins hidden, ~1,000 req/day). Standard (public) access needs a review with a demo video.
- **Free alternative now:** Post pins manually / Pinterest's own scheduler — $0.

### Reddit — Approval-gated; manual recommended
- **Accounts:** Reddit account
- **Credentials (if ever):** `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` from https://www.reddit.com/prefs/apps
- **Gate:** Since late 2025 all API access needs Reddit's approval; free tier is non-commercial (~100 queries/min), commercial use needs separate approval/contract. Reddit has also announced major API changes into 2026–27 — always re-check current policy.
- **Recommendation: always post to Reddit manually.** It fits the platform anyway (genuine participation, zero promo) — $0.

### Shortcut alternative — one approved scheduler
Instead of 7 separate APIs, one scheduling tool (Buffer, Later, Metricool, Publer, etc.) can cover many platforms through *their* approvals. Their free plans are limited and change often — check current limits before relying on one. Credential = that tool's account/API token. **Native schedulers remain the guaranteed-free path.**

---

## 6) Accounts Checklist (tick as you go)

**Now ($0):**
- [ ] Nothing! Run: `npm install` → `npm run dev` → open http://localhost:3000
- [ ] (Optional) Canva free account for carousel/pin designs
- [ ] Your existing social accounts (only the platforms you really use)

**Step 2 — real AI ($0, ~2 min):**
- [ ] ONE free key: Gemini (`GEMINI_API_KEY`) **or** Groq (`GROQ_API_KEY`)
- [ ] Paste into `.env.local`, restart app, confirm "AI MODE" badge

**Step 3 — online ($0):**
- [ ] Vercel account (GitHub login) → deploy repo → add same key in Vercel env vars

**Full integration testing (see TESTING.md):**
- [ ] `SESSION_SECRET` set in `.env.local`
- [ ] One platform at a time: creds → Test Connection → Dry run → Publish 1 post → Fetch metrics
- [ ] Recommended order: LinkedIn → Threads → Instagram → YouTube → Pinterest → TikTok → X (paid!) → Reddit (pre-approved apps only)
- [ ] (Optional later) Supabase **or** Neon free project for multi-device sync

---

## 7) Security — Keep It Simple & Safe

1. Keys live only in `.env.local` (already in `.gitignore`) or Vercel env vars.
2. Never paste keys into chat, screenshots, GitHub issues, or code.
3. If a key leaks: delete/regenerate it in that provider's console immediately.
4. Social tokens expire (Meta/LinkedIn ≈ 60 days) — a `FAILED` post usually just means "reconnect the account," never auto-retry silently.
5. One platform, one app, one key — don't reuse secrets across projects.

---

*Prices/approvals change often (checked Oct 2026). Always confirm on the
platform's own developer page before building around an API.*
