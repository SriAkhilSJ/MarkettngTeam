import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { env } from "./http";
import type { OAuthProvider, StoredToken, TokenBag } from "./types";

/**
 * OAuth token storage for this single-user app.
 * Tokens are AES-256-GCM encrypted into ONE httpOnly cookie.
 * Set SESSION_SECRET (32+ random chars) in .env.local / Vercel —
 * without it a built-in dev key is used (fine locally, weak in production).
 * Env-var tokens always take precedence over these stored tokens.
 */

const COOKIE = "auto_social_tokens";
const STATE_COOKIE = "auto_oauth_state";

function key(): Buffer {
  const secret = env("SESSION_SECRET") || env("TOKEN_ENCRYPTION_KEY") || "auto-dev-secret-change-me-in-production";
  return createHash("sha256").update(secret).digest();
}

export function hasCustomSecret(): boolean {
  return Boolean(env("SESSION_SECRET") || env("TOKEN_ENCRYPTION_KEY"));
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decrypt(blob: string): string | null {
  try {
    const buf = Buffer.from(blob, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function getStoredTokens(): Promise<TokenBag> {
  try {
    const store = await cookies();
    const raw = store.get(COOKIE)?.value;
    if (!raw) return {};
    const json = decrypt(raw);
    if (!json) return {};
    const parsed = JSON.parse(json) as TokenBag;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeBag(bag: TokenBag): Promise<void> {
  const store = await cookies();
  const value = encrypt(JSON.stringify(bag));
  store.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 60, // 60 days (tokens have their own expiry)
  });
}

export async function saveStoredToken(provider: OAuthProvider, token: StoredToken): Promise<void> {
  const bag = await getStoredTokens();
  bag[provider] = { ...(bag[provider] || {}), ...token };
  await writeBag(bag);
}

export async function clearStoredToken(provider: OAuthProvider): Promise<void> {
  const bag = await getStoredTokens();
  delete bag[provider];
  await writeBag(bag);
}

/* ---------------- OAuth state / PKCE ---------------- */

export interface OAuthState {
  provider: OAuthProvider;
  state: string;
  codeVerifier?: string;
  createdAt: number;
}

export async function saveOAuthState(s: OAuthState): Promise<void> {
  const store = await cookies();
  store.set(STATE_COOKIE, encrypt(JSON.stringify(s)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
  });
}

export async function takeOAuthState(): Promise<OAuthState | null> {
  const store = await cookies();
  const raw = store.get(STATE_COOKIE)?.value;
  if (!raw) return null;
  store.delete(STATE_COOKIE);
  const json = decrypt(raw);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as OAuthState;
    if (Date.now() - parsed.createdAt > 10 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}
