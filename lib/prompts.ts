/** The 6 copy-paste prompts from the AUTO PDF. Also saved as files in /prompts. */
export interface PromptDef {
  id: string;
  name: string;
  job: string;
  body: string;
}

export const PROMPTS: PromptDef[] = [
  {
    id: "prompt-1",
    name: "Prompt 1 — Turn My Idea Into Content",
    job: "1 idea → 9 platform content concepts",
    body: `You are my content strategist. I'm giving you one idea.
Turn it into nine platform-specific content concepts.

TOPIC: [your topic]
AUDIENCE: [who this is for]
GOAL: [educate / engage / sell / grow]
CTA: [what you want them to do]

Give me one concept for each of these:
INSTAGRAM CAROUSEL - slide-by-slide outline, 7 slides max
INSTAGRAM REEL - hook + 3 beats + CTA, under 40 seconds
TIKTOK - full spoken script, fast pacing, under 35 seconds
YOUTUBE SHORT - hook + mini story + one takeaway
LINKEDIN - story-led post, 150-200 words
X - either one punchy post OR a 5-tweet thread, you pick
THREADS - conversational, opinion-led, 2-3 sentences
PINTEREST - visual concept + keyword-rich description
REDDIT - genuinely useful discussion post, zero promo

RULES:
- Every concept must earn attention in its first line
- Do NOT reuse the same hook twice
- Match each platform's native tone, don't be generic
- Keep each concept under 120 words
- No emojis unless the platform genuinely calls for it`,
  },
  {
    id: "prompt-2",
    name: "Prompt 2 — Write the Master Version",
    job: "Full version first: Hook / Body / Value / CTA",
    body: `Write the master version of this content.
This is the full version. Everything else gets cut down from it.

TOPIC: [your topic]
AUDIENCE: [who this is for]
TONE: [direct and punchy / warm and friendly / dry and funny]
GOAL: [educate / engage / sell / grow]
CTA: [your one ask]

Structure it exactly like this:

HOOK
One line. Make me stop scrolling. Give me 3 options.

BODY
The core content. Specific, not vague. Use real examples,
real numbers, real situations. 150-250 words.

VALUE
The one thing they can go do today because they read this.
Make it concrete enough to actually action.

CTA
One ask. Not three. Natural, not desperate.

RULES:
- Write how people talk, not how brands write
- Cut every sentence that doesn't earn its place
- No "in today's fast-paced world" type openers
- If a claim needs a source, flag it instead of inventing one`,
  },
  {
    id: "prompt-3",
    name: "Prompt 3 — Adapt for Every Platform",
    job: "Same idea, completely different execution per platform",
    body: `Here is my master content:

[paste your master version here]

Adapt it for each platform below. Same idea, completely different
execution. Do not reuse phrasing between versions.

INSTAGRAM - hook, value, CTA. Give me the carousel slide text.
TIKTOK - spoken script. Short, curiosity-led, fast. Under 35 sec.
YOUTUBE SHORTS - hook, mini story, one takeaway. Under 50 sec.
LINKEDIN - story, insight, lesson. 150-200 words. Personal tone.
X - give me BOTH a single punchy post AND a 5-tweet thread.
THREADS - conversational, 2-3 sentences, ends with a real question.
PINTEREST - visual concept + keyword-rich description.
REDDIT - useful discussion post. No promo. Suggest 2 subreddits.

RULES:
- Each version needs its own hook. Nine versions, nine hooks.
- Match native tone per platform, don't write everything the same
- Stay inside each platform's normal length
- Flag anywhere the idea genuinely doesn't fit a platform rather than forcing it`,
  },
  {
    id: "prompt-4",
    name: "Prompt 4 — Write My Captions",
    job: "One caption per platform, using its formula",
    body: `Write captions for every platform version of this content.

CONTENT: [paste your adapted versions]
CTA: [your one ask]

Use these formulas exactly:
INSTAGRAM: hook / value / CTA / hashtags
TIKTOK: hook / short caption / curiosity line
YOUTUBE SHORTS: title / one-line description / tags
LINKEDIN: story / insight / lesson / CTA
X: hook / points / CTA
THREADS: opinion / reason / question
PINTEREST: keyword title / description / link
REDDIT: honest title / context / question to the sub

For hashtags: give me 12 for Instagram, mixing big, medium
and small reach. No banned or spammy tags.

RULES:
- First line of every caption must work as a standalone hook
- Instagram captions under 150 words
- No emoji walls
- The CTA should feel like a natural next step, not a demand`,
  },
  {
    id: "prompt-5",
    name: "Prompt 5 — Analyze My Performance",
    job: "Learn from the last 2 weeks of real numbers",
    body: `Here are my content metrics from the last 2 weeks:

[paste your numbers - platform, post, hook, and whatever
metrics you have. Mark anything unavailable as N/A]

Analyse and give me exactly this:

TOP PERFORMING CONTENT
Which posts won, and your best guess at why.

BEST HOOK
The single strongest opening line and what made it work.

BEST PLATFORM
Where I'm getting the most return for the effort.

BEST FORMAT
Carousel, reel, thread, text - what's actually landing.

WEAKEST CONTENT
What flopped and the most likely reason.

WHAT TO TEST NEXT
Three specific, testable changes. Not vague advice.

NEXT 5 CONTENT IDEAS
Based on what's working, not on what's generically popular.

RULES:
- Only use the numbers I gave you. Do not invent metrics.
- If the sample is too small to conclude anything, say so.
- Separate "this is what the data shows" from "this is my guess."
- Be direct about what isn't working.`,
  },
  {
    id: "master",
    name: "★ Master Prompt — Run My Socials",
    job: "The whole system in one paste (8 steps)",
    body: `You are my full social media system. I'm giving you one idea.
Take it all the way to a ready-to-post week.

MY TOPIC: [your topic]
MY AUDIENCE: [who this is for]
MY GOAL: [educate / engage / sell / grow]
MY TONE: [how you sound]
MY CTA: [your one ask]
MY PLATFORMS: [list only the ones you actually post on]

Work through all 8 steps in order:

1. CORE IDEA
   Sharpen my topic into one clear, specific angle.

2. MASTER CONTENT
   Write it: HOOK / BODY / VALUE / CTA.
   Give me 3 hook options.

3. PLATFORM VERSIONS
   Adapt for each platform I listed. Native tone each time.
   A different hook for every single one.

4. CAPTIONS
   One caption per platform, using that platform's formula.
   Include hashtags only where they actually help.

5. FORMATS
   Tell me the best format for each - carousel, reel,
   thread, text, static - and why.

6. POSTING SCHEDULE
   A day-by-day week. Note which ones I'll likely need
   to publish manually vs. can schedule.

7. TRACKING CHECKLIST
   Exactly which metrics to record per platform.
   Mark anything that platform doesn't expose.

8. WHAT TO IMPROVE NEXT
   Three specific things to test in the next round.

RULES:
- Keep every output short, practical and ready to use as-is
- No filler, no "in conclusion", no corporate voice
- Do not invent statistics, quotes or results
- Flag anything I need to check or approve before posting
- If a platform is a bad fit for this idea, say so, don't force it`,
  },
];
