import { NextResponse } from "next/server";
import { fetchMetrics, getStoredTokens } from "@/lib/social";
import { assertPublishAllowed } from "@/lib/social/guard";
import { sanitizePost } from "@/lib/social/sanitize";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Fetch REAL metrics for a published post. Unavailable metrics stay absent (N/A) — never invented. */
export async function POST(req: Request) {
  const guard = await assertPublishAllowed();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const post = sanitizePost(body.post);
  if (!post) return NextResponse.json({ error: "A valid post object is required" }, { status: 400 });
  if (!post.externalId) {
    return NextResponse.json({ error: "This post has no platform post id yet. Publish it via API first (manual posts: type the numbers in from the app's analytics)." }, { status: 400 });
  }
  const bag = await getStoredTokens();
  const result = await fetchMetrics(post, bag);
  return NextResponse.json({ result });
}
