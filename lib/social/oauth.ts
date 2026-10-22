import { createHash, randomBytes } from "crypto";
import { oauthConfigured } from "./credentials";
import { SocialApiError, asRecord, basicAuth, env, envBase, fetchJson, form, num, str } from "./http";
import type { OAuthProvider, StoredToken } from "./types";

/**
 * OAuth 2.0 authorization-code flows for the "Connect" buttons.
 * You only need this OR env-var access tokens — env tokens win when both exist.
 * Register EXACTLY this redirect URI in each platform's app settings:
 *   {APP_URL}/api/oauth/{provider}/callback
 */

export const OAUTH_PROVIDERS: OAuthProvider[] = ["meta", "threads", "google", "linkedin", "tiktok", "x", "pinterest", "reddit"];

export function appBase(requestOrigin?: string): string {
  return (env("OAUTH_REDIRECT_BASE_URL") || env("NEXT_PUBLIC_APP_URL") || requestOrigin || "http://localhost:3000").replace(/\/+$/, "");
}

export function redirectUri(provider: OAuthProvider, requestOrigin?: string): string {
  return `${appBase(requestOrigin)}/api/oauth/${provider}/callback`;
}

function metaVersion(): string {
  return env("META_GRAPH_VERSION") || "v25.0";
}
function metaRoot(): string {
  return envBase("META_GRAPH_BASE", `https://graph.facebook.com/${metaVersion()}`);
}
function threadsHost(): string {
  return envBase("THREADS_GRAPH_BASE", "https://graph.threads.net/v1.0").replace(/\/v1\.0$/, "");
}

export function newState(): string {
  return randomBytes(24).toString("base64url");
}
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizeUrl(provider: OAuthProvider, state: string, redirect: string, codeChallenge?: string): string {
  const q = (params: Record<string, string>) => new URLSearchParams(params).toString();
  switch (provider) {
    case "meta": {
      const scope = env("META_OAUTH_SCOPES") || "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement";
      const authBase = envBase("META_AUTH_BASE", `https://www.facebook.com/${metaVersion()}`);
      return `${authBase}/dialog/oauth?${q({ client_id: env("META_APP_ID") || "", redirect_uri: redirect, response_type: "code", scope, state })}`;
    }
    case "threads": {
      const clientId = env("THREADS_APP_ID") || env("META_APP_ID") || "";
      const scope = env("THREADS_OAUTH_SCOPES") || "threads_basic,threads_content_publish,threads_manage_insights";
      const authBase = envBase("THREADS_AUTH_BASE", "https://threads.net");
      return `${authBase}/oauth/authorize?${q({ client_id: clientId, redirect_uri: redirect, response_type: "code", scope, state })}`;
    }
    case "google": {
      const scope = env("GOOGLE_OAUTH_SCOPES") || "openid https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";
      const authBase = envBase("GOOGLE_AUTH_BASE", "https://accounts.google.com");
      return `${authBase}/o/oauth2/v2/auth?${q({ client_id: env("GOOGLE_CLIENT_ID") || "", redirect_uri: redirect, response_type: "code", scope, access_type: "offline", prompt: "consent", state })}`;
    }
    case "linkedin": {
      const scope = env("LINKEDIN_OAUTH_SCOPES") || "openid profile email w_member_social";
      const authBase = envBase("LINKEDIN_AUTH_BASE", "https://www.linkedin.com");
      return `${authBase}/oauth/v2/authorization?${q({ response_type: "code", client_id: env("LINKEDIN_CLIENT_ID") || "", redirect_uri: redirect, scope, state })}`;
    }
    case "tiktok": {
      const scope = env("TIKTOK_OAUTH_SCOPES") || "user.info.basic,video.publish,video.upload,video.list";
      const authBase = envBase("TIKTOK_AUTH_BASE", "https://www.tiktok.com");
      return `${authBase}/v2/auth/authorize/?${q({ client_key: env("TIKTOK_CLIENT_KEY") || "", scope, response_type: "code", redirect_uri: redirect, state })}`;
    }
    case "x": {
      const scope = env("X_OAUTH_SCOPES") || "tweet.read tweet.write users.read offline.access";
      const authBase = envBase("X_AUTH_BASE", "https://twitter.com");
      return `${authBase}/i/oauth2/authorize?${q({ response_type: "code", client_id: env("X_CLIENT_ID") || "", redirect_uri: redirect, scope, state, code_challenge: codeChallenge || "", code_challenge_method: "S256" })}`;
    }
    case "pinterest": {
      const scope = env("PINTEREST_OAUTH_SCOPES") || "boards:read,boards:write,pins:read,pins:write,user_accounts:read";
      const authBase = envBase("PINTEREST_AUTH_BASE", "https://www.pinterest.com");
      return `${authBase}/oauth/?${q({ client_id: env("PINTEREST_APP_ID") || "", redirect_uri: redirect, response_type: "code", scope, state })}`;
    }
    case "reddit": {
      const scope = env("REDDIT_OAUTH_SCOPES") || "identity submit read";
      const authBase = envBase("REDDIT_AUTH_BASE", "https://www.reddit.com");
      return `${authBase}/api/v1/authorize?${q({ client_id: env("REDDIT_CLIENT_ID") || "", response_type: "code", state, redirect_uri: redirect, duration: "permanent", scope })}`;
    }
  }
}

