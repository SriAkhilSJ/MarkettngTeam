import { NextResponse } from "next/server";
import { generateContent } from "@/lib/ai";
import { PLATFORMS } from "@/lib/platforms";
import type { Goal, IdeaInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GOALS: Goal[] = ["educate", "engage", "sell", "grow"];

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic = String(body.topic || "").trim();
  const audience = String(body.audience || "").trim();
  const cta = String(body.cta || "").trim();
  const tone = String(body.tone || "direct and punchy").trim();
  const goal = GOALS.includes(body.goal as Goal) ? (body.goal as Goal) : "educate";

  const validIds = new Set(PLATFORMS.map((p) => p.id));
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.map(String).filter((id) => validIds.has(id))
    : [];

  if (!topic) return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  if (topic.length > 300) return NextResponse.json({ error: "Topic too long (max 300 chars)" }, { status: 400 });
  if (platforms.length === 0)
    return NextResponse.json({ error: "Select at least one platform" }, { status: 400 });

  const input: IdeaInput = { topic, audience: audience || "creators and entrepreneurs", goal, cta: cta || "Save this for later", tone, platforms };

  try {
    const result = await generateContent(input);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
