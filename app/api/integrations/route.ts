import { NextResponse } from "next/server";
import { getProviderStatus } from "@/lib/ai";
import { getStatuses, getStoredTokens, socialSummary } from "@/lib/social";
import { publishSecretRequired } from "@/lib/social/guard";

export const dynamic = "force-dynamic";

/** Integration status for every platform. Booleans + missing names ONLY — never secret values. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const bag = await getStoredTokens();
  const ai = getProviderStatus();
  return NextResponse.json({
    ok: true,
    ai: { provider: ai.provider, demoMode: ai.demoMode, configured: ai.configured },
    publishSecretRequired: publishSecretRequired(),
    summary: socialSummary(bag),
    integrations: getStatuses(bag, origin),
    note: "configured = a publish can be ATTEMPTED (env token or OAuth Connect). Use Test Connection per platform to verify with the real API.",
  });
}
