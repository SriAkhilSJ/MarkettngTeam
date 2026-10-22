import type { Post } from "../types";
import { captionWithTags, bodyText, looksLikeVideo, mediaList, truncate } from "./compose";
import { checkCredentials, resolveToken } from "./credentials";
import { SocialApiError, asRecord, env, envBase, errMessage, fetchJson, form, num, pollSettings, sleep, str } from "./http";
import type { ConnectionTestResult, MetricsResult, PlatformIntegration, PublishOptions, PublishResult, TokenBag } from "./types";

/* Official docs:
 * Instagram content publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing/
 * Threads posts: https://developers.facebook.com/documentation/threads/posts
 * Both are two-step: create container -> poll -> publish. Media must be PUBLIC URLs.
 */

function metaRoot(): string {
  const version = env("META_GRAPH_VERSION") || "v25.0";
  return envBase("META_GRAPH_BASE", `https://graph.facebook.com/${version}`);
}
function threadsRoot(): string {
  return envBase("THREADS_GRAPH_BASE", "https://graph.threads.net/v1.0");
}

async function graphPost(root: string, path: string, params: Record<string, string>, provider: string) {
  return fetchJson(`${root}${path}`, {
    method: "POST",
    provider,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form(params),
  });
}
async function graphGet(root: string, path: string, token: string, provider: string) {
  const sep = path.includes("?") ? "&" : "?";
  return fetchJson(`${root}${path}${sep}access_token=${encodeURIComponent(token)}`, { provider });
}

async function pollContainer(root: string, containerId: string, token: string, provider: string): Promise<void> {
  const { attempts, intervalMs } = pollSettings();
  for (let i = 0; i < attempts; i++) {
    const { data } = await graphGet(root, `/${containerId}?fields=status_code,status`, token, provider);
    const status = str(data.status_code) || str(data.status) || "";
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new SocialApiError(provider, 400, `Media container failed (${status}). Check the media URL is public and in a supported format.`);
    }
    if (i < attempts - 1) await sleep(intervalMs);
  }
  throw new SocialApiError(provider, 408, "Media is still processing. Try Publish again in a minute (containers stay valid ~24h).");
}

function notConfigured(platformId: string, provider: string, missing: string[]): PublishResult {
  return {
    ok: false, state: "not_configured", platformId, provider,
    message: `Not configured. Missing: ${missing.join("; ")}. See TESTING.md — meanwhile use Copy + manual posting (free).`,
    error: `Missing credentials: ${missing.join(", ")}`,
    warnings: [],
  };
}

/* ============================== INSTAGRAM ============================== */

function igCreds(bag: TokenBag): { token?: string; igId?: string } {
  const t = resolveToken(bag, "meta", ["META_ACCESS_TOKEN", "INSTAGRAM_ACCESS_TOKEN"]);
  return { token: t.token, igId: env("INSTAGRAM_BUSINESS_ACCOUNT_ID") || bag.meta?.accountId };
}

async function igTest(platformId: string, bag: TokenBag): Promise<ConnectionTestResult> {
  const check = checkCredentials(platformId, bag);
  const base = { platformId, provider: "meta", configured: check.configured, missing: check.missing, source: check.source, checkedAt: new Date().toISOString() };
  const { token, igId } = igCreds(bag);
  if (!check.configured || !token) return { ...base, ok: false, message: "Add the missing Meta credentials, then test again." };
  try {
    if (igId) {
      const { data } = await graphGet(metaRoot(), `/${igId}?fields=id,username`, token, "meta");
      return { ...base, ok: true, account: str(data.username) ? `@${str(data.username)}` : str(data.id), message: "Instagram connection OK." };
    }
    const { data } = await graphGet(metaRoot(), `/me/accounts?fields=instagram_business_account{id,username},name`, token, "meta");
    const pages = Array.isArray(data.data) ? data.data : [];
    for (const p of pages) {
      const ig = asRecord(asRecord(p).instagram_business_account);
      if (str(ig.id)) return { ...base, ok: true, account: `@${str(ig.username)}`, message: `Token works. Set INSTAGRAM_BUSINESS_ACCOUNT_ID=${str(ig.id)} in .env.local.` };
    }
    return { ...base, ok: false, message: "Token works but no Instagram Business/Creator account is linked to your Facebook Pages." };
  } catch (err) {
    return { ...base, ok: false, message: "Meta rejected the test call.", error: errMessage(err) };
  }
}

