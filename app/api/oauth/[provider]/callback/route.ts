import { NextResponse } from "next/server";
import { errMessage } from "@/lib/social/http";
import { exchangeCode, redirectUri, OAUTH_PROVIDERS } from "@/lib/social/oauth";
import { saveStoredToken, takeOAuthState } from "@/lib/social/tokenStore";
import type { OAuthProvider } from "@/lib/social/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** OAuth redirect target. Register this exact URL in each platform app:
 *  {APP_URL}/api/oauth/{provider}/callback */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const origin = url.origin;
  const back = (params: string) => NextResponse.redirect(new URL(`/?tab=integrations&${params}`, origin));

  if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
    return back(`oauthError=${encodeURIComponent(`Unknown provider ${provider}`)}`);
  }
  const p = provider as OAuthProvider;

  const oauthError = url.searchParams.get("error") || url.searchParams.get("error_description");
  if (oauthError) return back(`oauthError=${encodeURIComponent(`${p}: ${oauthError}`)}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  if (!code) return back(`oauthError=${encodeURIComponent(`${p}: no authorization code returned`)}`);

  const saved = await takeOAuthState();
  if (!saved || saved.provider !== p || saved.state !== state) {
    return back(`oauthError=${encodeURIComponent(`${p}: state check failed (expired or mismatched). Click Connect again.`)}`);
  }

  try {
    const token = await exchangeCode(p, code, redirectUri(p, origin), saved.codeVerifier);
    await saveStoredToken(p, token);
    return back(`connected=${encodeURIComponent(p)}`);
  } catch (err) {
    return back(`oauthError=${encodeURIComponent(`${p} connect failed: ${errMessage(err)}`)}`);
  }
}
