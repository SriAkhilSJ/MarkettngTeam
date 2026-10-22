import { env } from "./http";
import type { CredentialCheck, OAuthProvider, TokenBag } from "./types";

/**
 * Credential resolution. Order: explicit env tokens > OAuth (Connect) tokens.
 * Checks are network-free so the UI can show exactly what is missing.
 */

export const PLATFORM_PROVIDER: Record<string, OAuthProvider> = {
  "instagram-carousel": "meta",
  "instagram-reel": "meta",
  threads: "threads",
  "youtube-shorts": "google",
  linkedin: "linkedin",
  tiktok: "tiktok",
  x: "x",
  pinterest: "pinterest",
  reddit: "reddit",
};

export interface ResolvedToken {
  token?: string;
  source?: "env" | "oauth";
  refreshToken?: string;
}

export function resolveToken(
  bag: TokenBag,
  provider: OAuthProvider,
  envNames: string[],
  refreshEnvNames: string[] = []
): ResolvedToken {
  for (const name of envNames) {
    const v = env(name);
    if (v) {
      const refresh = refreshEnvNames.map((n) => env(n)).find(Boolean) || bag[provider]?.refreshToken;
      return { token: v, source: "env", refreshToken: refresh };
    }
  }
  const stored = bag[provider];
  if (stored?.accessToken) {
    // Expired access token with a refresh token is still "configured" —
    // publishers refresh before calling. Expired without refresh is also
    // reported so Test Connection can explain the failure honestly.
    return { token: stored.accessToken, source: "oauth", refreshToken: stored.refreshToken };
  }
  // Refresh-only setups (e.g. YouTube env refresh token) count as configured.
  for (const name of refreshEnvNames) {
    const v = env(name);
    if (v) return { refreshToken: v, source: "env" };
  }
  if (stored?.refreshToken) return { refreshToken: stored.refreshToken, source: "oauth" };
  return {};
}

function missingNames(names: string[]): string[] {
  return names.filter((n) => !env(n));
}

