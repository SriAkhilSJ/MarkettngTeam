#!/usr/bin/env node
/**
 * End-to-end integration tests against MOCK platform APIs (no real credentials,
 * no real posts, no network beyond localhost).
 *
 *   npm run build && npm run test:integrations          # full mock suite
 *   npm run build && npm run test:integrations -- --noauth   # "nothing configured" behavior
 *
 * Boots: mock-social-server (MOCK_PORT=4010) + `next start` (APP_PORT=3100)
 * with fake credentials whose API bases point at the mock. Kills both after.
 */
import { spawn } from "child_process";
import { existsSync } from "fs";

const NOAUTH = process.argv.includes("--noauth");
const APP_PORT = Number(process.env.APP_PORT || 3100);
const MOCK_PORT = Number(process.env.MOCK_PORT || 4010);
const APP = `http://127.0.0.1:${APP_PORT}`;
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;

if (!existsSync(".next/BUILD_ID")) {
  console.error("❌ No production build found. Run: npm run build");
  process.exit(2);
}

const results = [];
function check(name, cond, detail = "") {
  results.push({ name, ok: Boolean(cond), detail: String(detail).slice(0, 400) });
  console.log(`${cond ? "✅" : "❌"} ${name}${cond ? "" : ` — ${String(detail).slice(0, 300)}`}`);
}

const CRED_ENV = {
  SESSION_SECRET: "test-session-secret-0123456789abcdef0123456789",
  AI_PROVIDER: "demo",
  SOCIAL_POLL_INTERVAL_MS: "10",
  SOCIAL_POLL_ATTEMPTS: "3",
  ALLOW_PRIVATE_MEDIA_URLS: "1",
  NEXT_PUBLIC_APP_URL: APP,
  // Meta / Threads
  META_APP_ID: "test_meta_app", META_APP_SECRET: "test_meta_secret",
  META_ACCESS_TOKEN: "test_meta_token", INSTAGRAM_BUSINESS_ACCOUNT_ID: "ig123",
  META_GRAPH_BASE: `${MOCK}/meta`, META_GRAPH_VERSION: "v-test",
  THREADS_APP_ID: "test_threads_app", THREADS_APP_SECRET: "test_threads_secret",
  THREADS_ACCESS_TOKEN: "test_threads_token", THREADS_USER_ID: "tuser123",
  THREADS_GRAPH_BASE: `${MOCK}/threads/v1.0`,
  // Google / YouTube
  GOOGLE_CLIENT_ID: "test_google_client", GOOGLE_CLIENT_SECRET: "test_google_secret",
  YOUTUBE_REFRESH_TOKEN: "test_yt_refresh",
  YOUTUBE_API_BASE: `${MOCK}/youtube`, GOOGLE_TOKEN_URL: `${MOCK}/google/token`,
  // LinkedIn
  LINKEDIN_CLIENT_ID: "test_li_client", LINKEDIN_CLIENT_SECRET: "test_li_secret",
  LINKEDIN_ACCESS_TOKEN: "test_li_token",
  LINKEDIN_API_BASE: `${MOCK}/linkedin`, LINKEDIN_TOKEN_URL: `${MOCK}/linkedin/oauth/token`,
  // TikTok
  TIKTOK_CLIENT_KEY: "test_tt_key", TIKTOK_CLIENT_SECRET: "test_tt_secret",
  TIKTOK_ACCESS_TOKEN: "test_tt_token", TIKTOK_API_BASE: `${MOCK}/tiktok`,
  // X (mock verifies the OAuth1 signature with these exact secrets)
  X_API_KEY: "test_x_api_key", X_API_SECRET: "test_x_api_secret",
  X_ACCESS_TOKEN: "test_x_access_token", X_ACCESS_TOKEN_SECRET: "test_x_access_secret",
  X_CLIENT_ID: "test_x_client", X_CLIENT_SECRET: "test_x_client_secret",
  X_API_BASE: `${MOCK}/x`, X_UPLOAD_BASE: `${MOCK}/xupload/1.1`, X_TOKEN_URL: `${MOCK}/x/2/oauth2/token`,
  // Pinterest
  PINTEREST_APP_ID: "test_pin_app", PINTEREST_APP_SECRET: "test_pin_secret",
  PINTEREST_ACCESS_TOKEN: "test_pin_token", PINTEREST_API_BASE: `${MOCK}/pinterest`,
  // Reddit
  REDDIT_CLIENT_ID: "test_reddit_client", REDDIT_CLIENT_SECRET: "test_reddit_secret",
  REDDIT_REFRESH_TOKEN: "test_reddit_refresh",
  REDDIT_API_BASE: `${MOCK}/reddit`, REDDIT_OAUTH_BASE: `${MOCK}/redditoauth`,
  REDDIT_USER_AGENT: "web:auto-marketing-team:v0.2.0 (by /u/tester)",
};

function cleanEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^(META_|THREADS_|GOOGLE_|YOUTUBE_|LINKEDIN_|TIKTOK_|X_|PINTEREST_|REDDIT_|GEMINI|GROQ|OPENAI|OPENROUTER|SESSION_SECRET|PUBLISH_SECRET)/.test(k)) continue;
    env[k] = v;
  }
  return { ...env, ...extra };
}

const children = [];
function boot(cmd, args, env, label) {
  const child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  child.stdout.on("data", (d) => process.env.VERBOSE && process.stdout.write(`[${label}] ${d}`));
  child.stderr.on("data", (d) => process.env.VERBOSE && process.stderr.write(`[${label}] ${d}`));
  return child;
}

async function waitFor(url, label, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} did not come up: ${url}`);
}

async function api(path, { method = "GET", body, headers = {}, redirect = "follow" } = {}) {
  const res = await fetch(`${APP}${path}`, {
    method, redirect,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

const media = {
  img1: `${MOCK}/media/test.jpg`,
  img2: `${MOCK}/media/test.jpg?x=2`,
  video: `${MOCK}/media/test.mp4`,
};

function samplePosts() {
  const base = {
    caption: "Mock caption — integration test, not a real post.",
    hashtags: ["#test", "#AUTO"],
    scheduledDay: "Monday", scheduledTime: "09:00",
    publishMode: "api", status: "APPROVED",
  };
  return [
    { ...base, id: "t-ig-carousel", platformId: "instagram-carousel", platformName: "Instagram Carousel", format: "Carousel", hook: "Mock carousel hook", content: "Slide text…", mediaUrls: [media.img1, media.img2] },
    { ...base, id: "t-ig-reel", platformId: "instagram-reel", platformName: "Instagram Reel", format: "Reel", hook: "Mock reel hook", content: "Reel script…", mediaUrls: [media.video] },
    { ...base, id: "t-threads", platformId: "threads", platformName: "Threads", format: "Text", hook: "Mock threads hook", content: "A short opinion for Threads. What do you think?", caption: "" },
    { ...base, id: "t-yt", platformId: "youtube-shorts", platformName: "YouTube Shorts", format: "Short", hook: "Mock short title", content: "Short script…", mediaUrls: [media.video] },
    { ...base, id: "t-li", platformId: "linkedin", platformName: "LinkedIn", format: "Post", hook: "Mock LinkedIn hook", content: "A story-led LinkedIn post for the mock test.", caption: "", mediaUrls: [media.img1] },
    { ...base, id: "t-tt", platformId: "tiktok", platformName: "TikTok", format: "Video", hook: "Mock TikTok hook", content: "TikTok script…", mediaUrls: [media.video] },
    { ...base, id: "t-x", platformId: "x", platformName: "X", format: "Thread", hook: "Mock X hook", caption: "", content: "SINGLE POST:\nMock single tweet.\n\nTHREAD:\n1/ First mock tweet in the thread.\n2/ Second mock tweet in the thread.\n3/ Third mock tweet. Done.", mediaUrls: [media.img1] },
    { ...base, id: "t-pin", platformId: "pinterest", platformName: "Pinterest", format: "Pin", hook: "Mock Pin Title Keywords", content: "Pin concept…", mediaUrls: [media.img1], linkUrl: "https://example.com/post" },
    { ...base, id: "t-reddit", platformId: "reddit", platformName: "Reddit", format: "Discussion", hook: "What actually worked for me (mock)", content: "Genuinely useful mock discussion. What did you cut from your process?", caption: "", subreddit: "test" },
  ];
}

async function run() {
  console.log(`\n🧪 Integration tests (${NOAUTH ? "NOAUTH mode — nothing configured" : "MOCK mode — fake creds, mock APIs"})\n`);
  boot(process.execPath, ["scripts/mock-social-server.mjs"], cleanEnv({ MOCK_PORT: String(MOCK_PORT), X_API_SECRET: CRED_ENV.X_API_SECRET, X_ACCESS_TOKEN_SECRET: CRED_ENV.X_ACCESS_TOKEN_SECRET }), "mock");
  await waitFor(`${MOCK}/__requests`, "mock server");

  const appEnv = NOAUTH ? cleanEnv({ AI_PROVIDER: "demo", NEXT_PUBLIC_APP_URL: APP }) : cleanEnv(CRED_ENV);
  boot(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(APP_PORT), "-H", "127.0.0.1"], appEnv, "app");
  await waitFor(`${APP}/api/health`, "next app");

  const { data: health } = await api("/api/health");
  check("health responds", health.ok === true, JSON.stringify(health));

  const { data: integ } = await api("/api/integrations");
  const list = integ.integrations || [];
  check("integrations lists 9 platforms", list.length === 9, `got ${list.length}`);

  if (NOAUTH) {
    check("noauth: nothing configured", list.every((i) => !i.configured), JSON.stringify(list.map((i) => [i.platformId, i.configured])));
    check("noauth: missing names are shown (no secret values)", list.every((i) => i.missing.length > 0));

    const post = samplePosts().find((p) => p.platformId === "linkedin");
    const { data: testRes } = await api("/api/integrations/test", { method: "POST", body: { platformId: "linkedin" } });
    check("noauth: test-connection reports not configured (no network fake)", testRes.result?.ok === false && testRes.result?.configured === false, JSON.stringify(testRes.result));

    const { data: pub } = await api("/api/publish", { method: "POST", body: { post } });
    check("noauth: publish returns not_configured (never PUBLISHED)", pub.result?.state === "not_configured" && !pub.postPatch?.status, JSON.stringify(pub.result));

    const { res: rej } = await api("/api/publish", { method: "POST", body: { post: { ...post, status: "DRAFT" } } });
    check("noauth: unapproved post is rejected (human approval gate)", rej.status === 400, `status ${rej.status}`);
    return;
  }

  check("mock: all 9 configured", list.every((i) => i.configured), JSON.stringify(list.filter((i) => !i.configured).map((i) => [i.platformId, i.missing])));

  // Connection tests
  for (const p of samplePosts()) {
    const { data } = await api("/api/integrations/test", { method: "POST", body: { platformId: p.platformId } });
    check(`test-connection: ${p.platformId}`, data.result?.ok === true, JSON.stringify(data.result));
  }

  // Approval gate + dry run must not post
  const { res: gateRes } = await api("/api/publish", { method: "POST", body: { post: { ...samplePosts()[4], status: "DRAFT" } } });
  check("publish blocks DRAFT (human approval gate)", gateRes.status === 400, `status ${gateRes.status}`);

  const before = await (await fetch(`${MOCK}/__requests`)).json();
  const xBefore = before.requests.filter((r) => r.method === "POST" && r.path === "/x/2/tweets").length;
  const xPost = samplePosts().find((p) => p.platformId === "x");
  const { data: dry } = await api("/api/publish", { method: "POST", body: { post: { ...xPost, status: "DRAFT" }, dryRun: true } });
  const afterDry = await (await fetch(`${MOCK}/__requests`)).json();
  const xAfterDry = afterDry.requests.filter((r) => r.method === "POST" && r.path === "/x/2/tweets").length;
  check("dry run: ok + posts nothing", dry.result?.state === "dry_run" && xAfterDry === xBefore, JSON.stringify(dry.result));

  // Real (mock) publishes + metrics per platform
  for (const post of samplePosts()) {
    const { data } = await api("/api/publish", { method: "POST", body: { post } });
    const r = data.result || {};
    check(`publish: ${post.platformId}`, r.ok === true && r.state === "published" && Boolean(r.platformPostId) && data.postPatch?.status === "PUBLISHED", JSON.stringify(r));

    const publishedPost = { ...post, externalId: r.platformPostId };
    const { data: m } = await api("/api/metrics", { method: "POST", body: { post: publishedPost } });
    const metrics = m.result?.metrics || {};
    const hasNumber = Object.values(metrics).some((v) => typeof v === "number");
    check(`metrics: ${post.platformId}`, m.result?.ok === true && hasNumber, JSON.stringify(m.result));
  }

  // X thread = 3 tweets chained
  const log = await (await fetch(`${MOCK}/__requests`)).json();
  const tweets = log.requests.filter((r) => r.method === "POST" && r.path === "/x/2/tweets");
  check("x: thread posted as 3 chained tweets (signed OAuth1 verified by mock)", tweets.length === 3, `got ${tweets.length}`);
  const liPost = log.requests.find((r) => r.method === "POST" && r.path === "/linkedin/rest/posts");
  check("linkedin: Linkedin-Version header sent", /^\d{6}$/.test(String(liPost?.linkedinVersion || "")), JSON.stringify(liPost));

  // OAuth flow: start -> callback (LinkedIn against mock token + userinfo)
  const startRes = await fetch(`${APP}/api/oauth/linkedin/start`, { redirect: "manual" });
  const loc = startRes.headers.get("location") || "";
  const cookies = typeof startRes.headers.getSetCookie === "function" ? startRes.headers.getSetCookie() : [startRes.headers.get("set-cookie") || ""];
  check("oauth start: redirects to LinkedIn with state + redirect_uri", loc.startsWith("https://www.linkedin.com/oauth/v2/authorization") && loc.includes("redirect_uri=") && loc.includes("state="), loc);
  const state = new URL(loc).searchParams.get("state");
  const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
  const cbRes = await fetch(`${APP}/api/oauth/linkedin/callback?code=mock_code&state=${encodeURIComponent(state || "")}`, { redirect: "manual", headers: { Cookie: cookieHeader } });
  const cbLoc = cbRes.headers.get("location") || "";
  check("oauth callback: code exchanged + token stored (connected=linkedin)", cbLoc.includes("connected=linkedin"), cbLoc);

  // Bad state must be rejected
  const badRes = await fetch(`${APP}/api/oauth/linkedin/callback?code=x&state=wrong`, { redirect: "manual" });
  check("oauth callback: bad state rejected", (badRes.headers.get("location") || "").includes("oauthError="), badRes.headers.get("location") || "");
}

run()
  .catch((err) => { console.error("💥", err); results.push({ name: "harness", ok: false, detail: String(err) }); })
  .finally(() => {
    for (const c of children) { try { c.kill("SIGTERM"); } catch { /* already dead */ } }
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${failed.length === 0 ? "🎉 ALL PASSED" : `⚠ ${failed.length} FAILED`} — ${results.filter((r) => r.ok).length}/${results.length} checks passed`);
    process.exit(failed.length === 0 ? 0 : 1);
  });
