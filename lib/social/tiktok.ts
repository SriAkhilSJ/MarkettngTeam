import { captionWithTags, looksLikeImage, looksLikeVideo, mediaList, titleFor, truncate } from "./compose";
import { checkCredentials, resolveToken } from "./credentials";
import { SocialApiError, asRecord, downloadMedia, env, envBase, errMessage, fetchJson, form, num, pollSettings, sleep, str } from "./http";
import type { PlatformIntegration, TokenBag } from "./types";

/* Official docs:
 * Direct Post: https://developers.tiktok.com/docs/en/content-posting-api-get-started
 * Must query creator_info before posting; privacy must be one of the returned options.
 * Unaudited apps: SELF_ONLY only (safe default). Set TIKTOK_PRIVACY_LEVEL after audit.
 * Source: FILE_UPLOAD (default; we download your public media URL and re-upload)
 *      or PULL_FROM_URL (needs your media domain verified in the TikTok app).
 */

const PROVIDER = "tiktok";

function base(): string {
  return envBase("TIKTOK_API_BASE", "https://open.tiktokapis.com");
}

export async function tiktokAccessToken(bag: TokenBag): Promise<string> {
  const t = resolveToken(bag, "tiktok", ["TIKTOK_ACCESS_TOKEN"], ["TIKTOK_REFRESH_TOKEN"]);
  if (t.token && !(bag.tiktok?.expiresAt && bag.tiktok.expiresAt < Date.now() + 60_000 && t.refreshToken)) return t.token;
  if (t.refreshToken) {
    const clientKey = env("TIKTOK_CLIENT_KEY");
    const clientSecret = env("TIKTOK_CLIENT_SECRET");
    if (!clientKey || !clientSecret) throw new SocialApiError(PROVIDER, 400, "TIKTOK_CLIENT_KEY/SECRET required to refresh a TikTok token.");
    const { data } = await fetchJson(`${base()}/v2/oauth/token/`, {
      method: "POST", provider: PROVIDER,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_key: clientKey, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: t.refreshToken }),
    });
    const access = str(data.access_token);
    if (!access) throw new SocialApiError(PROVIDER, 502, "TikTok refresh returned no access token.");
    return access;
  }
  throw new SocialApiError(PROVIDER, 401, "No TikTok token. Add TIKTOK_ACCESS_TOKEN or Connect TikTok.");
}

async function creatorInfo(token: string): Promise<Record<string, unknown>> {
  const { data } = await fetchJson(`${base()}/v2/post/publish/creator_info/query/`, {
    method: "POST", provider: PROVIDER,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: "{}",
  });
  const err = asRecord(data.error);
  if (str(err.code) && str(err.code) !== "ok") throw new SocialApiError(PROVIDER, 400, `TikTok creator_info error: ${str(err.message) || str(err.code)}`);
  return asRecord(data.data);
}

function pickPrivacy(info: Record<string, unknown>): string {
  const options = Array.isArray(info.privacy_level_options) ? info.privacy_level_options.map(String) : [];
  const wanted = (env("TIKTOK_PRIVACY_LEVEL") || "SELF_ONLY").toUpperCase();
  if (options.length === 0) return wanted;
  if (options.includes(wanted)) return wanted;
  return options.includes("SELF_ONLY") ? "SELF_ONLY" : options[0];
}

