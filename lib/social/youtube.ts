import { cleanTags, looksLikeVideo, mediaList, titleFor, truncate } from "./compose";
import { checkCredentials, resolveToken } from "./credentials";
import { SocialApiError, asRecord, downloadMedia, env, envBase, errMessage, fetchJson, form, num, str } from "./http";
import type { PlatformIntegration, TokenBag } from "./types";

/* Official docs:
 * Resumable uploads: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
 * Videos insert: https://developers.google.com/youtube/v3/docs/videos/insert
 * Shorts use the same endpoint (vertical/square, <=3 min). Privacy defaults to "private"
 * (env YOUTUBE_PRIVACY=public|unlisted|private) — unaudited Google projects are forced private anyway.
 */

const PROVIDER = "google";

function apiBase(): string {
  return envBase("YOUTUBE_API_BASE", "https://www.googleapis.com");
}
function tokenUrl(): string {
  return env("GOOGLE_TOKEN_URL") || "https://oauth2.googleapis.com/token";
}

export async function googleAccessToken(bag: TokenBag): Promise<string> {
  const t = resolveToken(bag, "google", ["YOUTUBE_ACCESS_TOKEN"], ["YOUTUBE_REFRESH_TOKEN"]);
  const stored = bag.google;
  if (stored?.accessToken && stored.expiresAt && stored.expiresAt > Date.now() + 60_000 && !env("YOUTUBE_ACCESS_TOKEN")) {
    return stored.accessToken;
  }
  if (t.refreshToken) {
    const clientId = env("GOOGLE_CLIENT_ID");
    const clientSecret = env("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) throw new SocialApiError(PROVIDER, 400, "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required to use a refresh token.");
    const { data } = await fetchJson(tokenUrl(), {
      method: "POST",
      provider: PROVIDER,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_id: clientId, client_secret: clientSecret, refresh_token: t.refreshToken, grant_type: "refresh_token" }),
    });
    const access = str(data.access_token);
    if (!access) throw new SocialApiError(PROVIDER, 502, "Google token refresh returned no access token.");
    return access;
  }
  if (t.token) return t.token;
  throw new SocialApiError(PROVIDER, 401, "No YouTube token. Add YOUTUBE_REFRESH_TOKEN or Connect Google.");
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

const CHUNK = 5 * 1024 * 1024; // 5 MB — a multiple of 256 KB as required

