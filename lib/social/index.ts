import { PLATFORMS } from "../platforms";
import type { Post } from "../types";
import { PLATFORM_PROVIDER, oauthConfigured } from "./credentials";
import { linkedinIntegration } from "./linkedin";
import { instagramIntegration, threadsIntegration } from "./meta";
import { redirectUri } from "./oauth";
import { pinterestIntegration } from "./pinterest";
import { redditIntegration } from "./reddit";
import { tiktokIntegration } from "./tiktok";
import { hasCustomSecret } from "./tokenStore";
import type { PlatformIntegration, PublishOptions, TokenBag } from "./types";
import { xIntegration } from "./x";
import { youtubeIntegration } from "./youtube";

export * from "./types";
export { getStoredTokens, hasCustomSecret } from "./tokenStore";

const INTEGRATIONS: Record<string, PlatformIntegration> = {
  "instagram-carousel": instagramIntegration("instagram-carousel"),
  "instagram-reel": instagramIntegration("instagram-reel"),
  threads: threadsIntegration,
  "youtube-shorts": youtubeIntegration,
  linkedin: linkedinIntegration,
  tiktok: tiktokIntegration,
  x: xIntegration,
  pinterest: pinterestIntegration,
  reddit: redditIntegration,
};

export const INTEGRATION_META: Record<string, { docsUrl: string; capabilities: string; media: string }> = {
  "instagram-carousel": { docsUrl: "https://developers.facebook.com/docs/instagram-platform/content-publishing/", capabilities: "Single image or 2–10 item carousel via container flow. Business/Creator account + App Review.", media: "Public image URL(s) required (JPG)" },
  "instagram-reel": { docsUrl: "https://developers.facebook.com/docs/instagram-platform/content-publishing/", capabilities: "Reel via REELS container + processing poll. Business/Creator account + App Review.", media: "Public video URL required (MP4/MOV)" },
  threads: { docsUrl: "https://developers.facebook.com/documentation/threads/posts", capabilities: "Text, image, video or carousel. 500-char limit. App Review for real accounts.", media: "Optional public image/video URL(s)" },
  "youtube-shorts": { docsUrl: "https://developers.google.com/youtube/v3/docs/videos/insert", capabilities: "Resumable upload (videos.insert). Shorts = vertical/square ≤3 min. Privacy default: private.", media: "Public video URL (downloaded + uploaded by server)" },
  linkedin: { docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api", capabilities: "Text post + optional single image. Own-profile posting is self-serve (w_member_social).", media: "Optional public image URL" },
  tiktok: { docsUrl: "https://developers.tiktok.com/docs/en/content-posting-api-get-started", capabilities: "Direct Post video/photo. creator_info checked first. Unaudited = private (SELF_ONLY) only.", media: "Public video URL (or photo URLs)" },
  x: { docsUrl: "https://docs.x.com/x-api/posts/manage-tweets/integrate", capabilities: "Single post or chained thread + optional images. ⚠️ PAY-PER-USE API.", media: "Optional image URL(s); video → post manually" },
  pinterest: { docsUrl: "https://developers.pinterest.com/docs/api/v5/pins-create/", capabilities: "Image pin to a board (single or multiple images). Trial = sandbox/hidden pins.", media: "Public image URL(s) required" },
  reddit: { docsUrl: "https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki", capabilities: "Self or link post to one subreddit. Needs pre-approved app (new apps are gated). Manual recommended.", media: "Text/link only" },
};

export function getIntegration(platformId: string): PlatformIntegration | undefined {
  return INTEGRATIONS[platformId];
}

export interface IntegrationStatus {
  platformId: string;
  platformName: string;
  provider: string;
  configured: boolean;
  missing: string[];
  source?: string;
  oauth: { provider: string; configured: boolean; missing: string[]; connected: boolean; redirectUri: string };
  docsUrl: string;
  capabilities: string;
  media: string;
  apiCost: string;
}

export function getStatuses(bag: TokenBag, requestOrigin?: string): IntegrationStatus[] {
  return PLATFORMS.map((p) => {
    const integration = INTEGRATIONS[p.id];
    const check = integration.check(bag);
    const provider = PLATFORM_PROVIDER[p.id];
    const oauthGate = oauthConfigured(provider);
    const meta = INTEGRATION_META[p.id];
    return {
      platformId: p.id,
      platformName: p.name,
      provider,
      configured: check.configured,
      missing: check.missing,
      source: check.source,
      oauth: {
        provider,
        configured: oauthGate.ok,
        missing: oauthGate.missing,
        connected: Boolean(bag[provider]?.accessToken || bag[provider]?.refreshToken),
        redirectUri: redirectUri(provider, requestOrigin),
      },
      docsUrl: meta.docsUrl,
      capabilities: meta.capabilities,
      media: meta.media,
      apiCost: p.apiCost,
    };
  });
}

export function publishPost(post: Post, bag: TokenBag, opts: PublishOptions = {}) {
  const integration = getIntegration(post.platformId);
  if (!integration) {
    return Promise.resolve({
      ok: false, state: "failed" as const, platformId: post.platformId, provider: "unknown",
      message: `No integration built for ${post.platformId}.`, error: "UNKNOWN_PLATFORM", warnings: [],
    });
  }
  return integration.publish(post, bag, opts);
}

export function testConnection(platformId: string, bag: TokenBag) {
  const integration = getIntegration(platformId);
  if (!integration) {
    return Promise.resolve({
      platformId, provider: "unknown", configured: false, ok: false,
      missing: [`Unknown platform ${platformId}`], message: "Unknown platform.", checkedAt: new Date().toISOString(),
    });
  }
  return integration.test(bag);
}

export function fetchMetrics(post: Post, bag: TokenBag) {
  const integration = getIntegration(post.platformId);
  if (!integration) {
    return Promise.resolve({ platformId: post.platformId, ok: false, message: `No integration built for ${post.platformId}.` });
  }
  return integration.metrics(post, bag);
}

export function socialSummary(bag: TokenBag) {
  const statuses = getStatuses(bag);
  return {
    configuredCount: statuses.filter((s) => s.configured).length,
    total: statuses.length,
    sessionSecretSet: hasCustomSecret(),
  };
}
