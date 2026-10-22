import { NextResponse } from "next/server";
import { getStoredTokens, publishPost } from "@/lib/social";
import { assertPublishAllowed } from "@/lib/social/guard";
import { sanitizePost } from "@/lib/social/sanitize";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // uploads/polling can be slow

/**
 * Publish ONE post through its official API integration.
 * Rules (from the AUTO system):
 * - Human approval is mandatory: post.status must be APPROVED or SCHEDULED (dry runs exempt).
 * - PUBLISHED is returned ONLY when the platform confirms with a post id.
 * - Failures are explicit (FAILED), never silently retried.
 */
export async function POST(req: Request) {
  const guard = await assertPublishAllowed();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dryRun = body.dryRun === true;
  const post = sanitizePost(body.post);
  if (!post) return NextResponse.json({ error: "A valid post object with platformId is required" }, { status: 400 });

  if (!dryRun && post.status !== "APPROVED" && post.status !== "SCHEDULED") {
    return NextResponse.json(
      { error: `Human approval required: set this post to APPROVED (or SCHEDULED) before publishing. Current status: ${post.status}` },
      { status: 400 }
    );
  }
  if (!dryRun && post.status === "PUBLISHED") {
    return NextResponse.json({ error: "Already published. Re-posting is blocked to avoid duplicates." }, { status: 400 });
  }

  const bag = await getStoredTokens();
  const result = await publishPost(post, bag, { dryRun });
  const now = new Date().toISOString();

  // Patch the client applies to its local post. Honest statuses only.
  let postPatch: Record<string, string | undefined> = {};
  if (result.state === "published") {
    postPatch = {
      status: "PUBLISHED",
      externalId: result.platformPostId,
      externalUrl: result.platformUrl || "",
      publishedAt: now,
      publishError: "",
      lastPublishAttemptAt: now,
    };
  } else if (result.state === "processing") {
    postPatch = {
      status: "SCHEDULED",
      externalId: result.platformPostId,
      publishError: "",
      lastPublishAttemptAt: now,
    };
  } else if (result.state === "failed") {
    postPatch = { status: "FAILED", publishError: result.error || result.message, lastPublishAttemptAt: now };
  } else if (result.state === "not_configured") {
    postPatch = { publishError: result.error || result.message, lastPublishAttemptAt: now };
  }

  return NextResponse.json({ result, postPatch });
}
