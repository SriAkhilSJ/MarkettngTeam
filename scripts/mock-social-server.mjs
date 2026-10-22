#!/usr/bin/env node
/**
 * Mock of the 8 official social APIs, for offline verification ONLY.
 * It mimics the request/response shapes our publishers use and records
 * requests at GET /__requests. It also verifies X OAuth 1.0a signatures
 * (with the fake test secrets) so the signer is genuinely exercised.
 *
 * Run via: npm run test:integrations   (or: node scripts/mock-social-server.mjs)
 */
import { createServer } from "http";
import { createHmac } from "crypto";

const PORT = Number(process.env.MOCK_PORT || 4010);
const HOST = "127.0.0.1";
const origin = `http://${HOST}:${PORT}`;
const requests = [];
let n = 0;
const id = (p) => `${p}_${++n}`;

function pct(s) {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function verifyOAuth1(req, fullUrl) {
  // Fake test secrets (scripts/test-integrations.mjs passes the same values).
  const consumerSecret = process.env.X_API_SECRET || "test_x_api_secret";
  const tokenSecret = process.env.X_ACCESS_TOKEN_SECRET || "test_x_access_secret";
  const header = req.headers.authorization || "";
  if (!header.startsWith("OAuth ")) return "missing OAuth header";
  const params = {};
  for (const part of header.slice(6).split(", ")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params[decodeURIComponent(part.slice(0, eq))] = decodeURIComponent(part.slice(eq + 1).replace(/^"|"$/g, ""));
  }
  const signature = params.oauth_signature;
  delete params.oauth_signature;
  const u = new URL(fullUrl);
  u.searchParams.forEach((v, k) => { params[k] = v; });
  const paramString = Object.keys(params).sort().map((k) => `${pct(k)}=${pct(params[k])}`).join("&");
  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`;
  const baseString = `${req.method}&${pct(baseUrl)}&${pct(paramString)}`;
  const expected = createHmac("sha1", `${pct(consumerSecret)}&${pct(tokenSecret)}`).update(baseString).digest("base64");
  return expected === signature ? null : `bad signature (expected ${expected})`;
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": Buffer.isBuffer(body) ? "application/octet-stream" : "application/json", ...headers });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const fullUrl = `${origin}${req.url}`;
  const url = new URL(fullUrl);
  const path = url.pathname;
  const bodyText = raw.toString("utf8");
  let json = {};
  try { json = JSON.parse(bodyText); } catch { /* form/binary */ }
  const formParams = new URLSearchParams(bodyText);
  requests.push({ method: req.method, path: req.url, hasAuth: Boolean(req.headers.authorization), linkedinVersion: req.headers["linkedin-version"] || null, bodyPreview: bodyText.slice(0, 400) });

  if (path === "/__requests") return send(res, 200, { requests });
  if (path === "/__reset") { requests.length = 0; return send(res, 200, { ok: true }); }
  if (path === "/media/test.jpg") return send(res, 200, Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from("fake-jpeg")]), { "Content-Type": "image/jpeg" });
  if (path === "/media/test.mp4") return send(res, 200, Buffer.concat([Buffer.from("fake"), Buffer.alloc(2048, 7)]), { "Content-Type": "video/mp4" });

  /* ---------- Meta / Instagram (root: /meta) ---------- */
  if (path.startsWith("/meta/")) {
    if (path === "/meta/oauth/access_token") return send(res, 200, { access_token: "meta_access_token", expires_in: 3600 });
    if (path === "/meta/me/accounts") return send(res, 200, { data: [{ name: "Page", instagram_business_account: { id: "ig123", username: "testig" } }] });
    if (req.method === "POST" && /^\/meta\/[^/]+\/media$/.test(path)) return send(res, 200, { id: id("container") });
    if (req.method === "POST" && /^\/meta\/[^/]+\/media_publish$/.test(path)) return send(res, 200, { id: "ig_media_123" });
    if (req.method === "GET" && path.endsWith("/insights")) return send(res, 200, { data: [
      { name: "views", values: [{ value: 1200 }] }, { name: "saved", values: [{ value: 34 }] }, { name: "shares", values: [{ value: 9 }] },
    ] });
    if (req.method === "GET") {
      const fields = url.searchParams.get("fields") || "";
      if (fields.includes("status_code")) return send(res, 200, { status_code: "FINISHED" });
      if (fields.includes("permalink")) return send(res, 200, { permalink: "https://www.instagram.com/p/mock123/" });
      if (fields.includes("like_count")) return send(res, 200, { like_count: 88, comments_count: 6 });
      return send(res, 200, { id: "ig123", username: "testig" });
    }
  }

  /* ---------- Threads (root: /threads/v1.0, oauth at /threads) ---------- */
  if (path === "/threads/oauth/access_token" && req.method === "POST") return send(res, 200, { access_token: "threads_access", user_id: "tuser123", expires_in: 3600 });
  if (path === "/threads/access_token") return send(res, 200, { access_token: "threads_access_ll", expires_in: 5184000 });
  if (path.startsWith("/threads/v1.0/")) {
    if (req.method === "POST" && path.endsWith("/threads")) return send(res, 200, { id: id("thcontainer") });
    if (req.method === "POST" && path.endsWith("/threads_publish")) return send(res, 200, { id: "threads_123" });
    if (req.method === "GET" && path.endsWith("/insights")) return send(res, 200, { data: [
      { name: "views", values: [{ value: 640 }] }, { name: "likes", values: [{ value: 41 }] },
      { name: "replies", values: [{ value: 3 }] }, { name: "reposts", values: [{ value: 2 }] },
    ] });
    if (req.method === "GET") {
      const fields = url.searchParams.get("fields") || "";
      if (fields.includes("status")) return send(res, 200, { status: "FINISHED" });
      if (fields.includes("permalink")) return send(res, 200, { permalink: "https://www.threads.net/t/mock123" });
      return send(res, 200, { id: "tuser123", username: "testthreads" });
    }
  }

  /* ---------- Google / YouTube ---------- */
  if (path === "/google/token") return send(res, 200, { access_token: "yt_access", refresh_token: "yt_refresh", expires_in: 3600 });
  if (path.startsWith("/youtube/")) {
    if (req.method === "POST" && path === "/youtube/upload/youtube/v3/videos") {
      return send(res, 200, {}, { Location: `${origin}/youtube/upload/session/abc` });
    }
    if (req.method === "PUT" && path === "/youtube/upload/session/abc") return send(res, 200, { id: "yt_video_123" });
    if (path === "/youtube/youtube/v3/channels") return send(res, 200, { items: [{ snippet: { title: "Test Channel" } }] });
    if (path === "/youtube/youtube/v3/videos") return send(res, 200, { items: [{ statistics: { viewCount: "1000", likeCount: "50", commentCount: "5" } }] });
  }

  /* ---------- LinkedIn ---------- */
  if (path.startsWith("/linkedin/")) {
    if (path === "/linkedin/oauth/token" || path === "/linkedin/oauth/v2/accessToken") return send(res, 200, { access_token: "li_access", expires_in: 3600 });
    if (path === "/linkedin/v2/userinfo") return send(res, 200, { sub: "person123", name: "Test Person", email: "test@example.com" });
    if (req.method === "POST" && path === "/linkedin/rest/images") return send(res, 200, { value: { uploadUrl: `${origin}/linkedin/upload/binary`, image: "urn:li:image:123" } });
    if (req.method === "PUT" && path === "/linkedin/upload/binary") return send(res, 201, {});
    if (req.method === "POST" && path === "/linkedin/rest/posts") return send(res, 201, {}, { "x-restli-id": "urn:li:share:123" });
    if (req.method === "GET" && path.startsWith("/linkedin/v2/socialActions/")) return send(res, 200, { likesSummary: { totalLikes: 42 }, commentsSummary: { totalFirstLevelComments: 3 } });
  }

  /* ---------- TikTok ---------- */
  if (path.startsWith("/tiktok/")) {
    if (path === "/tiktok/v2/oauth/token/") return send(res, 200, { access_token: "tt_access", refresh_token: "tt_refresh", expires_in: 86400 });
    if (path === "/tiktok/v2/post/publish/creator_info/query/") return send(res, 200, { data: { creator_nickname: "Tester", creator_username: "tester", privacy_level_options: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"] }, error: { code: "ok" } });
    if (path === "/tiktok/v2/post/publish/video/init/") {
      const isUpload = json?.source_info?.source === "FILE_UPLOAD";
      return send(res, 200, { data: { publish_id: "v_pub_mock123", ...(isUpload ? { upload_url: `${origin}/tiktok/upload/video` } : {}) }, error: { code: "ok" } });
    }
    if (req.method === "PUT" && path === "/tiktok/upload/video") return send(res, 200, {});
    if (path === "/tiktok/v2/post/publish/content/init/") return send(res, 200, { data: { publish_id: "v_pub_photo123" }, error: { code: "ok" } });
    if (path === "/tiktok/v2/post/publish/status/fetch/") return send(res, 200, { data: { status: "PUBLISH_COMPLETE", publicaly_available_post_id: ["tt_post_123"] }, error: { code: "ok" } });
    if (path.startsWith("/tiktok/v2/video/query")) return send(res, 200, { data: { videos: [{ view_count: 900, like_count: 80, comment_count: 4, share_count: 2 }] }, error: { code: "ok" } });
  }

  /* ---------- X (OAuth 1.0a signature VERIFIED) ---------- */
  if (path.startsWith("/xupload/")) {
    if (req.method === "POST" && path === "/xupload/1.1/media/upload.json") return send(res, 200, { media_id_string: "x_media_1" });
  }
  if (path.startsWith("/x/")) {
    if (path === "/x/2/oauth2/token") return send(res, 200, { access_token: "x_oauth2_access", refresh_token: "x_oauth2_refresh", expires_in: 7200 });
    const auth = req.headers.authorization || "";
    if (auth.startsWith("OAuth ")) {
      const problem = verifyOAuth1(req, fullUrl);
      if (problem) return send(res, 401, { title: "Unauthorized", detail: problem });
    }
    if (req.method === "GET" && path === "/x/2/users/me") return send(res, 200, { data: { id: "x1", username: "tester" } });
    if (req.method === "POST" && path === "/x/2/tweets") return send(res, 201, { data: { id: id("tweet"), text: json.text || "" } });
    if (req.method === "GET" && path === "/x/2/tweets") return send(res, 200, { data: [{ public_metrics: { impression_count: 500, like_count: 20, reply_count: 2, retweet_count: 3, quote_count: 1, bookmark_count: 7 } }] });
  }

  /* ---------- Pinterest ---------- */
  if (path.startsWith("/pinterest/")) {
    if (path === "/pinterest/v5/oauth/token") return send(res, 200, { access_token: "pin_access", refresh_token: "pin_refresh", expires_in: 2592000 });
    if (path === "/pinterest/v5/user_account") return send(res, 200, { id: "p1", username: "pintester" });
    if (path === "/pinterest/v5/boards") return send(res, 200, { items: [{ id: "12345", name: "Ideas" }] });
    if (req.method === "POST" && path === "/pinterest/v5/pins") return send(res, 201, { id: "pin_123" });
    if (req.method === "GET" && /^\/pinterest\/v5\/pins\/[^/]+\/analytics$/.test(path)) return send(res, 200, { all: { summary: { IMPRESSION: 300, PIN_CLICK: 25, SAVE: 9 } } });
  }

  /* ---------- Reddit ---------- */
  if (path === "/reddit/api/v1/access_token") return send(res, 200, { access_token: "reddit_access", expires_in: 3600 });
  if (path.startsWith("/redditoauth/")) {
    if (path === "/redditoauth/api/v1/me") return send(res, 200, { name: "tester" });
    if (req.method === "POST" && path === "/redditoauth/api/submit") {
      if (!formParams.get("sr") || !formParams.get("title")) {
        return send(res, 200, { json: { errors: [["NO_SR", "subreddit required", "sr"]], data: {} } });
      }
      return send(res, 200, { json: { errors: [], data: { name: "t3_abc123", id: "abc123", url: "https://www.reddit.com/r/test/comments/abc123/mock/" } } });
    }
    if (path === "/redditoauth/api/info") return send(res, 200, { data: { children: [{ data: { ups: 15, num_comments: 6, num_crossposts: 1 } }] } });
  }

  return send(res, 404, { error: { message: `mock: unhandled ${req.method} ${path}` } });
});

server.listen(PORT, HOST, () => {
  console.log(`[mock-social] listening on ${origin}`);
});