async function pollPublishStatus(token: string, publishId: string): Promise<{ done: boolean; postIds: string[]; failReason?: string }> {
  const { attempts, intervalMs } = pollSettings();
  for (let i = 0; i < attempts; i++) {
    const { data } = await fetchJson(`${base()}/v2/post/publish/status/fetch/`, {
      method: "POST", provider: PROVIDER,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const d = asRecord(data.data);
    const status = str(d.status) || "";
    if (status === "PUBLISH_COMPLETE") {
      const ids = Array.isArray(d.publicaly_available_post_id) ? d.publicaly_available_post_id.map(String) : [];
      return { done: true, postIds: ids };
    }
    if (status === "FAILED") return { done: true, postIds: [], failReason: str(d.fail_reason) || "TikTok processing failed" };
    if (i < attempts - 1) await sleep(intervalMs);
  }
  return { done: false, postIds: [] };
}

export const tiktokIntegration: PlatformIntegration = {
  check: (bag) => checkCredentials("tiktok", bag),
  test: async (bag) => {
    const check = checkCredentials("tiktok", bag);
    const out = { platformId: "tiktok", provider: PROVIDER, configured: check.configured, missing: check.missing, source: check.source, checkedAt: new Date().toISOString() };
    if (!check.configured) return { ...out, ok: false, message: "Add a TikTok token (or Connect), then test again." };
    try {
      const token = await tiktokAccessToken(bag);
      const info = await creatorInfo(token);
      return { ...out, ok: true, account: str(info.creator_nickname) || str(info.creator_username), message: `TikTok connection OK. Privacy options: ${(Array.isArray(info.privacy_level_options) ? info.privacy_level_options : []).join(", ") || "unknown"}.` };
    } catch (err) {
      return { ...out, ok: false, message: "TikTok rejected the test call (video.publish scope + app approval required).", error: errMessage(err) };
    }
  },
  publish: async (post, bag, opts) => {
    const check = checkCredentials(post.platformId, bag);
    if (!check.configured) {
      return { ok: false, state: "not_configured", platformId: post.platformId, provider: PROVIDER, message: `Not configured. Missing: ${check.missing.join("; ")} — meanwhile post free in the TikTok app.`, error: `Missing: ${check.missing.join(", ")}`, warnings: [] };
    }
    const media = mediaList(post);
    const videoUrl = media.find((u) => looksLikeVideo(u));
    const imageUrls = media.filter((u) => looksLikeImage(u));
    if (!videoUrl && imageUrls.length === 0) {
      return { ok: false, state: "failed", platformId: post.platformId, provider: PROVIDER, message: "TikTok needs a recorded video (or photos). Host the file at a public URL and paste it in Media URLs.", error: "MEDIA_REQUIRED", warnings: [] };
    }
    const source = (env("TIKTOK_SOURCE") || "FILE_UPLOAD").toUpperCase() === "PULL_FROM_URL" ? "PULL_FROM_URL" : "FILE_UPLOAD";
    const title = truncate(captionWithTags(post) || titleFor(post), 2200);
    if (opts.dryRun) {
      return { ok: true, state: "dry_run", platformId: post.platformId, provider: PROVIDER, message: "Dry run OK — nothing was posted.", warnings: ["Privacy is decided from creator_info at post time (default SELF_ONLY until your app passes TikTok audit)."], planned: { kind: videoUrl ? "video" : "photo", source, media, title: title.slice(0, 200) } };
    }
    try {
      const token = await tiktokAccessToken(bag);
      const info = await creatorInfo(token);
      const privacy = pickPrivacy(info);
      let publishId: string | undefined;

      if (videoUrl) {
        if (source === "PULL_FROM_URL") {
          const { data } = await fetchJson(`${base()}/v2/post/publish/video/init/`, {
            method: "POST", provider: PROVIDER,
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
            body: JSON.stringify({
              post_info: { title, privacy_level: privacy, disable_duet: false, disable_comment: false, disable_stitch: false },
              source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
            }),
          });
          publishId = str(asRecord(data.data).publish_id);
        } else {
          const { bytes } = await downloadMedia(videoUrl, PROVIDER, 100);
          const { data } = await fetchJson(`${base()}/v2/post/publish/video/init/`, {
            method: "POST", provider: PROVIDER,
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
            body: JSON.stringify({
              post_info: { title, privacy_level: privacy, disable_duet: false, disable_comment: false, disable_stitch: false },
              source_info: { source: "FILE_UPLOAD", video_size: bytes.byteLength, chunk_size: bytes.byteLength, total_chunk_count: 1 },
            }),
          });
          const d = asRecord(data.data);
          publishId = str(d.publish_id);
          const uploadUrl = str(d.upload_url);
          if (!uploadUrl) throw new SocialApiError(PROVIDER, 502, "TikTok FILE_UPLOAD init returned no upload_url.");
          const up = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "video/mp4", "Content-Length": String(bytes.byteLength), "Content-Range": `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}` },
            body: bytes as BodyInit,
          });
          if (!up.ok) throw new SocialApiError(PROVIDER, up.status, `TikTok video upload failed (${up.status}).`);
        }
      } else {
        // Photo post (Direct Post)
        const { data } = await fetchJson(`${base()}/v2/post/publish/content/init/`, {
          method: "POST", provider: PROVIDER,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify({
            post_info: { title: truncate(titleFor(post), 90), description: title, privacy_level: privacy, disable_comment: false, auto_add_music: true },
            source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: imageUrls.slice(0, 35) },
            post_mode: "DIRECT_POST",
            media_type: "PHOTO",
          }),
        });
        publishId = str(asRecord(data.data).publish_id);
      }

      if (!publishId) throw new SocialApiError(PROVIDER, 502, "TikTok returned no publish_id — NOT marking published.");
      const status = await pollPublishStatus(token, publishId);
      if (status.failReason) throw new SocialApiError(PROVIDER, 400, `TikTok processing failed: ${status.failReason}`);
      if (!status.done) {
        return {
          ok: true, state: "processing", platformId: post.platformId, provider: PROVIDER, platformPostId: publishId,
          message: `TikTok accepted the upload (publish_id ${publishId}) and is still processing. NOT marked published yet — use Fetch metrics / check TikTok, then mark PUBLISHED.`,
          warnings: [`Privacy used: ${privacy}`],
        };
      }
      const postId = status.postIds[0] || publishId;
      return {
        ok: true, state: "published", platformId: post.platformId, provider: PROVIDER, platformPostId: postId,
        message: `Published to TikTok ✅ (privacy: ${privacy})`,
        warnings: privacy === "SELF_ONLY" ? ["Post is private (SELF_ONLY) — expected until your TikTok app passes audit. Make it public in TikTok, or set TIKTOK_PRIVACY_LEVEL after audit."] : [],
      };
    } catch (err) {
      return { ok: false, state: "failed", platformId: post.platformId, provider: PROVIDER, message: "TikTok publish failed. Post was NOT marked published.", error: errMessage(err), warnings: [] };
    }
  },
  metrics: async (post, bag) => {
    if (!post.externalId) return { platformId: post.platformId, ok: false, message: "Needs a published TikTok post id (or publish_id still processing)." };
    try {
      const token = await tiktokAccessToken(bag);
      // If externalId is a publish_id (processing), resolve it first.
      let videoId = post.externalId;
      if (videoId.startsWith("v_pub") || videoId.includes("~")) {
        const status = await pollPublishStatus(token, videoId);
        if (status.failReason) return { platformId: post.platformId, ok: false, message: `TikTok processing failed: ${status.failReason}` };
        if (!status.done) return { platformId: post.platformId, ok: false, message: "TikTok is still processing this upload. Try again shortly." };
        videoId = status.postIds[0] || videoId;
      }
      const fields = "id,view_count,like_count,comment_count,share_count";
      const { data } = await fetchJson(`${base()}/v2/video/query/?fields=${encodeURIComponent(fields)}`, {
        method: "POST", provider: PROVIDER,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filters: { video_ids: [videoId] } }),
      });
      const videos = Array.isArray(asRecord(data.data).videos) ? (asRecord(data.data).videos as unknown[]) : [];
      const v = asRecord(videos[0]);
      if (!videos.length) return { platformId: post.platformId, ok: false, message: "TikTok returned no stats (video.list scope may be missing, or video still private)." };
      return {
        platformId: post.platformId, ok: true,
        metrics: { views: num(v.view_count), likes: num(v.like_count), comments: num(v.comment_count), shares: num(v.share_count) },
        message: "TikTok metrics fetched (saves not exposed → N/A).",
      };
    } catch (err) {
      return { platformId: post.platformId, ok: false, message: "TikTok metrics fetch failed.", error: errMessage(err) };
    }
  },
};
