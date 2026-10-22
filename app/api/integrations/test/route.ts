import { NextResponse } from "next/server";
import { getStoredTokens, testConnection } from "@/lib/social";
import { assertPublishAllowed } from "@/lib/social/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(platformId: string) {
  const guard = await assertPublishAllowed();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!platformId) return NextResponse.json({ error: "platformId is required" }, { status: 400 });
  const bag = await getStoredTokens();
  const result = await testConnection(platformId, bag);
  return NextResponse.json({ result });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  return run(typeof body.platformId === "string" ? body.platformId : "");
}

export async function GET(req: Request) {
  return run(new URL(req.url).searchParams.get("platformId") || "");
}