async function resumableUpload(token: string, metadata: Record<string, unknown>, bytes: Uint8Array, contentType: string): Promise<Record<string, unknown>> {
  const init = await fetchJson(`${apiBase()}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`, {
    method: "POST",
    provider: PROVIDER,
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(bytes.byteLength),
      "X-Upload-Content-Type": contentType || "video/mp4",
    },
    body: JSON.stringify(metadata),
    timeoutMs: 60_000,
  });
  const sessionUrl = init.headers.get("location");
  if (!sessionUrl) throw new SocialApiError(PROVIDER, 502, "YouTube did not return an upload session URL.");

  let offset = 0;
  let finalData: Record<string, unknown> = {};
  while (offset < bytes.byteLength) {
    const end = Math.min(offset + CHUNK, bytes.byteLength);
    const chunk = bytes.subarray(offset, end);
    const res = await fetchJson(sessionUrl, {
      method: "PUT",
      provider: PROVIDER,
      headers: {
        "Content-Type": contentType || "video/mp4",
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${offset}-${end - 1}/${bytes.byteLength}`,
      },
      body: chunk,
      timeoutMs: 120_000,
      okStatuses: [308], // Resume Incomplete
    });
    if (res.status === 308) {
      const range = res.headers.get("range"); // e.g. bytes=0-5242879
      const m = range?.match(/bytes=(\d+)-(\d+)/);
      offset = m ? Number(m[2]) + 1 : end;
      continue;
    }
    finalData = res.data;
    offset = end;
  }
  return finalData;
}

export const youtubeIntegration: PlatformIntegration = {
  check: (bag) => checkCredentials("youtube-shorts", bag),
  test: async (bag) => {
    const check = checkCredentials("youtube-shorts", bag);
    const base = { platformId: "youtube-shorts", provider: PROVIDER, configured: check.configured, missing: check.missing, source: check.source, checkedAt: new Date().toISOString() };
    if (!check.configured) return { ...base, ok: false, message: "Add Google credentials / YouTube refresh token (or Connect), then test." };
    try {
      const token = await googleAccessToken(bag);
      const { data } = await fetchJson(`${apiBase()}/youtube/v3/channels?part=snippet&mine=true`, { provider: PROVIDER, headers: authHeaders(token) });
      const items = Array.isArray(data.items) ? data.items : [];
      const title = str(asRecord(asRecord(items[0]).snippet).title);
      if (!items.length) return { ...base, ok: false, message: "Token works but this Google account has no YouTube channel." };
      return { ...base, ok: true, account: title, message: "YouTube connection OK." };
    } catch (err) {
      return { ...base, ok: false, message: "YouTube rejected the test call (check YouTube Data API v3 is enabled + token scope).", error: errMessage(err) };
    }
  },
  publish: async (post, bag, opts) => {
    const check = checkCredentials(post.platformId, bag);
    if (!check.configured) {
      return { ok: false, state: "not_configured", platformId: post.platformId, provider: PROVIDER, message: `Not configured. Missing: ${check.missing.join("; ")}. See TESTING.md — meanwhile upload free in YouTube Studio.`, error: `Missing: ${check.missing.join(", ")}`, warnings: [] };
    }
    const media = mediaList(post);
    if (media.length === 0 || !looksLikeVideo(media[0])) {
      return { ok: false, state: "failed", platformId: post.platformId, provider: PROVIDER, message: "YouTube needs a video file. Record it, host it at a public URL, and paste it in Media URLs (.mp4/.mov).", error: "VIDEO_REQUIRED", warnings: [] };
    }
    const privacy = (env("YOUTUBE_PRIVACY") || "private").toLowerCase();
    const title = titleFor(post, 100);
    const baseDesc = (post.caption || post.content || "").trim();
    const description = truncate([baseDesc, "#Shorts", cleanTags(post.hashtags).join(" ")].filter(Boolean).join("\n\n"), 4900);
    const metadata = {
      snippet: {
        title,
        description,
        tags: cleanTags(post.hashtags).map((t) => t.replace(/^#/, "")).slice(0, 15),
        categoryId: env("YOUTUBE_CATEGORY_ID") || "22",
      },
      status: {
        privacyStatus: ["public", "unlisted", "private"].includes(privacy) ? privacy : "private",
        selfDeclaredMadeForKids: env("YOUTUBE_MADE_FOR_KIDS") === "true",
      },
    };
    if (opts.dryRun) {
      return { ok: true, state: "dry_run", platformId: post.platformId, provider: PROVIDER, message: `Dry run OK — would upload as ${metadata.status.privacyStatus}. Nothing was posted.`, warnings: metadata.status.privacyStatus !== "public" ? [`Privacy is "${metadata.status.privacyStatus}" (safe default). Set YOUTUBE_PRIVACY=public when ready.`] : [], planned: { ...metadata, videoUrl: media[0] } };
    }
    try {
      const token = await googleAccessToken(bag);
      const { bytes, contentType } = await downloadMedia(media[0], PROVIDER, Number(env("YOUTUBE_MAX_UPLOAD_MB") || 100));
      const data = await resumableUpload(token, metadata, bytes, contentType.startsWith("video/") ? contentType : "video/mp4");
      const videoId = str(data.id);
      if (!videoId) throw new SocialApiError(PROVIDER, 502, "Upload finished but YouTube returned no video id — NOT marking published. Check YouTube Studio.");
      return {
        ok: true, state: "published", platformId: post.platformId, provider: PROVIDER,
        platformPostId: videoId,
        platformUrl: `https://www.youtube.com/shorts/${videoId}`,
        message: `Uploaded to YouTube ✅ (privacy: ${metadata.status.privacyStatus})`,
        warnings: metadata.status.privacyStatus !== "public" ? ["Video is not public yet — flip YOUTUBE_PRIVACY=public or publish it in YouTube Studio."] : [],
      };
    } catch (err) {
      return { ok: false, state: "failed", platformId: post.platformId, provider: PROVIDER, message: "YouTube upload failed. Post was NOT marked published.", error: errMessage(err), warnings: [] };
    }
  },
  metrics: async (post, bag) => {
    if (!post.externalId) return { platformId: post.platformId, ok: false, message: "Needs a published YouTube video id." };
    try {
      const token = await googleAccessToken(bag);
      const { data } = await fetchJson(`${apiBase()}/youtube/v3/videos?part=statistics&id=${encodeURIComponent(post.externalId)}`, { provider: PROVIDER, headers: authHeaders(token) });
      const items = Array.isArray(data.items) ? data.items : [];
      const stats = asRecord(asRecord(items[0]).statistics);
      if (!items.length) return { platformId: post.platformId, ok: false, message: "Video not found (deleted or wrong channel token)." };
      return {
        platformId: post.platformId, ok: true,
        metrics: { views: num(stats.viewCount), likes: num(stats.likeCount), comments: num(stats.commentCount) },
        message: "YouTube metrics fetched (shares/saves are not exposed by the API → N/A).",
      };
    } catch (err) {
      return { platformId: post.platformId, ok: false, message: "YouTube metrics fetch failed.", error: errMessage(err) };
    }
  },
};
