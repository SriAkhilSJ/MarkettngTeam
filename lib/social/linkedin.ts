import { bodyText, looksLikeImage, mediaList, truncate } from "./compose";
import { checkCredentials, resolveToken } from "./credentials";
import { SocialApiError, asRecord, downloadMedia, env, envBase, errMessage, fetchJson, form, str } from "./http";
import type { PlatformIntegration, TokenBag } from "./types";

/* Official docs:
 * Posts API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
 * Images API: POST /rest/images?action=initializeUpload -> PUT binary -> urn:li:image:{id}
 * Personal profile posting (w_member_social, "Share on LinkedIn") is self-serve.
 * Every /rest call needs headers: Linkedin-Version: YYYYMM + X-Restli-Protocol-Version: 2.0.0
 */

const PROVIDER = "linkedin";

function base(): string {
  return envBase("LINKEDIN_API_BASE", "https://api.linkedin.com");
}

/** LinkedIn cuts a new version monthly; each is supported >= 1 year.
 *  Default to ~2 months ago so the version definitely exists. Override with LINKEDIN_API_VERSION. */
function apiVersion(): string {
  const v = env("LINKEDIN_API_VERSION");
  if (v && /^\d{6}$/.test(v)) return v;
  const d = new Date();
  d.setDate(d.getDate() - 60);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": apiVersion(),
  };
}

export async function linkedinAccessToken(bag: TokenBag): Promise<string> {
  const t = resolveToken(bag, "linkedin", ["LINKEDIN_ACCESS_TOKEN"], ["LINKEDIN_REFRESH_TOKEN"]);
  if (t.token && !(bag.linkedin?.expiresAt && bag.linkedin.expiresAt < Date.now() + 60_000 && t.refreshToken)) return t.token;
  if (t.refreshToken) {
    const id = env("LINKEDIN_CLIENT_ID");
    const secret = env("LINKEDIN_CLIENT_SECRET");
    if (!id || !secret) throw new SocialApiError(PROVIDER, 400, "LINKEDIN_CLIENT_ID/SECRET required to refresh a LinkedIn token.");
    const tokenUrl = env("LINKEDIN_TOKEN_URL") || "https://www.linkedin.com/oauth/v2/accessToken";
    const { data } = await fetchJson(tokenUrl, {
      method: "POST", provider: PROVIDER,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ grant_type: "refresh_token", refresh_token: t.refreshToken, client_id: id, client_secret: secret }),
    });
    const access = str(data.access_token);
    if (!access) throw new SocialApiError(PROVIDER, 502, "LinkedIn refresh returned no access token (refresh tokens need a LinkedIn partner program — usually just reconnect).");
    return access;
  }
  throw new SocialApiError(PROVIDER, 401, "No LinkedIn token. Add LINKEDIN_ACCESS_TOKEN or Connect LinkedIn.");
}

async function authorUrn(token: string, bag: TokenBag): Promise<string> {
  const fromEnv = env("LINKEDIN_AUTHOR_URN");
  if (fromEnv) return fromEnv; // urn:li:person:{id} or urn:li:organization:{id}
  if (bag.linkedin?.accountId) {
    return bag.linkedin.accountId.startsWith("urn:") ? bag.linkedin.accountId : `urn:li:person:${bag.linkedin.accountId}`;
  }
  const { data } = await fetchJson(`${base()}/v2/userinfo`, { provider: PROVIDER, headers: { Authorization: `Bearer ${token}` } });
  const sub = str(data.sub);
  if (!sub) throw new SocialApiError(PROVIDER, 502, "Could not discover your LinkedIn member id. Set LINKEDIN_AUTHOR_URN=urn:li:person:{id}.");
  return `urn:li:person:${sub}`;
}

async function uploadImage(token: string, ownerUrn: string, imageUrl: string): Promise<string> {
  const { bytes } = await downloadMedia(imageUrl, PROVIDER, 20);
  const init = await fetchJson(`${base()}/rest/images?action=initializeUpload`, {
    method: "POST", provider: PROVIDER, headers: headers(token),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });
  const value = asRecord(init.data.value);
  const uploadUrl = str(value.uploadUrl);
  const imageUrn = str(value.image);
  if (!uploadUrl || !imageUrn) throw new SocialApiError(PROVIDER, 502, "LinkedIn image initializeUpload returned no upload URL.");
  const res = await fetch(uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: bytes as BodyInit });
  if (!res.ok) throw new SocialApiError(PROVIDER, res.status, `LinkedIn image binary upload failed (${res.status}).`);
  return imageUrn;
}

