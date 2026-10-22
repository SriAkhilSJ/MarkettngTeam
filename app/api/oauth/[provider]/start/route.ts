import { NextResponse } from "next/server";
import { authorizeUrl, newState, pkcePair, redirectUri, OAUTH_PROVIDERS } from "@/lib/social/oauth";
import { oauthConfigured } from "@/lib/social/credentials";
import { saveOAuthState } from "@/lib/social/tokenStore";
import type { OAuthProvider } from "@/lib/social/types";

export const dynamic = "force-dynamic";

/** Kick off an OAuth "Connect" flow: /api/oauth/{provider}/start */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const origin = new URL(req.url).origin;
  if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
    return NextResponse.redirect(new URL(`/?tab=integrations&oauthError=${encodeURIComponent(`Unknown provider ${provider}`)}`, origin));
  }
  const p = provider as OAuthProvider;
  const gate = oauthConfigured(p);
  if (!gate.ok) {
    return NextResponse.redirect(new URL(`/?tab=integrations&oauthError=${encodeURIComponent(`Cannot connect ${p}: missing ${gate.missing.join(", ")} in .env.local`)}`, origin));
  }
  const state = newState();
  let challenge: string | undefined;
  let verifier: string | undefined;
  if (p === "x") {
    const pair = pkcePair();
    verifier = pair.verifier;
    challenge = pair.challenge;
  }
  await saveOAuthState({ provider: p, state, codeVerifier: verifier, createdAt: Date.now() });
  const url = authorizeUrl(p, state, redirectUri(p, origin), challenge);
  return NextResponse.redirect(url);
}
