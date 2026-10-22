# Simple Plan — AI That Runs All Your Socials

**Source:** `AUTO — Build an AI That Runs All Your Socials.pdf` (by @seb.ai)  
**In one line:** Give 1 idea → Get 1 full week of content for every platform.

---

## 1. What We Are Building

You give one idea. The system:

1. Writes the content
2. Changes it for each platform
3. Writes captions for each platform
4. Puts it in a weekly schedule
5. You review and approve
6. Posts are published (auto where allowed, manual where not)
7. Results are tracked
8. Next week becomes better using those results

> **Truth from the PDF:** AI does 90% of the work (writing + planning).
> The final "Post" tap is often manual. That is normal and fine.
> Never use tools that log into your account like a robot browser — accounts get banned.
> Use only official APIs and approved scheduling tools.

---

## 2. The Full Flow

```
ONE IDEA
   ↓
WRITE        → Master version (full version)
   ↓
ADAPT        → Different version for each platform
   ↓
CAPTIONS     → Caption + hashtags for each platform
   ↓
APPROVE      → YOU read it first (always)
   ↓
SCHEDULE     → Day + time for each post
   ↓
PUBLISH      → Auto or manual post
   ↓
TRACK        → Views, likes, comments, shares, saves
   ↓
IMPROVE      → Learn what worked → next idea is better
   ↺  (loop repeats every week)
```

---

## 3. What You Give, What You Get

### You give only 4–6 lines:

| Input | Example |
|-------|---------|
| **TOPIC** | 3 AI automations that save time |
| **AUDIENCE** | Creators and entrepreneurs |
| **GOAL** | Educate + get engagement |
| **CTA** (one ask) | Comment "AUTO" |
| **TONE** | Direct and punchy |
| **PLATFORMS** | Only the ones you really use |

### You get 9 pieces of content:

1. Instagram Carousel (max 7 slides)
2. Instagram Reel (under 40 seconds)
3. TikTok script (under 35 seconds)
4. YouTube Short (under 50 seconds)
5. LinkedIn post (150–200 words)
6. X post or 5-tweet thread
7. Threads post (2–3 sentences)
8. Pinterest pin (visual + keyword description)
9. Reddit post (useful, zero promo)

---

## 4. Step-by-Step Plan

### Step 1 — Give One Idea
- Write Topic, Audience, Goal, CTA.
- Pick **one** idea only. Do not start with many.

### Step 2 — Write the Master Version  *(Prompt 2)*
Write the full version first. Everything else is cut from this.

Every master version has 4 parts:
- **HOOK** — first line. Stop the scroll. (Make 3 options)
- **BODY** — the real content, 150–250 words. Real examples, real numbers.
- **VALUE** — one thing the reader can do today.
- **CTA** — one clear ask. Only one.

### Step 3 — Adapt for Each Platform  *(Prompt 3)*
**Do not copy-paste the same post everywhere.** Same idea, different style.

| Platform | What it wants |
|----------|---------------|
| Instagram | Hook → Value → CTA. Visual first. Saves/shares > likes |
| TikTok | Fast. Hook in first 1.5 seconds |
| YouTube Shorts | Hook → small story → 1 takeaway |
| LinkedIn | Story → insight → lesson. Personal, not corporate |
| X | Very short post OR full thread. No middle |
| Threads | Like texting a smart friend. Ask a question |
| Pinterest | Visual + keyword-rich text. It is a search engine |
| Reddit | Truly useful. Zero selling. Promo gets removed |

Rule: **9 versions = 9 different hooks.** Never reuse a hook.

### Step 4 — Write Captions  *(Prompt 4)*

| Platform | Caption formula |
|----------|-----------------|
| Instagram | Hook / Value / CTA / Hashtags (12 tags: big + medium + small) |
| TikTok | Hook / Short caption / Curiosity line |
| YouTube Shorts | Title / 1-line description / Tags |
| LinkedIn | Story / Insight / Lesson / CTA |
| X | Hook / Points / CTA |
| Threads | Opinion / Reason / Question |
| Pinterest | Keyword title / Description / Link |
| Reddit | Honest title / Context / Question |

Rule: First line of every caption must work alone as a hook.

### Step 5 — You Approve (Human Check)

**This is non-negotiable: `HUMAN APPROVAL = TRUE`**

