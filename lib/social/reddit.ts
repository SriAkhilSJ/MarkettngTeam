import { bodyText, titleFor, truncate } from "./compose";
import { checkCredentials, resolveToken } from "./credentials";
import { SocialApiError, asRecord, basicAuth, env, envBase, errMessage, fetchJson, form, num, str } from "./http";
import type { PlatformIntegration, TokenBag } from "./types";

/* Official docs:
 * OAuth + submit: https://www.reddit.com/dev/api/oauth/ (POST /api/submit)
 * ⚠️ Reddit approval: since late 2025 every app needs explicit Reddit approval
 * (Responsible Builder Policy) and new self-service apps were closed.
 * This integration works IF you already have approved credentials.
 * Manual posting remains the recommended default (genuine participation, zero promo).
 */

const PROVIDER = "reddit";

function oauthBase(): string {
  return envBase("REDDIT_OAUTH_BASE", "https://oauth.reddit.com");
}
function tokenHost(): string {
  return envBase("REDDIT_API_BASE", "https://www.reddit.com");
}
function userAgent(): string {
  return env("REDDIT_USER_AGENT") || "web:auto-marketing-team:v0.2.0 (AUTO socials app)";
}

export async function redditAccessToken(bag: TokenBag): Promise<string> {
  const t = resolveToken(bag, "reddit", ["REDDIT_ACCESS_TOKEN"], ["REDDIT_REFRESH_TOKEN"]);
  if (t.token && !(bag.reddit?.expiresAt && bag.reddit.expiresAt < Date.now() + 60_000 && t.refreshToken)) return t.token;
  const id = env("REDDIT_CLIENT_ID");
  const secret = env("REDDIT_CLIENT_SECRET") || "";
  if (!id) throw new SocialApiError(PROVIDER, 400, "REDDIT_CLIENT_ID is required.");
  const auth = basicAuth(id, secret);
  const ua = userAgent();

  if (t.refreshToken) {
    const { data } = await fetchJson(`${tokenHost()}/api/v1/access_token`, {
      method: "POST", provider: PROVIDER,
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": ua },
      body: form({ grant_type: "refresh_token", refresh_token: t.refreshToken }),
    });
    const access = str(data.access_token);
    if (!access) throw new SocialApiError(PROVIDER, 502, "Reddit refresh returned no access token.");
    return access;
  }
  const username = env("REDDIT_USERNAME");
  const password = env("REDDIT_PASSWORD");
  if (username && password) {
    // "script"-type apps only. May be unavailable for newer/approved app types.
    const { data } = await fetchJson(`${tokenHost()}/api/v1/access_token`, {
      method: "POST", provider: PROVIDER,
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": ua },
      body: form({ grant_type: "password", username, password }),
    });
    const access = str(data.access_token);
    if (!access) throw new SocialApiError(PROVIDER, 502, "Reddit password-grant returned no token (script apps only; otherwise use Connect/refresh token).");
    return access;
  }
  throw new SocialApiError(PROVIDER, 401, "No Reddit token. Add credentials or Connect Reddit — or post manually (recommended).");
}

