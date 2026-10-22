import { NextResponse } from "next/server";
import { assertPublishAllowed } from "@/lib/social/guard";
import { OAUTH_PROVIDERS } from "@/lib/social/oauth";
import { clearStoredToken } from "@/lib/social/tokenStore";
import type { OAuthProvider } from "@/lib/social/types";

export const dynamic = "force-dynamic";

/** Remove the OAuth-stored token for a provider (env-var tokens are unaffected). */
export async function POST(_req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const guard = await assertPublishAllowed();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { provider } = await ctx.params;
  if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
    return NextResponse.json({ error: `Unknown provider ${provider}` }, { status: 400 });
  }
  await clearStoredToken(provider as OAuthProvider);
  return NextResponse.json({ ok: true, message: `Disconnected ${provider} (OAuth token removed from this browser session cookie).` });
}
