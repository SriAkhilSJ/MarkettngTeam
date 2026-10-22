# TESTING.md — Your End-to-End Credential Test Guide

**Everything is integrated.** Your only job: add credentials **one platform at
a time**, run **Test Connection**, do a **Dry run**, publish **one** real post,
open the live link. Repeat per platform.

> 🔐 Never paste keys into chat/GitHub. Keys go only in `.env.local`
> (local) or Vercel → Settings → Environment Variables.
> After editing `.env.local`, **restart** `npm run dev` (env is read at boot).

---

## 0) Before you start (5 minutes)

```bash
npm install
cp .env.example .env.local
# generate your token-encryption secret and paste it as SESSION_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run dev        # http://localhost:3000
```

Then in `.env.local` set:
- `NEXT_PUBLIC_APP_URL=http://localhost:3000` (or your deployed URL later)
- `SESSION_SECRET=<the generated hex>`
- Optional: `PUBLISH_SECRET=<any password>` — the app will ask for it once before Publish/Test calls. **Recommended before any public deploy.**
- Optional: one AI key (`GEMINI_API_KEY` free — see CREDENTIALS.md §2) so generated posts are real AI copy. Demo mode is fine for connection testing.

### ✅ Sanity check BEFORE any real credentials (already passing)

```bash
npm run build
npm run test:integrations            # 37 checks: all publishers vs mock APIs
npm run test:integrations:noauth     # 7 checks: nothing-configured behavior
```

This proves the wiring (payloads, container polling, thread chaining,
OAuth1 signing, uploads, metrics mapping, approval gate) without touching
any real account. If these ever fail, fix that before blaming a platform.

---

## 1) The universal test loop (same for every platform)

1. **Add credentials** (per-platform sections below) → restart dev server.
2. Open **🔌 Connections** tab → your platform should say *✅ Configured*.
   - or click **Connect** (OAuth) if you added the app id/secret instead of a token.
3. Click **🔍 Test Connection** → expect green + your account name.
   Red = read the error; it is the platform's real response (see Troubleshooting).
4. **Create** tab → generate a week (or reuse existing posts).
5. **Review & Publish** tab → on that platform's post:
   edit text → add **Media URLs** if the platform needs media → set status **APPROVED**.
6. Click **🧪 Dry run** → expect "Dry run OK". Nothing posts.
7. Click **🚀 Publish via API** → confirm → expect *Published ✅* + a **live link**.
   Open the link. If anything failed, status becomes **FAILED** with the real
   platform error — the app never fakes `PUBLISHED`.
