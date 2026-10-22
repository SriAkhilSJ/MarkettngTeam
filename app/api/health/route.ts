import { NextResponse } from "next/server";
import { getProviderStatus } from "@/lib/ai";
import { getStoredTokens, socialSummary } from "@/lib/social";
import { publishSecretRequired } from "@/lib/social/guard";

export const dynamic = "force-dynamic";

/** Returns which providers are configured (booleans only — never secrets). */
export async function GET() {
  const status = getProviderStatus();
  const bag = await getStoredTokens();
  return NextResponse.json({
    ok: true,
    provider: status.provider,
    demoMode: status.demoMode,
    configured: status.configured,
    social: socialSummary(bag),
    publishSecretRequired: publishSecretRequired(),
    hint: status.demoMode
      ? "Demo mode (free, no key). Add ONE free key — GEMINI_API_KEY or GROQ_API_KEY — in .env.local for real AI. See CREDENTIALS.md."
      : `Using AI provider: ${status.provider}`,
  });
}