- You read every post before it goes out. It has your name on it.
- Review takes 10 seconds. One bad post costs much more.

Give every post a status (one row per post in a sheet):

| Status | Means |
|--------|-------|
| `DRAFT` | AI wrote it, nobody checked |
| `READY` | Finished, waiting for your review |
| `APPROVED` | You read it, you are happy |
| `SCHEDULED` | Date + time locked |
| `PUBLISHED` | Live — confirmed live, not guessed |
| `FAILED` | Something broke. Needs you. Never auto-retry silently |

> If a post was **not** really posted, status is `READY` or `FAILED` — never `PUBLISHED`.

### Step 6 — Schedule (One Week Plan)

| Day | What goes out |
|-----|---------------|
| **Monday** | Instagram Carousel / LinkedIn / X post |
| **Tuesday** | TikTok / YouTube Short / Threads |
| **Wednesday** | Instagram Reel / Pinterest / Reddit |
| **Thursday** | X thread / Threads follow-up (reply to what got replies) |
| **Friday** | Repost best post of the week to Stories |
| **Weekend** | Off. Only reply to comments |

3 ways to schedule (start with #1):
1. **Native schedulers** — free, built into platforms. Slow but zero risk. ✅ Start here
2. **Approved scheduling tool** — one dashboard for all. Easiest later.
3. **Custom API** — most powerful, most setup. Only later, only official APIs.

### Step 7 — Publish
- Flow: `Content Ready → Review → Approve → Schedule → Publish`
- Some platforms allow auto-posting. Some need your manual tap. Both are fine.
- Confirm the post is live, then mark `PUBLISHED`.

### Step 8 — Track and Improve  *(Prompt 5)*
This is the step everyone skips. This is what makes you better every week.

Track what the platform actually gives you:
`Views | Likes | Comments | Shares | Saves | Clicks | Watch time | Engagement rate`

- If a platform does not give a number, write `N/A`. Never guess. Never let AI invent numbers.
- Every 2 weeks, analyze: best post, best hook, best platform, best format, weakest post.
- Then decide: **3 specific things to test next** + **next 5 content ideas** (based on what worked).

**The loop:** `POST → TRACK → LEARN → IMPROVE → POST again (smarter)`

---

## 5. Tools You Need (Start Free)

| Tool | For what |
|------|----------|
| ChatGPT or Claude | Writing + adapting. All prompts live here |
| Canva (free) | Carousels, thumbnails, Pinterest graphics. One template, reuse forever |
| Google Sheets or Notion | Content calendar + status tracker. One row per post |
| Native platform schedulers | Posting. Free, safe |
| Native platform analytics | Numbers. Free, good enough |

> Start free: **ChatGPT/Claude + Canva free + Google Sheet + native schedulers = full system.**
> Buy paid tools only when one clear bottleneck is wasting your time.

**What stays manual (always):** reviewing posts, recording video/making visuals,
publishing where there is no API, replying to comments, being human.

---

## 6. Build Roadmap for This Repo (MarkettngTeam)

If we turn this system into actual software, build in this order.
Do not build everything at once.

### Phase 1 — Run it manually first (Week 1) ✅ Do this now
- Use the prompts in ChatGPT/Claude. No code.
- Make a tracker sheet: `Topic | Platform | Format | Hook | Caption | Status | Date | Views | Likes | Comments | Shares | Saves`
- Run 1 idea → 1 week of posts. Learn what is slow or painful.
- **Goal:** Prove the system works before building anything.

### Phase 2 — Simple MVP app
- One form: Topic, Audience, Goal, CTA, Tone, Platforms
- AI Writer: creates the master version (Hook / Body / Value / CTA)
- Platform Adapter: creates 1 version per selected platform
- Caption Writer: 1 caption per platform using the formulas above
- Save every post with status `DRAFT → READY`
- **Goal:** 4 lines in → ready-to-review posts out. Nothing posts automatically.

### Phase 3 — Approval + Schedule dashboard
- List/calendar view of all posts by day and platform
- Approve / Edit / Reject buttons (human approval built in)
- Weekly schedule view (Mon–Fri plan from Step 6)
- Status tracking: `DRAFT / READY / APPROVED / SCHEDULED / PUBLISHED / FAILED`
- **Goal:** You control everything from one screen.

### Phase 4 — Publishing (only safe ways) ✅ BUILT (v0.2 — see TESTING.md to add credentials & test)
- Connect approved scheduling tools / official platform APIs only
- Platforms without an open API → "Copy & Post Manually" button, status stays honest
- Confirm post is live before marking `PUBLISHED`
- **Goal:** Faster posting, zero ban risk.

### Phase 5 — Analytics + Learning loop
- Enter/pull metrics per post (mark missing ones `N/A`)
- Weekly report: best hook, best platform, best format, weakest post
- AI suggests 3 tests + next 5 ideas from real numbers only
- **Goal:** Every week better than the last.

---

## 7. Week 1 Checklist (Start Here)

- [ ] Pick **one** idea
- [ ] Write the master version *(Prompt 2)*
- [ ] Adapt for each platform *(Prompt 3)*
- [ ] Create captions *(Prompt 4)*
- [ ] Review everything yourself
- [ ] Schedule the posts (Mon–Fri plan)
- [ ] Publish
- [ ] Track your numbers in the sheet
- [ ] Analyze performance *(Prompt 5)*
- [ ] Improve the next round

> Run it once, even badly. Week 1 is messy for everyone. Week 4 starts to feel automatic.

---

## 8. Simple Rules (Do / Don't)

**DO**
- ✅ One idea at a time
- ✅ Different hook for every platform
- ✅ Read before you post — always
- ✅ Use official APIs / approved tools only
- ✅ Record real numbers only (`N/A` if missing)
- ✅ Reply to comments yourself — that builds the audience

**DON'T**
- ❌ Copy-paste the same post on all platforms
- ❌ Auto-publish without human review
- ❌ Use browser-automation bots on logged-in accounts
- ❌ Invent stats, quotes, or results
- ❌ Sell on Reddit
- ❌ Mark a post `PUBLISHED` if it is not really live

---

## 9. The 6 Prompts (Names Only — Use in Order)

| # | Prompt | Job |
|---|--------|-----|
| 1 | Turn My Idea Into Content | 1 idea → 9 content concepts |
| 2 | Write the Master Version | Full version: Hook / Body / Value / CTA |
| 3 | Adapt for Every Platform | Same idea, native style per platform |
| 4 | Write My Captions | Caption per platform using its formula |
| 5 | Analyze My Performance | Learn from last 2 weeks of numbers |
| ★ | **Master Prompt: "Run My Socials"** | All 8 steps in one paste (see below) |

---

## 10. The Master Prompt (Save This One)

Copy-paste this into ChatGPT/Claude. It runs the whole system at once:

```
You are my full social media system. I'm giving you one idea.
Take it all the way to a ready-to-post week.

MY TOPIC: [your topic]
MY AUDIENCE: [who this is for]
MY GOAL: [educate / engage / sell / grow]
MY TONE: [how you sound]
MY CTA: [your one ask]
MY PLATFORMS: [list only the ones you actually post on]

Work through all 8 steps in order:

1. CORE IDEA — Sharpen my topic into one clear, specific angle.
2. MASTER CONTENT — Write it: HOOK / BODY / VALUE / CTA. Give me 3 hook options.
3. PLATFORM VERSIONS — Adapt for each platform I listed. Native tone each time.
   A different hook for every single one.
4. CAPTIONS — One caption per platform, using that platform's formula.
   Include hashtags only where they actually help.
5. FORMATS — Best format for each (carousel, reel, thread, text, static) and why.
6. POSTING SCHEDULE — A day-by-day week. Note manual vs schedulable.
7. TRACKING CHECKLIST — Exactly which metrics to record per platform.
   Mark anything that platform doesn't expose.
8. WHAT TO IMPROVE NEXT — Three specific things to test in the next round.

RULES:
- Keep every output short, practical and ready to use as-is
- No filler, no "in conclusion", no corporate voice
- Do not invent statistics, quotes or results
- Flag anything I need to check or approve before posting
- If a platform is a bad fit for this idea, say so, don't force it
```

---

**Honest end note (from the PDF):** This system makes you faster and more
consistent. It does not guarantee views, followers, or sales. It removes the
blank-page problem. AI can write your posts — replying to comments and being
human is still your job. That is the part that actually builds an audience.

**One idea in. Every platform out.**