export const linkedinIntegration: PlatformIntegration = {
  check: (bag) => checkCredentials("linkedin", bag),
  test: async (bag) => {
    const check = checkCredentials("linkedin", bag);
    const baseOut = { platformId: "linkedin", provider: PROVIDER, configured: check.configured, missing: check.missing, source: check.source, checkedAt: new Date().toISOString() };
    if (!check.configured) return { ...baseOut, ok: false, message: "Add a LinkedIn token (or Connect), then test again." };
    try {
      const token = await linkedinAccessToken(bag);
      const { data } = await fetchJson(`${base()}/v2/userinfo`, { provider: PROVIDER, headers: { Authorization: `Bearer ${token}` } });
      return { ...baseOut, ok: true, account: str(data.name) || str(data.email), message: `LinkedIn connection OK (API version ${apiVersion()}).` };
    } catch (err) {
      return { ...baseOut, ok: false, message: "LinkedIn rejected the test call (token may be expired — LinkedIn tokens last ~60 days).", error: errMessage(err) };
    }
  },
  publish: async (post, bag, opts) => {
    const check = checkCredentials(post.platformId, bag);
    if (!check.configured) {
      return { ok: false, state: "not_configured", platformId: post.platformId, provider: PROVIDER, message: `Not configured. Missing: ${check.missing.join("; ")} — meanwhile use LinkedIn's free native scheduler.`, error: `Missing: ${check.missing.join(", ")}`, warnings: [] };
    }
    const commentary = truncate(bodyText(post), 3000);
    const media = mediaList(post);
    const imageUrl = media.find((u) => looksLikeImage(u));
    if (opts.dryRun) {
      return { ok: true, state: "dry_run", platformId: post.platformId, provider: PROVIDER, message: "Dry run OK — nothing was posted.", warnings: media.length && !imageUrl ? ["Only image media is uploaded for LinkedIn in this build; video URLs are ignored."] : [], planned: { commentary: commentary.slice(0, 300), image: imageUrl || null, author: env("LINKEDIN_AUTHOR_URN") || "(discovered from token)", apiVersion: apiVersion() } };
    }
    try {
      const token = await linkedinAccessToken(bag);
      const author = await authorUrn(token, bag);
      let content: Record<string, unknown> | undefined;
      if (imageUrl) {
        const imageUrn = await uploadImage(token, author, imageUrl);
        content = { media: { title: truncate(post.hook || "", 200), id: imageUrn } };
      }
      const payload: Record<string, unknown> = {
        author,
        commentary,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
        ...(content ? { content } : {}),
      };
      const res = await fetchJson(`${base()}/rest/posts`, { method: "POST", provider: PROVIDER, headers: headers(token), body: JSON.stringify(payload) });
      const postUrn = res.headers.get("x-restli-id") || str(res.data.id);
      if (!postUrn) throw new SocialApiError(PROVIDER, 502, "LinkedIn returned no post id — NOT marking published. Check LinkedIn before re-posting.");
      return {
        ok: true, state: "published", platformId: post.platformId, provider: PROVIDER,
        platformPostId: postUrn,
        platformUrl: `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}`,
        message: "Published to LinkedIn ✅",
        warnings: author.includes("organization") ? [] : [],
      };
    } catch (err) {
      return { ok: false, state: "failed", platformId: post.platformId, provider: PROVIDER, message: "LinkedIn publish failed. Post was NOT marked published.", error: errMessage(err), warnings: [] };
    }
  },
  metrics: async (post, bag) => {
    if (!post.externalId) return { platformId: post.platformId, ok: false, message: "Needs a published LinkedIn post URN." };
    try {
      const token = await linkedinAccessToken(bag);
      const urn = encodeURIComponent(post.externalId);
      const { data } = await fetchJson(`${base()}/v2/socialActions/${urn}`, { provider: PROVIDER, headers: { Authorization: `Bearer ${token}` } });
      const likes = asRecord(data.likesSummary);
      const comments = asRecord(data.commentsSummary);
      const metrics: Record<string, number> = {};
      if (typeof likes.totalLikes === "number") metrics.likes = likes.totalLikes;
      if (typeof comments.totalFirstLevelComments === "number") metrics.comments = comments.totalFirstLevelComments;
      if (Object.keys(metrics).length === 0) return { platformId: post.platformId, ok: false, message: "LinkedIn returned no metrics for this post (views are not exposed for member posts via the free API → use native analytics)." };
      return { platformId: post.platformId, ok: true, metrics, message: "LinkedIn metrics fetched (views/shares not exposed → N/A)." };
    } catch (err) {
      return { platformId: post.platformId, ok: false, message: "LinkedIn metrics need extra permissions for most accounts — enter numbers from LinkedIn's free post analytics instead.", error: errMessage(err) };
    }
  },
};