/** Network-free: could a publish be ATTEMPTED right now, and what's missing if not? */
export function checkCredentials(platformId: string, bag: TokenBag): CredentialCheck {
  switch (platformId) {
    case "instagram-carousel":
    case "instagram-reel": {
      const t = resolveToken(bag, "meta", ["META_ACCESS_TOKEN", "INSTAGRAM_ACCESS_TOKEN"]);
      const missing: string[] = [];
      if (!t.token) missing.push("META_ACCESS_TOKEN (or Connect)", "META_APP_ID, META_APP_SECRET (for Connect)");
      if (!env("INSTAGRAM_BUSINESS_ACCOUNT_ID") && !bag.meta?.accountId) missing.push("INSTAGRAM_BUSINESS_ACCOUNT_ID");
      return { configured: missing.length === 0, missing, source: t.source };
    }
    case "threads": {
      const t = resolveToken(bag, "threads", ["THREADS_ACCESS_TOKEN", "META_ACCESS_TOKEN"]);
      const missing = t.token ? [] : ["THREADS_ACCESS_TOKEN (or Connect)", "THREADS_APP_ID, THREADS_APP_SECRET (for Connect)"];
      return { configured: missing.length === 0, missing, source: t.source };
    }
    case "youtube-shorts": {
      const t = resolveToken(bag, "google", ["YOUTUBE_ACCESS_TOKEN"], ["YOUTUBE_REFRESH_TOKEN"]);
      const missing: string[] = [];
      if (t.refreshToken) {
        missing.push(...missingNames(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]));
      } else if (!t.token) {
        missing.push("YOUTUBE_REFRESH_TOKEN or YOUTUBE_ACCESS_TOKEN (or Connect)", "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET");
      }
      return { configured: missing.length === 0, missing, source: t.source };
    }
    case "linkedin": {
      const t = resolveToken(bag, "linkedin", ["LINKEDIN_ACCESS_TOKEN"], ["LINKEDIN_REFRESH_TOKEN"]);
      const missing = t.token || t.refreshToken ? [] : ["LINKEDIN_ACCESS_TOKEN (or Connect)", "LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET (for Connect)"];
      return { configured: missing.length === 0, missing, source: t.source };
    }
    case "tiktok": {
      const t = resolveToken(bag, "tiktok", ["TIKTOK_ACCESS_TOKEN"], ["TIKTOK_REFRESH_TOKEN"]);
      const missing = t.token || t.refreshToken ? [] : ["TIKTOK_ACCESS_TOKEN (or Connect)", "TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET (for Connect)"];
      return { configured: missing.length === 0, missing, source: t.source };
    }
    case "x": {
      const oauth1 = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"];
      const miss1 = missingNames(oauth1);
      const hasOAuth2 = Boolean(bag.x?.accessToken || bag.x?.refreshToken);
      if (miss1.length === 0) return { configured: true, missing: [], source: "env" };
      if (hasOAuth2) return { configured: true, missing: [], source: "oauth" };
      return {
        configured: false,
        missing: ["X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET (OAuth 1.0a) — or Connect via X_CLIENT_ID, X_CLIENT_SECRET"],
        source: undefined,
      };
    }
    case "pinterest": {
      const t = resolveToken(bag, "pinterest", ["PINTEREST_ACCESS_TOKEN"], ["PINTEREST_REFRESH_TOKEN"]);
      const missing = t.token || t.refreshToken ? [] : ["PINTEREST_ACCESS_TOKEN (or Connect)", "PINTEREST_APP_ID, PINTEREST_APP_SECRET (for Connect)"];
      return { configured: missing.length === 0, missing, source: t.source };
    }
    case "reddit": {
      const t = resolveToken(bag, "reddit", ["REDDIT_ACCESS_TOKEN"], ["REDDIT_REFRESH_TOKEN"]);
      if (t.token) return { configured: true, missing: [], source: t.source };
      const hasClient = Boolean(env("REDDIT_CLIENT_ID") && env("REDDIT_CLIENT_SECRET"));
      if (t.refreshToken && hasClient) return { configured: true, missing: [], source: t.source };
      if (hasClient && env("REDDIT_USERNAME") && env("REDDIT_PASSWORD")) return { configured: true, missing: [], source: "env" };
      return {
        configured: false,
        missing: ["REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET + (REDDIT_REFRESH_TOKEN or REDDIT_USERNAME + REDDIT_PASSWORD) — or Connect"],
      };
    }
    default:
      return { configured: false, missing: [`Unknown platform ${platformId}`] };
  }
}

/** Can the OAuth "Connect" button be used for this provider? */
export function oauthConfigured(provider: OAuthProvider): { ok: boolean; missing: string[] } {
  switch (provider) {
    case "meta":
      return gate(["META_APP_ID", "META_APP_SECRET"]);
    case "threads": {
      const id = env("THREADS_APP_ID") || env("META_APP_ID");
      const secret = env("THREADS_APP_SECRET") || env("META_APP_SECRET");
      return id && secret ? { ok: true, missing: [] } : { ok: false, missing: ["THREADS_APP_ID (or META_APP_ID)", "THREADS_APP_SECRET (or META_APP_SECRET)"] };
    }
    case "google":
      return gate(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
    case "linkedin":
      return gate(["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"]);
    case "tiktok":
      return gate(["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"]);
    case "x":
      return env("X_CLIENT_ID") ? { ok: true, missing: [] } : { ok: false, missing: ["X_CLIENT_ID"] };
    case "pinterest":
      return gate(["PINTEREST_APP_ID", "PINTEREST_APP_SECRET"]);
    case "reddit":
      return gate(["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"]);
  }
}

function gate(names: string[]): { ok: boolean; missing: string[] } {
  const missing = missingNames(names);
  return { ok: missing.length === 0, missing };
}