async function redditFetch(token: string, method: string, path: string, body?: Record<string, string>) {
  return fetchJson(`${oauthBase()}${path}`, {
    method, provider: PROVIDER,
    headers: { Authorization: `Bearer ${token}`, "User-Agent": userAgent(), ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: body ? form(body) : undefined,
  });
}

export const redditIntegration: PlatformIntegration = {
  check: (bag) => checkCredentials("reddit", bag),
  test: async (bag) => {
    const check = checkCredentials("reddit", bag);
    const out = { platformId: "reddit", provider: PROVIDER, configured: check.configured, missing: check.missing, source: check.source, checkedAt: new Date().toISOString() };
    if (!check.configured) return { ...out, ok: false, message: "No approved Reddit credentials — keep posting manually (recommended), or add them per TESTING.md." };
    try {
      const token = await redditAccessToken(bag);
      const { data } = await redditFetch(token, "GET", "/api/v1/me");
      return { ...out, ok: true, account: str(data.name) ? `u/${str(data.name)}` : undefined, message: "Reddit connection OK." };
    } catch (err) {
      return { ...out, ok: false, message: "Reddit rejected the test call (app may lack approval, or token expired).", error: errMessage(err) };
    }
  },
  publish: async (post, bag, opts) => {
    const check = checkCredentials(post.platformId, bag);
    if (!check.configured) {
      return { ok: false, state: "not_configured", platformId: post.platformId, provider: PROVIDER, message: `Not configured. Missing: ${check.missing.join("; ")}. Reddit manual posting is the recommended (free, safe) path.`, error: `Missing: ${check.missing.join(", ")}`, warnings: [] };
    }
    const subreddit = (post.subreddit || env("REDDIT_SUBREDDIT") || "").replace(/^\/?r\//i, "").trim();
    if (!subreddit) {
      return { ok: false, state: "failed", platformId: post.platformId, provider: PROVIDER, message: "Set the subreddit on this post (or REDDIT_SUBREDDIT). Only post where you genuinely participate and after reading that sub's rules.", error: "SUBREDDIT_REQUIRED", warnings: [] };
    }
    const title = truncate(titleFor(post, 300), 300);
    const isLink = Boolean(post.linkUrl?.trim());
    const text = bodyText(post);
    if (opts.dryRun) {
      return { ok: true, state: "dry_run", platformId: post.platformId, provider: PROVIDER, message: "Dry run OK — nothing was posted.", warnings: ["Reddit: zero promo, read the sub rules, some subs require flair (add manually if the API errors)."], planned: { subreddit, kind: isLink ? "link" : "self", title, url: post.linkUrl, textPreview: text.slice(0, 200) } };
    }
    try {
      const token = await redditAccessToken(bag);
      const { data } = await redditFetch(token, "POST", "/api/submit", {
        api_type: "json",
        kind: isLink ? "link" : "self",
        sr: subreddit,
        title,
        ...(isLink ? { url: post.linkUrl!.trim(), resubmit: "true" } : { text }),
        sendreplies: "true",
      });
      const json = asRecord(data.json);
      const errors = Array.isArray(json.errors) ? json.errors : [];
      if (errors.length) {
        const msgs = errors.map((e) => (Array.isArray(e) ? e.filter((x) => typeof x === "string").join(": ") : String(e))).join("; ");
        throw new SocialApiError(PROVIDER, 400, `Reddit refused the post: ${msgs} (common: flair required, karma/account-age limits, sub rules).`);
      }
      const payload = asRecord(json.data);
      const postId = str(payload.name) || str(payload.id);
      const url = str(payload.url);
      if (!postId) throw new SocialApiError(PROVIDER, 502, "Reddit returned no post id — NOT marking published. Check Reddit before re-posting (avoid duplicates).");
      return { ok: true, state: "published", platformId: post.platformId, provider: PROVIDER, platformPostId: postId, platformUrl: url, message: `Posted to r/${subreddit} ✅ — now go reply to comments like a human.`, warnings: [] };
    } catch (err) {
      return { ok: false, state: "failed", platformId: post.platformId, provider: PROVIDER, message: "Reddit publish failed. Post was NOT marked published.", error: errMessage(err), warnings: [] };
    }
  },
  metrics: async (post, bag) => {
    if (!post.externalId) return { platformId: post.platformId, ok: false, message: "Needs a published Reddit post id (t3_…)." };
    try {
      const token = await redditAccessToken(bag);
      const fullname = post.externalId.startsWith("t3_") ? post.externalId : `t3_${post.externalId}`;
      const { data } = await redditFetch(token, "GET", `/api/info?id=${encodeURIComponent(fullname)}`);
      const children = Array.isArray(asRecord(data.data).children) ? (asRecord(data.data).children as unknown[]) : [];
      const d = asRecord(asRecord(children[0]).data);
      if (!children.length) return { platformId: post.platformId, ok: false, message: "Reddit post not found." };
      return {
        platformId: post.platformId, ok: true,
        metrics: { likes: num(d.ups), comments: num(d.num_comments), shares: num(d.num_crossposts) },
        message: "Reddit metrics fetched (likes = upvotes; views not exposed → N/A).",
      };
    } catch (err) {
      return { platformId: post.platformId, ok: false, message: "Reddit metrics fetch failed.", error: errMessage(err) };
    }
  },
};