8. Click **📊 Fetch real metrics** → numbers land in **Track & Learn**
   (metrics a platform doesn't expose stay `N/A` — by design).

### OAuth redirect URIs — paste these EXACTLY into each platform app

| Platform | Register this redirect URI |
|----------|---------------------------|
| Meta (Instagram) | `http://localhost:3000/api/oauth/meta/callback` |
| Threads | `http://localhost:3000/api/oauth/threads/callback` |
| Google (YouTube) | `http://localhost:3000/api/oauth/google/callback` |
| LinkedIn | `http://localhost:3000/api/oauth/linkedin/callback` |
| TikTok | `http://localhost:3000/api/oauth/tiktok/callback` |
| X | `http://localhost:3000/api/oauth/x/callback` |
| Pinterest | `http://localhost:3000/api/oauth/pinterest/callback` |
| Reddit | `http://localhost:3000/api/oauth/reddit/callback` |

(Deployed? Replace `http://localhost:3000` with your app URL and set
`NEXT_PUBLIC_APP_URL` to match. You can register both localhost + prod URIs.)
The Connections tab also shows each URI with a Copy button.

### Media URLs (Instagram/TikTok/YouTube/Pinterest need files)

Platforms fetch media from a **public direct file URL** (ending `.jpg`/`.mp4`).
Free ways to host a test file: Cloudinary free, Cloudflare R2, a public
Supabase Storage bucket, GitHub raw (small files), or your own site/CDN.
- Instagram carousel: JPGs, aspect 4:5–1.91:1. Reel: MP4/MOV vertical.
- TikTok/YouTube: vertical MP4. YouTube needs ≤3 min for Shorts.
- Do NOT use Google Drive "share" links (not direct files).

### Safe defaults for your first real tests
- **YouTube** publishes **private** (`YOUTUBE_PRIVACY=private`). Flip to `public` later.
- **TikTok** publishes **SELF_ONLY** (only you can see it) until your app passes audit.
- Everything else posts **public/live immediately** — use test wording you're happy to delete.

**Suggested order:** LinkedIn → Threads → Instagram → YouTube → Pinterest → TikTok → X (paid!) → Reddit (approval-gated).

---

## 2) LinkedIn — start here (free, self-serve)

1. https://www.linkedin.com/developers/apps → Create app (associate any Page; create a free Company Page if asked).
2. **Products** tab → add **"Sign In with LinkedIn using OpenID Connect"** and **"Share on LinkedIn"**.
3. **Auth** tab → add the LinkedIn redirect URI (table above). Copy Client ID/Secret.
4. In `.env.local`: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` → restart → **Connect (LinkedIn)** in the app.
   - *Token alternative:* LinkedIn's Token Generator (in the app Auth tab, scope `w_member_social`) → `LINKEDIN_ACCESS_TOKEN`.
5. Test Connection → expect your name. Publish a text post (no media needed; add 1 image URL to also test image upload).
- Notes: posts to **your profile**. Company Page posting needs Community Management API approval; then set `LINKEDIN_AUTHOR_URN=urn:li:organization:{id}`. Tokens expire ~60 days — reconnect when tests start returning 401.

## 3) Threads (free, Meta App Review for real accounts)

1. Meta app (developers.facebook.com) → add the **Threads** use case → **Settings** gives you the **Threads App ID/Secret** (different from the Meta app id!). Add the Threads redirect URI.
2. Add your Threads account as a **Tester** (Roles → Threads Testers) and accept the invite in Threads (Settings → Account → Website permissions… follow Meta's current flow) — testers bypass full review.
3. `.env.local`: `THREADS_APP_ID`, `THREADS_APP_SECRET` → **Connect (Threads)**. Scopes used: `threads_basic, threads_content_publish, threads_manage_insights`.
4. Test → publish a **text-only** post (no media needed). Then try 1 image URL.

## 4) Instagram Carousel + Reel (free, Meta App Review/testers)

1. Prereqs: Instagram **Business/Creator** account linked to a **Facebook Page**.
2. Meta app → add **Instagram** product → permissions `instagram_basic` + `instagram_content_publish` (+ `pages_show_list`, `pages_read_engagement`). Add your account as tester/developer role while the app is in Development mode.
3. Fastest first test (no OAuth): developers.facebook.com/tools/explorer → pick your app → add the permissions above → **Generate Access Token**. Find your IG user id: `GET /me/accounts?fields=instagram_business_account{id,username}` in the Explorer (the app's Test Connection also discovers and prints it).
4. `.env.local`: `META_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`, plus `META_APP_ID`/`META_APP_SECRET` (enables Connect + long-lived exchange).
5. Test Connection (both Carousel and Reel rows share the Meta connection) → publish:
   - Carousel: 2+ public JPG URLs (or 1 JPG = single image post).
   - Reel: 1 public MP4 URL (the app polls processing, then publishes; can take ~30s+).

## 5) YouTube Shorts (free quota, OAuth)

1. Google Cloud Console → new project → **Enable "YouTube Data API v3"** → Credentials → OAuth client (Web) → add the Google redirect URI. Configure the OAuth consent screen (External; add yourself as test user).
2. Easiest path: put `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env.local` → use **Connect (Google)** — it requests `youtube.upload` + `youtube.readonly` with offline access (refresh token).
   - *Alternative:* OAuth Playground (developers.google.com/oauthplayground) with your own client creds → get a refresh token → `YOUTUBE_REFRESH_TOKEN`.
3. Test Connection → expect your channel name (you need a YouTube channel on that Google account).
4. Publish a Short: public **video URL** required (server downloads + resumable-uploads it, max 100 MB default). First uploads from **unverified projects are locked private** by Google — that's expected; verify the app in Google Cloud to go public, then set `YOUTUBE_PRIVACY=public`.

## 6) Pinterest (free; Trial = sandbox)

1. https://developers.pinterest.com/apps → create app → request **Trial** access → add the Pinterest redirect URI. Generate a token with scopes `boards:read,boards:write,pins:read,pins:write,user_accounts:read`.
2. While on Trial: set `PINTEREST_ENV=sandbox` in `.env.local` (pins are created in the sandbox and **hidden** — perfect for testing).
3. `PINTEREST_ACCESS_TOKEN` (or app id/secret + **Connect**). Board: leave blank to use your first board, or set `PINTEREST_BOARD_ID` / per-post Board ID.
4. Publish with 1 public image URL + optional destination **Link URL**. For real public pins, upgrade the app to **Standard** access and remove `PINTEREST_ENV`.

## 7) TikTok (free; public needs audit)

1. https://developers.tiktok.com → create app → add **Content Posting API** + **Login Kit** → scopes `user.info.basic, video.publish, video.upload, video.list`. Add the TikTok redirect URI.
2. Use the app's **sandbox/test user** if offered, or your own account. `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` → **Connect (TikTok)** (or set `TIKTOK_ACCESS_TOKEN` from their tools).
3. First publish: recorded **video URL** (default `FILE_UPLOAD`: server downloads and re-uploads). Expect **SELF_ONLY** (private) and a possible *processing* state — the app stores the `publish_id`; Fetch metrics resolves it once TikTok finishes. Max ~5 users/day while unaudited.
4. Going public later = pass TikTok's **app audit** (real website, privacy policy, demo video), then set `TIKTOK_PRIVACY_LEVEL=PUBLIC_TO_EVERYONE`.

## 8) X / Twitter — ⚠️ PAID. Read before testing.

- X's API is **pay-per-use** (per post/read) and needs prepaid credits at developer.x.com. Every Test/Publish/Metrics call below can cost money. Manual posting stays free and recommended.
- If you still test: developer.x.com → App → **User authentication settings**: Read+Write, add the X redirect URI (OAuth 2.0) → Keys: API Key/Secret + generate Access Token/Secret (**after** setting Read+Write, or tokens are read-only).
- `.env.local`: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` (or Connect via `X_CLIENT_ID`/`X_CLIENT_SECRET`). Generated X content posts as a **thread** by default (`X_PUBLISH_MODE=single` for one tweet). Images optional; X **videos via API are not attempted** — post those manually.

## 9) Reddit — approval-gated (manual is the sane default)

- Since late 2025 Reddit requires explicit approval for API apps (Responsible Builder Policy); self-service app creation was closed for most accounts. **If you don't already have approved credentials, skip this — post manually.**
- If you do: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` + one of `REDDIT_REFRESH_TOKEN` (Connect flow) or `REDDIT_USERNAME`+`REDDIT_PASSWORD` (script-type apps only). Set `REDDIT_USER_AGENT` with your real username. Subreddit goes **per post** — only subs where you actually participate; some require flair (the API error will say so; add flair manually on Reddit).

---

## 10) Troubleshooting (match the error)

| Symptom | Likely cause → fix |
|---|---|
| Connections says *Not configured* after editing `.env.local` | Server not restarted → restart `npm run dev` / redeploy |
| OAuth lands back with *state check failed* | Took >10 min, different browser, or cookies blocked → click Connect again, same browser |
| OAuth error at the platform: *redirect_uri mismatch* | Registered URI ≠ app URI → copy the exact URI from the Connections tab; check `NEXT_PUBLIC_APP_URL` |
| Test Connection **401** | Token expired/revoked (Meta/LinkedIn ≈60 days) → reconnect or mint a fresh token |
| Test/publish **403** mentions scope/permission/review | Missing scope or app still in Dev mode without tester role → add scope, add yourself as tester, or submit App Review |
| Instagram: *media container / URL* errors | Media URL not public, not a direct file, wrong aspect/format (JPG for feed; MP4/MOV reel) → open the URL in a private window to prove it loads |
| YouTube upload lands **private** | Unverified Google project or `YOUTUBE_PRIVACY=private` (default) → verify app + set `public` when ready |
| YouTube **403 quota** | Daily upload bucket hit (~100/project/day default) → wait for Pacific-midnight reset |
| TikTok *privacy_level_option_mismatch* / private posts | Unaudited app → `SELF_ONLY` is required; pass audit for public |
| TikTok stuck "processing" | Normal for a bit → use Fetch metrics later; it resolves the `publish_id` |
| LinkedIn **401/426** version errors | Old token (reconnect) or stale `LINKEDIN_API_VERSION` → clear override (app auto-picks a recent YYYYMM) |
| X **402/403** | No API credits, or tokens minted before Read+Write was enabled → add credits, regenerate tokens |
| Pinterest pin invisible | You're in Trial/sandbox (`PINTEREST_ENV=sandbox`) → expected; Standard access for public pins |
| Reddit refuses / errors list mentions flair or `USER_REQUIRED` | Sub flair/karma rules or unapproved app → post manually in that sub |
| App prompts for a secret on Publish | `PUBLISH_SECRET` is set → type the same value (kept only in this tab's session) |
| Works on localhost, breaks after deploy | Env vars + redirect URIs not updated on Vercel → set both, redeploy |

## 11) Before deploying publicly — checklist

- [ ] `SESSION_SECRET` set (fresh random 32+ chars)
- [ ] `PUBLISH_SECRET` set
- [ ] `NEXT_PUBLIC_APP_URL` = your deployed URL; redirect URIs re-registered
- [ ] Same env tokens in Vercel → test one platform end-to-end in production
- [ ] `YOUTUBE_PRIVACY` / `TIKTOK_PRIVACY_LEVEL` flipped only when you mean public
- [ ] `ALLOW_PRIVATE_MEDIA_URLS` is NOT set in production
- [ ] `.env.local` never committed (it's in `.gitignore`)

## 12) Honest limits (by design, same as PLAN.md)

- Posting runs **when you click Publish** (or Publish all approved). There is no server cron, because posts live in your browser — approve in the morning, publish when ready, or keep using free native schedulers for timed posts.
- Nothing auto-retries. `FAILED` means: read the error, fix it, publish again. Check the platform first to avoid duplicates (threads especially: an error mid-thread can leave earlier tweets live — the app warns you).
- Metrics are best-effort per platform API; anything not exposed stays `N/A`. Native analytics + manual entry always works.
- Recording video/designing visuals and replying to comments remain yours. That's the part that builds the audience anyway.