function toStored(data: Record<string, unknown>): StoredToken {
  const access = str(data.access_token);
  if (!access) throw new Error("Token response contained no access_token.");
  const expiresIn = num(data.expires_in);
  return {
    accessToken: access,
    refreshToken: str(data.refresh_token),
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    scope: str(data.scope),
  };
}

async function exchange(provider: OAuthProvider, code: string, redirect: string, codeVerifier?: string): Promise<StoredToken> {
  switch (provider) {
    case "meta": {
      const { data } = await fetchJson(`${metaRoot()}/oauth/access_token`, {
        method: "POST", provider,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form({ client_id: env("META_APP_ID") || "", client_secret: env("META_APP_SECRET") || "", redirect_uri: redirect, code }),
      });
      let token = toStored(data);
      // Best-effort: upgrade to a ~60-day long-lived token.
      try {
        const ll = await fetchJson(`${metaRoot()}/oauth/access_token?${form({ grant_type: "fb_exchange_token", client_id: env("META_APP_ID") || "", client_secret: env("META_APP_SECRET") || "", fb_exchange_token: token.accessToken })}`, { provider });
        token = { ...token, ...toStored(ll.data) };
      } catch { /* keep short-lived token */ }
      // Best-effort: discover the IG business account id.
      try {
        const pages = await fetchJson(`${metaRoot()}/me/accounts?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(token.accessToken)}`, { provider });
        const rows = Array.isArray(pages.data.data) ? pages.data.data : [];
        for (const r of rows) {
          const ig = asRecord(asRecord(r).instagram_business_account);
          if (str(ig.id)) { token.accountId = str(ig.id); token.accountName = str(ig.username); break; }
        }
      } catch { /* user can set INSTAGRAM_BUSINESS_ACCOUNT_ID manually */ }
      return token;
    }
    case "threads": {
      const clientId = env("THREADS_APP_ID") || env("META_APP_ID") || "";
      const secret = env("THREADS_APP_SECRET") || env("META_APP_SECRET") || "";
      const { data } = await fetchJson(`${threadsHost()}/oauth/access_token`, {
        method: "POST", provider,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form({ client_id: clientId, client_secret: secret, grant_type: "authorization_code", redirect_uri: redirect, code }),
      });
      let token = toStored(data);
      token.accountId = str(data.user_id);
      try {
        const ll = await fetchJson(`${threadsHost()}/access_token?${form({ grant_type: "th_exchange_token", client_secret: secret, access_token: token.accessToken })}`, { provider });
        token = { ...token, ...toStored(ll.data), accountId: token.accountId };
      } catch { /* keep short-lived */ }
      return token;
    }
    case "google": {
      const { data } = await fetchJson(env("GOOGLE_TOKEN_URL") || "https://oauth2.googleapis.com/token", {
        method: "POST", provider,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form({ client_id: env("GOOGLE_CLIENT_ID") || "", client_secret: env("GOOGLE_CLIENT_SECRET") || "", code, grant_type: "authorization_code", redirect_uri: redirect }),
      });
      return toStored(data);
    }
    case "linkedin": {
      const { data } = await fetchJson(env("LINKEDIN_TOKEN_URL") || "https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST", provider,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form({ grant_type: "authorization_code", code, redirect_uri: redirect, client_id: env("LINKEDIN_CLIENT_ID") || "", client_secret: env("LINKEDIN_CLIENT_SECRET") || "" }),
      });
      const token = toStored(data);
      try {
        const api = envBase("LINKEDIN_API_BASE", "https://api.linkedin.com");
        const me = await fetchJson(`${api}/v2/userinfo`, { provider, headers: { Authorization: `Bearer ${token.accessToken}` } });
        token.accountId = str(me.data.sub);
        token.accountName = str(me.data.name);
      } catch { /* discovered later at publish */ }
      return token;
    }
    case "tiktok": {
      const api = envBase("TIKTOK_API_BASE", "https://open.tiktokapis.com");
      const { data } = await fetchJson(`${api}/v2/oauth/token/`, {
        method: "POST", provider,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form({ client_key: env("TIKTOK_CLIENT_KEY") || "", client_secret: env("TIKTOK_CLIENT_SECRET") || "", code: decodeURIComponent(code), grant_type: "authorization_code", redirect_uri: redirect }),
      });
      return toStored(data);
    }
    case "x": {
      const clientId = env("X_CLIENT_ID") || "";
      const clientSecret = env("X_CLIENT_SECRET");
      const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
      if (clientSecret) headers.Authorization = basicAuth(clientId, clientSecret);
      const { data } = await fetchJson(env("X_TOKEN_URL") || `${envBase("X_API_BASE", "https://api.x.com")}/2/oauth2/token`, {
        method: "POST", provider, headers,
        body: form({ grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: codeVerifier || "", client_id: clientId }),
      });
      return toStored(data);
    }
    case "pinterest": {
      const apiHost = (env("PINTEREST_ENV") || "").toLowerCase() === "sandbox" && !env("PINTEREST_API_BASE")
        ? "https://api-sandbox.pinterest.com"
        : envBase("PINTEREST_API_BASE", "https://api.pinterest.com");
      const { data } = await fetchJson(`${apiHost}/v5/oauth/token`, {
        method: "POST", provider,
        headers: { Authorization: basicAuth(env("PINTEREST_APP_ID") || "", env("PINTEREST_APP_SECRET") || ""), "Content-Type": "application/x-www-form-urlencoded" },
        body: form({ grant_type: "authorization_code", code, redirect_uri: redirect }),
      });
      return toStored(data);
    }
    case "reddit": {
      const host = envBase("REDDIT_API_BASE", "https://www.reddit.com");
      const { data } = await fetchJson(`${host}/api/v1/access_token`, {
        method: "POST", provider,
        headers: {
          Authorization: basicAuth(env("REDDIT_CLIENT_ID") || "", env("REDDIT_CLIENT_SECRET") || ""),
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": env("REDDIT_USER_AGENT") || "web:auto-marketing-team:v0.2.0 (AUTO socials app)",
        },
        body: form({ grant_type: "authorization_code", code, redirect_uri: redirect }),
      });
      return toStored(data);
    }
  }
}

export async function exchangeCode(provider: OAuthProvider, code: string, redirect: string, codeVerifier?: string): Promise<StoredToken> {
  const gate = oauthConfigured(provider);
  if (!gate.ok) throw new SocialApiError(provider, 400, `OAuth is not configured for ${provider}. Missing: ${gate.missing.join(", ")}`);
  return exchange(provider, code, redirect, codeVerifier);
}
