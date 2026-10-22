import { createHmac, randomBytes } from "crypto";
import { captionWithTags, extractNumberedThread, extractSinglePost, looksLikeImage, mediaList, splitThread } from "./compose";
import { checkCredentials } from "./credentials";
import { SocialApiError, asRecord, basicAuth, downloadMedia, env, envBase, errMessage, fetchJson, form, num, str } from "./http";
import type { PlatformIntegration, TokenBag } from "./types";

/* Official docs:
 * Create post: https://docs.x.com/x-api/posts/manage-tweets/integrate (POST /2/tweets)
 * Threads = chained replies with reply.in_reply_to_tweet_id.
 * Auth: OAuth 1.0a user context (4 env keys) OR OAuth 2.0 PKCE token (Connect).
 * ⚠️ X API is PAY-PER-USE in 2026 (no free tier). Every real call here can cost money.
 */

const PROVIDER = "x";

function base(): string {
  return envBase("X_API_BASE", "https://api.x.com");
}
function uploadBase(): string {
  return envBase("X_UPLOAD_BASE", "https://upload.twitter.com/1.1");
}

interface OAuth1Creds { apiKey: string; apiSecret: string; accessToken: string; accessTokenSecret: string }

function oauth1Creds(): OAuth1Creds | null {
  const apiKey = env("X_API_KEY");
  const apiSecret = env("X_API_SECRET");
  const accessToken = env("X_ACCESS_TOKEN");
  const accessTokenSecret = env("X_ACCESS_TOKEN_SECRET");
  return apiKey && apiSecret && accessToken && accessTokenSecret
    ? { apiKey, apiSecret, accessToken, accessTokenSecret }
    : null;
}

