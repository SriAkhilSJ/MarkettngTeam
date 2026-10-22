import { getPlatform } from "./platforms";
import type { GenerationResult, IdeaInput, Post } from "./types";

/**
 * FREE demo generator — no API key, no cost, works offline.
 * Template-based: gives a real, editable starting draft per platform.
 * Add a free Gemini/Groq key (see CREDENTIALS.md) for full AI writing.
 */

let counter = 0;
function uid(): string {
  counter += 1;
  return `demo-${Date.now()}-${counter}`;
}

function cap(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

export function generateDemo(input: IdeaInput): GenerationResult {
  const topic = input.topic.trim();
  const audience = input.audience.trim() || "creators";
  const cta = input.cta.trim() || "Save this for later";
  const T = cap(topic);

  const master = {
    hooks: [
      `Stop overcomplicating ${topic}. Here's the simple version.`,
      `Nobody told ${audience} this about ${topic} — so I will.`,
      `I tested ${topic} so you don't have to. Here's what actually works.`,
    ],
    body: `Most ${audience} get ${topic} wrong because they start with the hardest part first.\n\nHere's the order that works:\n1. Start with the smallest version of ${topic} you can finish today.\n2. Do it once, badly if needed. A finished draft beats a perfect plan.\n3. Look at what happened — keep what worked, cut what didn't.\n4. Repeat weekly. Small loops beat big launches.\n\n[EDIT ME: add your real example, your real numbers, and your real story here. Specific beats generic, every time.]`,
    value: `Today's one action: spend 15 minutes on the smallest version of ${topic}. Finish it. Post it or ship it. Then note one thing you'd do differently next time.`,
    cta,
  };

  const builders: Record<string, (p: ReturnType<typeof getPlatform>) => Omit<Post, "id" | "platformId" | "platformName" | "format" | "status">> = {
    "instagram-carousel": (p) => ({
      hook: master.hooks[0],
      content: `SLIDE 1 (HOOK): ${master.hooks[0]}\nSLIDE 2: The mistake most ${audience} make with ${topic}\nSLIDE 3: Step 1 — start with the smallest version\nSLIDE 4: Step 2 — finish it once, even badly\nSLIDE 5: Step 3 — keep what worked, cut the rest\nSLIDE 6: Your one action today (15 minutes)\nSLIDE 7 (CTA): ${cta}\n\n[Design in Canva free: 1 template, reuse forever]`,
      caption: `${master.hooks[0]}\n\nSwipe for the simple 3-step version — built for ${audience}.\n\n${cta}`,
      hashtags: ["#contentcreator", "#marketingtips", "#aitools", "#smallbusiness", "#creator", "#socialmediatips", "#growth", "#automation", "#entrepreneur", "#dailytips", "#learnontiktok", "#savethis"],
      scheduledDay: p!.defaultDay, scheduledTime: p!.defaultTime, publishMode: p!.publishMode,
      notes: "Make slides in Canva (free). Saves/shares > likes.",
    }),
    "instagram-reel": (p) => ({
      hook: `POV: you finally stop overthinking ${topic}`,
      content: `HOOK (0-2s, on camera): "POV: you finally stop overthinking ${topic}."\nBEAT 1 (2-12s): Show the old, complicated way. One sentence.\nBEAT 2 (12-28s): Show your simple 3 steps. Point at on-screen text.\nBEAT 3 (28-38s): Result + one takeaway for ${audience}.\nCTA (last 2s): "${cta}"\n\n[Record vertical 9:16. Captions on. Under 40 seconds total.]`,
      caption: `The simple version of ${topic} — no fluff.\n\n${cta}`,
      hashtags: ["#reels", "#contentcreator", "#aitools", "#marketingtips", "#creator"],
      scheduledDay: p!.defaultDay, scheduledTime: p!.defaultTime, publishMode: p!.publishMode,
      notes: "You record the video. Hook must land in 1.5s.",
    }),
    tiktok: (p) => ({
      hook: `You're doing ${topic} the slow way. Watch this.`,
      content: `[0-2s] "You're doing ${topic} the slow way. Watch this."\n[2-10s] "Here's what most ${audience} do — and why it wastes time."\n[10-25s] "Do this instead: smallest version first. Finish once. Fix one thing. Repeat."\n[25-33s] "That's it. That's the whole system."\n[33-35s] "${cta}"\n\n[Fast pacing. Talk to camera. On-screen text for each beat.]`,
      caption: `The fast way to do ${topic} 👀 wait for step 2…`,
      hashtags: ["#aitools", "#contentcreator", "#marketing", "#fyp"],
      scheduledDay: p!.defaultDay, scheduledTime: p!.defaultTime, publishMode: p!.publishMode,
      notes: "Post manually. Curiosity in first 1.5s or it's gone.",
    }),
    "youtube-shorts": (p) => ({
      hook: `I wasted weeks on ${topic}. Here's the shortcut.`,
      content: `HOOK: "I wasted weeks on ${topic}. Here's the shortcut."\nMINI STORY: "I kept planning the perfect version. Nothing shipped. Then I did the smallest version in 15 minutes — and it worked better than the plan."\nTAKEAWAY: "Small finished loops beat big perfect plans. Especially for ${audience}."\nCTA: "${cta}"\n\n[Under 50s. Same footage as TikTok/Reel is fine — different hook.]`,
      caption: `${T} — the shortcut nobody shares | The 15-minute version of ${topic} for ${audience}.`,
      hashtags: ["#shorts", "#aitools", "#marketingtips"],
      scheduledDay: p!.defaultDay, scheduledTime: p!.defaultTime, publishMode: p!.publishMode,
      notes: "Schedule free in YouTube Studio.",
    }),
    linkedin: (p) => ({
      hook: `I used to spend hours on ${topic}. Now it takes 15 minutes.`,
      content: `I used to spend hours on ${topic}.\n\nPlanning. Rewriting. "Perfecting."\nNothing actually shipped.\n\nThen I changed one thing: I started with the smallest version I could finish the same day.\n\nThe result surprised me. The "quick draft" got more response than the polished pieces I'd obsessed over — because it was real, specific, and actually published.\n\nHere's my loop now:\n→ Smallest version first\n→ Finish once, even badly\n→ Keep what worked, cut what didn't\n→ Repeat weekly\n\nLesson: for ${audience}, consistency beats intensity. A finished post teaches you more than a perfect draft ever will.\n\n[EDIT ME: replace with your real story + one real number.]\n\n${cta}`,
      caption: "",
      hashtags: ["#marketing", "#contentstrategy", "#ai"],
      scheduledDay: p!.defaultDay, scheduledTime: p!.defaultTime, publishMode: p!.publishMode,
      notes: "Personal story > corporate voice. 150–200 words.",
    }),
    x: (p) => ({
      hook: `${T}, in one line: start embarrassingly small.`,
      content: `SINGLE POST:\n${T}, in one line: start embarrassingly small, finish once, fix one thing, repeat weekly. That's the whole system.\n\nTHREAD:\n1/ Most ${audience} overcomplicate ${topic}. A short thread on the simple version:\n2/ Step 1: smallest version you can finish TODAY. Not this month. Today.\n3/ Step 2: finish it once, badly if needed. Done > perfect.\n4/ Step 3: keep what worked, cut what didn't. One fix per round.\n5/ Repeat weekly. In 4 weeks this feels automatic. ${cta}`,
      caption: "",
      hashtags: [],
      scheduledDay: p!.defaultDay, scheduledTime: p!.defaultTime, publishMode: p!.publishMode,
      notes: "Post manually (free). X API is paid — skip it.",
    }),
    threads: (p) => ({
      hook: `Unpopular opinion: your ${topic} doesn't need to be perfect. It needs to be finished.`,
      content: `Unpopular opinion: your ${topic} doesn't need to be perfect. It needs to be finished.\n\nSmallest version → ship it → fix one thing → repeat. Works embarrassingly well.\n\nWhat's the smallest version of yours you could finish today?`,
      caption: "",
      hashtags: [],
      scheduledDay: p!.defaultDay, scheduledTime: p!.defaultTime, publishMode: p!.publishMode,
      notes: "End with a real question. Reply to answers yourself.",
    }),
    pinterest: (p) => ({
      hook: `${T}: The Simple 3-Step System for ${cap(audience)}`,
      content: `VISUAL CONCEPT: Tall pin (1000×1500). Big bold title: "${T} — 3 Simple Steps". Below: 3 numbered steps with icons. Clean background, high contrast. [Make free in Canva: search "Pinterest pin".]\n\nKEYWORD DESCRIPTION: Learn ${topic} the simple way. This step-by-step guide for ${audience} shows the exact 3-step system: start small, finish once, improve weekly. Save this pin and try the 15-minute version today.`,
      caption: `${T} | Simple step-by-step for ${audience} — save for later.`,
      hashtags: [],
      scheduledDay: p!.defaultDay, scheduledTime: p!.defaultTime, publishMode: p!.publishMode,
      notes: "Pinterest = search engine. Keywords in title matter most.",
    }),
    reddit: (p) => ({
      hook: `What actually worked for me with ${topic} (after weeks of overcomplicating it)`,
      content: `TITLE: What actually worked for me with ${topic} (after weeks of overcomplicating it)\n\nCONTEXT: I kept planning the perfect approach to ${topic} and shipping nothing. What finally worked was embarrassingly simple: smallest possible version, finished the same day, then one small fix per week.\n\nSharing in case it helps someone stuck in the same loop. No links, nothing to sell — genuinely curious how others here approach this.\n\nQUESTION: What did you cut from your process that you thought you needed?\n\n[Suggested subs: EDIT ME — pick 2 subs where you already participate. Read sub rules first. Zero promo.]`,
      caption: "",
      hashtags: [],
      scheduledDay: p!.defaultDay, scheduledTime: p!.defaultTime, publishMode: p!.publishMode,
      notes: "Zero promo or it gets removed. Contribute first.",
    }),
  };

  const posts: Post[] = [];
  for (const id of input.platforms) {
    const spec = getPlatform(id);
    const build = builders[id];
    if (!spec || !build) continue;
    const partial = build(spec);
    posts.push({
      id: uid(),
      platformId: spec.id,
      platformName: spec.name,
      format: spec.format,
      status: "DRAFT",
      ...partial,
    });
  }

  return {
    mode: "demo",
    provider: "demo (no API key — free template mode)",
    angle: `${T} — the simple, smallest-version-first approach for ${audience}.`,
    master,
    posts,
    testsNext: [
      `Test hook style: "mistake" hook vs "shortcut" hook on the same topic (${topic}).`,
      "Test format: carousel vs reel with the same hook — compare saves, not likes.",
      "Test CTA: comment-a-word vs save-this — compare comments and saves.",
    ],
    warnings: [
      "DEMO MODE: drafts are templates with [EDIT ME] parts. Add a FREE Gemini or Groq key for real AI writing (see CREDENTIALS.md).",
      "Read every post before publishing. Human approval is always required.",
      "Add your real story, examples and numbers — never invent stats.",
    ],
  };
}
