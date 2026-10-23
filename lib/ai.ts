import { PLATFORMS, getPlatform } from "./platforms";
import { generateDemo } from "./demo";
import type { GenerationResult, IdeaInput, Post } from "./types";

/**
 * AI provider layer.
 * Priority: AI_PROVIDER env > Gemini > Groq > OpenRouter > OpenAI > demo.
 * Gemini + Groq both have FREE tiers (see CREDENTIALS.md).
 * No keys are ever returned to the client.
 */

export interface ProviderStatus {
  provider: string;
  demoMode: boolean;
  configured: Record<string, boolean>;
}

export function getProviderStatus(): ProviderStatus {
  const configured = {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };
  const forced = (process.env.AI_PROVIDER || "").toLowerCase();
  let provider = "demo";
  if (forced && forced !== "demo") provider = forced;
  else if (!forced) {
    if (configured.gemini) provider = "gemini";
    else if (configured.groq) provider = "groq";
    else if (configured.openrouter) provider = "openrouter";
    else if (configured.openai) provider = "openai";
  }
  return { provider, demoMode: provider === "demo", configured };
}

function buildPrompt(input: IdeaInput): string {
  const specs = input.platforms
    .map((id) => getPlatform(id))
    .filter(Boolean)
    .map(
      (p) =>
        `- ${p!.id} (${p!.name}, ${p!.format}): ${p!.wants} Caption formula: ${p!.captionFormula}. Default slot: ${p!.defaultDay} ${p!.defaultTime}. Publish mode: ${p!.publishMode}.`
    )
    .join("\n");

  return `You are my full social media system. I'm giving you one idea. Take it all the way to a ready-to-post week.

MY TOPIC: ${input.topic}
MY AUDIENCE: ${input.audience}
MY GOAL: ${input.goal}
MY TONE: ${input.tone}
MY CTA: ${input.cta}

PLATFORMS (only these):
${specs}

Work through: 1) sharpen the angle, 2) master content (HOOK/BODY/VALUE/CTA, 3 hook options), 3) one adapted version per platform with a DIFFERENT hook each, native tone, 4) caption per platform using its formula, 5) posting schedule, 6) three specific things to test next.

RULES:
- Short, practical, ready to use as-is. No filler, no corporate voice.
- Do not invent statistics, quotes or results. Flag anything to check in "notes".
- If a platform is a bad fit, say so in its "notes" instead of forcing it.
- Reddit: zero promo. X: give single post + thread in content.

Return ONLY valid JSON (no markdown fences) in EXACTLY this shape:
{
  "angle": "string",
  "master": { "hooks": ["h1","h2","h3"], "body": "string", "value": "string", "cta": "string" },
  "posts": [
    { "platformId": "one of the ids above", "hook": "string", "content": "string", "caption": "string", "hashtags": ["#tag"], "scheduledDay": "Monday", "scheduledTime": "09:00", "notes": "string" }
  ],
  "testsNext": ["string","string","string"],
  "warnings": ["string"]
}`;
}

async function callGemini(prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY || "",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenAICompatible(
  provider: "groq" | "openrouter" | "openai",
  prompt: string
): Promise<string> {
  const cfg = {
    groq: {
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY || "",
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    },
    openrouter: {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: process.env.OPENROUTER_API_KEY || "",
      model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
    },
    openai: {
      // Override OPENAI_BASE_URL to use any OpenAI-compatible gateway
      // (e.g. Velona: OPENAI_BASE_URL=https://velona.in/v1).
      url: `${(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "")}/chat/completions`,
      key: process.env.OPENAI_API_KEY || "",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    },
  }[provider];

  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.7,
      messages: [
        { role: "system", content: "You return only valid JSON. No markdown, no extra text." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${provider} API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

function parseResult(raw: string, input: IdeaInput, provider: string): GenerationResult {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI did not return JSON");
  const parsed = JSON.parse(cleaned.slice(start, end + 1));

  const posts: Post[] = (parsed.posts || [])
    .map((p: Record<string, unknown>, i: number) => {
      const spec = getPlatform(String(p.platformId || "")) || PLATFORMS.find((x) => x.id === input.platforms[i]);
      if (!spec) return null;
      return {
        id: `ai-${Date.now()}-${i}`,
        platformId: spec.id,
        platformName: spec.name,
        format: spec.format,
        hook: String(p.hook || ""),
        content: String(p.content || ""),
        caption: String(p.caption || ""),
        hashtags: Array.isArray(p.hashtags) ? p.hashtags.map(String) : [],
        scheduledDay: String(p.scheduledDay || spec.defaultDay),
        scheduledTime: String(p.scheduledTime || spec.defaultTime),
        publishMode: spec.publishMode,
        status: "DRAFT" as const,
        notes: String(p.notes || ""),
      } satisfies Post;
    })
    .filter(Boolean) as Post[];

  if (posts.length === 0) throw new Error("AI returned no usable posts");

  return {
    mode: "ai",
    provider,
    angle: String(parsed.angle || ""),
    master: {
      hooks: Array.isArray(parsed.master?.hooks) ? parsed.master.hooks.map(String) : [],
      body: String(parsed.master?.body || ""),
      value: String(parsed.master?.value || ""),
      cta: String(parsed.master?.cta || input.cta),
    },
    posts,
    testsNext: Array.isArray(parsed.testsNext) ? parsed.testsNext.map(String) : [],
    warnings: [
      ...(Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : []),
      "Human approval required: read every post before publishing.",
    ],
  };
}

export async function generateContent(input: IdeaInput): Promise<GenerationResult> {
  const { provider, demoMode } = getProviderStatus();
  if (demoMode) return generateDemo(input);

  const prompt = buildPrompt(input);
  try {
    const raw =
      provider === "gemini"
        ? await callGemini(prompt)
        : await callOpenAICompatible(provider as "groq" | "openrouter" | "openai", prompt);
    return parseResult(raw, input, provider);
  } catch (err) {
    // Never hard-fail the user: fall back to free demo drafts + explain why.
    const fallback = generateDemo(input);
    fallback.warnings.unshift(
      `AI provider "${provider}" failed (${err instanceof Error ? err.message : "unknown error"}). Showing free demo drafts instead. Check your API key/model in .env.local.`
    );
    return fallback;
  }
}