function pct(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function oauth1Header(creds: OAuth1Creds, method: string, url: string, extraParams: Record<string, string> = {}): string {
  const u = new URL(url);
  const params: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
    ...extraParams,
  };
  u.searchParams.forEach((v, k) => { params[k] = v; });
  const paramString = Object.keys(params).sort().map((k) => `${pct(k)}=${pct(params[k])}`).join("&");
  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`;
  const baseString = `${method.toUpperCase()}&${pct(baseUrl)}&${pct(paramString)}`;
  const signingKey = `${pct(creds.apiSecret)}&${pct(creds.accessTokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");
  const headerParams: Record<string, string> = { ...params, oauth_signature: signature };
  // Only oauth_* params belong in the Authorization header
  const parts = Object.keys(headerParams)
    .filter((k) => k.startsWith("oauth_"))
    .sort()
    .map((k) => `${pct(k)}="${pct(headerParams[k])}"`);
  return `OAuth ${parts.join(", ")}`;
}

async function oauth2AccessToken(bag: TokenBag): Promise<string | null> {
  const stored = bag.x;
  if (!stored?.accessToken && !stored?.refreshToken) return null;
  if (stored.accessToken && stored.expiresAt && stored.expiresAt > Date.now() + 60_000) return stored.accessToken;
  if (stored.refreshToken) {
    const clientId = env("X_CLIENT_ID");
    const clientSecret = env("X_CLIENT_SECRET");
    if (!clientId) throw new SocialApiError(PROVIDER, 400, "X_CLIENT_ID required to refresh an X OAuth2 token.");
    const tokenUrl = env("X_TOKEN_URL") || `${base()}/2/oauth2/token`;
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    if (clientSecret) headers.Authorization = basicAuth(clientId, clientSecret);
    const { data } = await fetchJson(tokenUrl, {
      method: "POST", provider: PROVIDER, headers,
      body: form({ grant_type: "refresh_token", refresh_token: stored.refreshToken, client_id: clientId }),
    });
    const access = str(data.access_token);
    if (!access) throw new SocialApiError(PROVIDER, 502, "X token refresh returned no access token (refresh tokens rotate — reconnect X).");
    return access;
  }
  return stored.accessToken || null;
}

async function authHeader(bag: TokenBag, method: string, url: string): Promise<string> {
  const creds = oauth1Creds();
  if (creds) return oauth1Header(creds, method, url);
  const bearer = await oauth2AccessToken(bag);
  if (bearer) return `Bearer ${bearer}`;
  throw new SocialApiError(PROVIDER, 401, "No X credentials. Add the 4 OAuth 1.0a keys or Connect X.");
}

async function xFetch(bag: TokenBag, method: string, path: string, body?: Record<string, unknown>) {
  const url = `${base()}${path}`;
  const Authorization = await authHeader(bag, method, url);
  return fetchJson(url, {
    method, provider: PROVIDER,
    headers: { Authorization, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Simple image upload (OAuth 1.0a). Video-on-X via API is not attempted (paid + chunked) — post those manually. */
async function uploadImage(imageUrl: string): Promise<string> {
  const creds = oauth1Creds();
  if (!creds) throw new SocialApiError(PROVIDER, 400, "X image upload needs the OAuth 1.0a key set. Remove the image or post manually.");
  const { bytes, contentType } = await downloadMedia(imageUrl, PROVIDER, 5);
  const url = `${uploadBase()}/media/upload.json`;
  const formData = new FormData();
  formData.append("media", new Blob([bytes as BlobPart], { type: contentType }), "image");
  const res = await fetch(url, { method: "POST", headers: { Authorization: oauth1Header(creds, "POST", url) }, body: formData });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new SocialApiError(PROVIDER, res.status, `X media upload failed (${res.status}).`);
  const mediaId = str(data.media_id_string) || str(data.media_id);
  if (!mediaId) throw new SocialApiError(PROVIDER, 502, "X media upload returned no media id.");
  return mediaId;
}

export const xIntegration: PlatformIntegration = {
  check: (bag) => checkCredentials("x", bag),
  test: async (bag) => {
    const check = checkCredentials("x", bag);
    const out = { platformId: "x", provider: PROVIDER, configured: check.configured, missing: check.missing, source: check.source, checkedAt: new Date().toISOString() };
    if (!check.configured) return { ...out, ok: false, message: "Add X keys (this also needs X API credits — X is pay-per-use)." };
    try {
      const { data } = await xFetch(bag, "GET", "/2/users/me");
      const me = asRecord(data.data);
      return { ...out, ok: true, account: str(me.username) ? `@${str(me.username)}` : str(me.id), message: "X connection OK. ⚠️ Remember: real X API calls are billed pay-per-use." };
    } catch (err) {
      return { ...out, ok: false, message: "X rejected the test call (check keys, app permissions = Read+Write, and API credit balance).", error: errMessage(err) };
    }
  },
  publish: async (post, bag, opts) => {
    const check = checkCredentials(post.platformId, bag);
    if (!check.configured) {
      return { ok: false, state: "not_configured", platformId: post.platformId, provider: PROVIDER, message: `Not configured. Missing: ${check.missing.join("; ")}. Recommended: keep posting to X manually (free) — the API is paid.`, error: `Missing: ${check.missing.join(", ")}`, warnings: [] };
    }
    const mode = (env("X_PUBLISH_MODE") || "thread").toLowerCase();
    const numbered = extractNumberedThread(post.content || "");
    const single = extractSinglePost(post.content || "");
    let parts: string[];
    if (numbered && mode !== "single") parts = numbered.flatMap((p) => splitThread(p, 275));
    else if (single) parts = splitThread(single, 275);
    else parts = splitThread(captionWithTags(post) || post.content || post.hook, 275);
    parts = parts.map((p) => p.trim()).filter(Boolean).slice(0, 25);
    if (parts.length === 0) {
      return { ok: false, state: "failed", platformId: post.platformId, provider: PROVIDER, message: "Nothing to post — content is empty.", error: "EMPTY", warnings: [] };
    }
    const media = mediaList(post);
    const images = media.filter((u) => looksLikeImage(u));
    if (opts.dryRun) {
      return { ok: true, state: "dry_run", platformId: post.platformId, provider: PROVIDER, message: `Dry run OK — would post ${parts.length} tweet(s). Nothing was posted (and no X charges).`, warnings: ["⚠️ Real X API posts are billed per call in 2026."], planned: { parts, images: images.slice(0, 4), mode } };
    }
    try {
      let mediaIds: string[] = [];
      if (images.length > 0) {
        for (const img of images.slice(0, 4)) mediaIds.push(await uploadImage(img));
      } else if (media.length > 0) {
        throw new SocialApiError(PROVIDER, 400, "Only image media is supported for X here. Post videos to X manually.");
      }
      let firstId: string | undefined;
      let prevId: string | undefined;
      for (let i = 0; i < parts.length; i++) {
        const body: Record<string, unknown> = { text: parts[i] };
        if (prevId) body.reply = { in_reply_to_tweet_id: prevId };
        if (i === 0 && mediaIds.length) body.media = { media_ids: mediaIds };
        const { data } = await xFetch(bag, "POST", "/2/tweets", body);
        const id = str(asRecord(data.data).id);
        if (!id) throw new SocialApiError(PROVIDER, 502, `Tweet ${i + 1} returned no id — thread stopped. Earlier tweets (if any) ARE live: ${firstId || "none"}. NOT auto-retrying.`);
        if (!firstId) firstId = id;
        prevId = id;
      }
      return {
        ok: true, state: "published", platformId: post.platformId, provider: PROVIDER,
        platformPostId: firstId,
        platformUrl: firstId ? `https://x.com/i/web/status/${firstId}` : undefined,
        message: `Published to X ✅ (${parts.length} tweet${parts.length > 1 ? "s in thread" : ""})`,
        warnings: [],
      };
    } catch (err) {
      return { ok: false, state: "failed", platformId: post.platformId, provider: PROVIDER, message: "X publish failed (or partially posted a thread — check X before re-posting). Post was NOT marked published.", error: errMessage(err), warnings: [] };
    }
  },
  metrics: async (post, bag) => {
    if (!post.externalId) return { platformId: post.platformId, ok: false, message: "Needs a published tweet id." };
    try {
      const { data } = await xFetch(bag, "GET", `/2/tweets?ids=${encodeURIComponent(post.externalId)}&tweet.fields=public_metrics`);
      const rows = Array.isArray(data.data) ? data.data : [];
      const pm = asRecord(asRecord(rows[0]).public_metrics);
      if (!rows.length) return { platformId: post.platformId, ok: false, message: "X returned no metrics (reads are also billed — check credit balance)." };
      const shares = (num(pm.retweet_count) || 0) + (num(pm.quote_count) || 0);
      return {
        platformId: post.platformId, ok: true,
        metrics: { views: num(pm.impression_count), likes: num(pm.like_count), comments: num(pm.reply_count), shares: shares || undefined, saves: num(pm.bookmark_count) },
        message: "X metrics fetched.",
      };
    } catch (err) {
      return { platformId: post.platformId, ok: false, message: "X metrics fetch failed.", error: errMessage(err) };
    }
  },
};