async function igPublish(post: Post, bag: TokenBag, opts: PublishOptions): Promise<PublishResult> {
  const provider = "meta";
  const check = checkCredentials(post.platformId, bag);
  if (!check.configured) return notConfigured(post.platformId, provider, check.missing);
  const { token, igId } = igCreds(bag);
  const media = mediaList(post);
  const caption = truncate(captionWithTags(post), 2200);
  const isReel = post.platformId === "instagram-reel";

  if (media.length === 0) {
    return { ok: false, state: "failed", platformId: post.platformId, provider, message: "Instagram API requires media — add at least one public Media URL (image for carousel, video for reel).", error: "MEDIA_REQUIRED", warnings: [] };
  }
  if (isReel && !looksLikeVideo(media[0])) {
    return { ok: false, state: "failed", platformId: post.platformId, provider, message: "Reels need a video file URL (.mp4/.mov). Record the video, host it publicly, paste the URL in Media URLs.", error: "VIDEO_REQUIRED", warnings: [] };
  }
  if (!isReel && media.length === 1 && looksLikeVideo(media[0])) {
    return { ok: false, state: "failed", platformId: post.platformId, provider, message: "A single video should be published as an Instagram Reel. Add images, or switch this idea's reel post.", error: "USE_REEL", warnings: [] };
  }

  const planned = { igUserId: igId, mediaType: isReel ? "REELS" : media.length > 1 ? "CAROUSEL" : "IMAGE", media, caption: caption.slice(0, 200) };
  if (opts.dryRun) {
    return { ok: true, state: "dry_run", platformId: post.platformId, provider, message: "Dry run OK — credentials and media look publishable. Nothing was posted.", warnings: [], planned };
  }

  try {
    const root = metaRoot();
    let creationId: string;
    if (isReel) {
      const { data } = await graphPost(root, `/${igId}/media`, { media_type: "REELS", video_url: media[0], caption, share_to_feed: "true", access_token: token! }, provider);
      creationId = str(data.id) || "";
      if (!creationId) throw new SocialApiError(provider, 502, "Instagram did not return a container id.");
      await pollContainer(root, creationId, token!, provider);
    } else if (media.length === 1) {
      const { data } = await graphPost(root, `/${igId}/media`, { image_url: media[0], caption, access_token: token! }, provider);
      creationId = str(data.id) || "";
      if (!creationId) throw new SocialApiError(provider, 502, "Instagram did not return a container id.");
    } else {
      const children: string[] = [];
      for (const url of media.slice(0, 10)) {
        const params: Record<string, string> = { is_carousel_item: "true", access_token: token! };
        if (looksLikeVideo(url)) { params.media_type = "VIDEO"; params.video_url = url; } else { params.image_url = url; }
        const { data } = await graphPost(root, `/${igId}/media`, params, provider);
        const childId = str(data.id);
        if (!childId) throw new SocialApiError(provider, 502, "Instagram did not return a carousel item id.");
        children.push(childId);
        if (looksLikeVideo(url)) await pollContainer(root, childId, token!, provider);
      }
      const { data } = await graphPost(root, `/${igId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption, access_token: token! }, provider);
      creationId = str(data.id) || "";
      if (!creationId) throw new SocialApiError(provider, 502, "Instagram did not return a carousel id.");
    }
    const { data: pub } = await graphPost(root, `/${igId}/media_publish`, { creation_id: creationId, access_token: token! }, provider);
    const mediaId = str(pub.id);
    if (!mediaId) throw new SocialApiError(provider, 502, "Publish call returned no media id — NOT marking published. Check Instagram before re-posting.");
    let url: string | undefined;
    try {
      const { data: info } = await graphGet(root, `/${mediaId}?fields=permalink`, token!, provider);
      url = str(info.permalink);
    } catch { /* permalink is nice-to-have */ }
    return { ok: true, state: "published", platformId: post.platformId, provider, platformPostId: mediaId, platformUrl: url, message: "Published to Instagram ✅", warnings: [] };
  } catch (err) {
    return { ok: false, state: "failed", platformId: post.platformId, provider, message: "Instagram publish failed. Post was NOT marked published.", error: errMessage(err), warnings: [] };
  }
}

async function igMetrics(post: Post, bag: TokenBag): Promise<MetricsResult> {
  const { token } = igCreds(bag);
  if (!token || !post.externalId) return { platformId: post.platformId, ok: false, message: "Needs a Meta token and a published Instagram media id." };
  try {
    const root = metaRoot();
    const { data } = await graphGet(root, `/${post.externalId}?fields=like_count,comments_count`, token, "meta");
    const metrics: Record<string, number> = {};
    if (num(data.like_count) !== undefined) metrics.likes = num(data.like_count)!;
    if (num(data.comments_count) !== undefined) metrics.comments = num(data.comments_count)!;
    try {
      const { data: ins } = await graphGet(root, `/${post.externalId}/insights?metric=views,reach,saved,shares`, token, "meta");
      const rows = Array.isArray(ins.data) ? ins.data : [];
      for (const r of rows) {
        const row = asRecord(r);
        const name = str(row.name);
        const values = Array.isArray(row.values) ? row.values : [];
        const v = num(asRecord(values[0]).value);
        if (v === undefined || !name) continue;
        if (name === "views") metrics.views = v;
        if (name === "saved") metrics.saves = v;
        if (name === "shares") metrics.shares = v;
      }
    } catch { /* insights vary by media type — basic counts still returned */ }
    return { platformId: post.platformId, ok: true, metrics, message: "Instagram metrics fetched (unavailable metrics left as N/A)." };
  } catch (err) {
    return { platformId: post.platformId, ok: false, message: "Instagram metrics fetch failed.", error: errMessage(err) };
  }
}

export const instagramIntegration = (platformId: string): PlatformIntegration => ({
  check: (bag) => checkCredentials(platformId, bag),
  test: (bag) => igTest(platformId, bag),
  publish: igPublish,
  metrics: igMetrics,
});

/* ============================== THREADS ============================== */

function threadsCreds(bag: TokenBag): { token?: string; userId: string } {
  const t = resolveToken(bag, "threads", ["THREADS_ACCESS_TOKEN", "META_ACCESS_TOKEN"]);
  return { token: t.token, userId: env("THREADS_USER_ID") || bag.threads?.accountId || "me" };
}

export const threadsIntegration: PlatformIntegration = {
  check: (bag) => checkCredentials("threads", bag),
  test: async (bag) => {
    const check = checkCredentials("threads", bag);
    const base = { platformId: "threads", provider: "threads", configured: check.configured, missing: check.missing, source: check.source, checkedAt: new Date().toISOString() };
    const { token } = threadsCreds(bag);
    if (!check.configured || !token) return { ...base, ok: false, message: "Add Threads credentials (or Connect), then test again." };
    try {
      const { data } = await graphGet(threadsRoot(), `/me?fields=id,username`, token, "threads");
      return { ...base, ok: true, account: str(data.username) ? `@${str(data.username)}` : str(data.id), message: "Threads connection OK." };
    } catch (err) {
      return { ...base, ok: false, message: "Threads rejected the test call (token scope threads_basic required).", error: errMessage(err) };
    }
  },
  publish: async (post, bag, opts) => {
    const provider = "threads";
    const check = checkCredentials(post.platformId, bag);
    if (!check.configured) return notConfigured(post.platformId, provider, check.missing);
    const { token, userId } = threadsCreds(bag);
    const media = mediaList(post);
    const text = truncate(bodyText(post), 500);
    const planned = { userId, mediaType: media.length > 1 ? "CAROUSEL" : media.length === 1 ? (looksLikeVideo(media[0]) ? "VIDEO" : "IMAGE") : "TEXT", media, text };
    if (opts.dryRun) return { ok: true, state: "dry_run", platformId: post.platformId, provider, message: "Dry run OK — nothing was posted.", warnings: text.length >= 500 ? ["Text hit the 500-character Threads limit and was truncated."] : [], planned };
    try {
      const root = threadsRoot();
      let creationId: string;
      if (media.length > 1) {
        const children: string[] = [];
        for (const url of media.slice(0, 20)) {
          const params: Record<string, string> = { is_carousel_item: "true", access_token: token! };
          if (looksLikeVideo(url)) { params.media_type = "VIDEO"; params.video_url = url; } else { params.media_type = "IMAGE"; params.image_url = url; }
          const { data } = await graphPost(root, `/${userId}/threads`, params, provider);
          const id = str(data.id);
          if (!id) throw new SocialApiError(provider, 502, "Threads did not return a carousel item id.");
          children.push(id);
        }
        const { data } = await graphPost(root, `/${userId}/threads`, { media_type: "CAROUSEL", children: children.join(","), text, access_token: token! }, provider);
        creationId = str(data.id) || "";
      } else {
        const params: Record<string, string> = { text, access_token: token! };
        if (media.length === 1 && looksLikeVideo(media[0])) { params.media_type = "VIDEO"; params.video_url = media[0]; }
        else if (media.length === 1) { params.media_type = "IMAGE"; params.image_url = media[0]; }
        else params.media_type = "TEXT";
        const { data } = await graphPost(root, `/${userId}/threads`, params, provider);
        creationId = str(data.id) || "";
      }
      if (!creationId) throw new SocialApiError(provider, 502, "Threads did not return a container id.");
      if (media.length > 0) await pollContainer(root, creationId, token!, provider);
      const { data: pub } = await graphPost(root, `/${userId}/threads_publish`, { creation_id: creationId, access_token: token! }, provider);
      const postId = str(pub.id);
      if (!postId) throw new SocialApiError(provider, 502, "Publish returned no post id — NOT marking published. Check Threads before re-posting.");
      let url: string | undefined;
      try {
        const { data: info } = await graphGet(root, `/${postId}?fields=permalink`, token!, provider);
        url = str(info.permalink);
      } catch { /* optional */ }
      return { ok: true, state: "published", platformId: post.platformId, provider, platformPostId: postId, platformUrl: url, message: "Published to Threads ✅", warnings: [] };
    } catch (err) {
      return { ok: false, state: "failed", platformId: post.platformId, provider, message: "Threads publish failed. Post was NOT marked published.", error: errMessage(err), warnings: [] };
    }
  },
  metrics: async (post, bag) => {
    const { token } = threadsCreds(bag);
    if (!token || !post.externalId) return { platformId: post.platformId, ok: false, message: "Needs a Threads token (threads_manage_insights) and a published post id." };
    try {
      const { data } = await graphGet(threadsRoot(), `/${post.externalId}/insights?metric=views,likes,replies,reposts,quotes`, token, "threads");
      const metrics: Record<string, number> = {};
      const rows = Array.isArray(data.data) ? data.data : [];
      for (const r of rows) {
        const row = asRecord(r);
        const name = str(row.name);
        const values = Array.isArray(row.values) ? row.values : [];
        const v = num(asRecord(values[0]).value);
        if (v === undefined || !name) continue;
        if (name === "views") metrics.views = v;
        if (name === "likes") metrics.likes = v;
        if (name === "replies") metrics.comments = v;
        if (name === "reposts" || name === "quotes") metrics.shares = (metrics.shares || 0) + v;
      }
      return { platformId: post.platformId, ok: true, metrics, message: "Threads metrics fetched." };
    } catch (err) {
      return { platformId: post.platformId, ok: false, message: "Threads metrics fetch failed (check threads_manage_insights scope).", error: errMessage(err) };
    }
  },
};
