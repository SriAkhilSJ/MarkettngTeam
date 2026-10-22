import type { PublishMode } from "./types";

export interface PlatformSpec {
  id: string;
  name: string;
  format: string;
  /** What this platform wants (from the AUTO PDF, section 4) */
  wants: string;
  /** Caption formula (PDF section 5) */
  captionFormula: string;
  /** Default slot in the weekly plan (PDF section 6) */
  defaultDay: string;
  defaultTime: string;
  /** How it can be published in the free setup */
  publishMode: PublishMode;
  publishNote: string;
  /** Cost of official API access */
  apiCost: string;
  /** Env vars for the integrated publisher, in priority order (env token or OAuth Connect). */
  credentials: string[];
}

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const PLATFORMS: PlatformSpec[] = [
  {
    id: "instagram-carousel",
    name: "Instagram Carousel",
    format: "Carousel (max 7 slides)",
    wants: "Hook → value → CTA. Visual-first. Saves/shares matter more than likes.",
    captionFormula: "Hook / Value / CTA / Hashtags (12, mixed reach)",
    defaultDay: "Monday",
    defaultTime: "09:00",
    publishMode: "api",
    publishNote: "API integrated (needs Business/Creator + review). Fallback: free Meta Business Suite scheduler.",
    apiCost: "Free (Meta App Review required)",
    credentials: ["META_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "META_APP_ID", "META_APP_SECRET"],
  },
  {
    id: "instagram-reel",
    name: "Instagram Reel",
    format: "Reel script (under 40s)",
    wants: "Hook in first 1.5 seconds. 3 beats + CTA. You record the video.",
    captionFormula: "Hook / Value / CTA / Hashtags (12, mixed reach)",
    defaultDay: "Wednesday",
    defaultTime: "12:00",
    publishMode: "api",
    publishNote: "API integrated (record video first, paste public URL). Fallback: manual / Meta Business Suite.",
    apiCost: "Free (Meta App Review required)",
    credentials: ["META_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "META_APP_ID", "META_APP_SECRET"],
  },
  {
    id: "tiktok",
    name: "TikTok",
    format: "Spoken script (under 35s)",
    wants: "Short, curiosity-driven, fast pacing. Hook in first 1.5 seconds.",
    captionFormula: "Hook / Short caption / Curiosity line",
    defaultDay: "Tuesday",
    defaultTime: "18:00",
    publishMode: "api",
    publishNote: "API integrated (Direct Post). Unaudited app = private posts only. Fallback: TikTok app (free).",
    apiCost: "Free (audit required for public API posts)",
    credentials: ["TIKTOK_ACCESS_TOKEN", "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
  },
  {
    id: "youtube-shorts",
    name: "YouTube Shorts",
    format: "Short script (under 50s)",
    wants: "Hook → mini story → one clean takeaway. Slightly more patient audience.",
    captionFormula: "Title / One-line description / Tags",
    defaultDay: "Tuesday",
    defaultTime: "17:00",
    publishMode: "api",
    publishNote: "API integrated (YouTube Data API upload, private by default). Fallback: YouTube Studio.",
    apiCost: "Free quota (OAuth + verification for public apps)",
    credentials: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    format: "Story-led post (150–200 words)",
    wants: "Story → insight → lesson. Personal beats corporate, every time.",
    captionFormula: "Story / Insight / Lesson / CTA",
    defaultDay: "Monday",
    defaultTime: "08:00",
    publishMode: "api",
    publishNote: "API integrated (Posts API; own profile is self-serve). Fallback: LinkedIn native scheduler.",
    apiCost: "Free (own profile self-serve; Company Pages need approval)",
    credentials: ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  },
  {
    id: "x",
    name: "X (Twitter)",
    format: "Punchy post + 5-tweet thread",
    wants: "Short and punchy, or a proper thread. No middle ground. Opinions travel.",
    captionFormula: "Hook / Points / CTA",
    defaultDay: "Monday",
    defaultTime: "10:00",
    publishMode: "api",
    publishNote: "API integrated but PAID (pay-per-use). Recommended: post manually = free.",
    apiCost: "PAID (pay-per-use, ~$0.015/post) — manual posting recommended",
    credentials: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET", "X_CLIENT_ID", "X_CLIENT_SECRET"],
  },
  {
    id: "threads",
    name: "Threads",
    format: "Conversational post (2–3 sentences)",
    wants: "Like texting a smart friend. Opinion-led. End with a real question.",
    captionFormula: "Opinion / Reason / Question",
    defaultDay: "Tuesday",
    defaultTime: "11:00",
    publishMode: "api",
    publishNote: "API integrated (Threads Graph API). Fallback: Threads native scheduling.",
    apiCost: "Free (Meta App Review required)",
    credentials: ["THREADS_ACCESS_TOKEN", "THREADS_USER_ID", "THREADS_APP_ID", "THREADS_APP_SECRET"],
  },
  {
    id: "pinterest",
    name: "Pinterest",
    format: "Visual concept + keyword description",
    wants: "It's a search engine. Keyword-rich title + description. Strong vertical visual.",
    captionFormula: "Keyword title / Description / Link",
    defaultDay: "Wednesday",
    defaultTime: "15:00",
    publishMode: "api",
    publishNote: "API integrated (v5 pins). Trial = sandbox/hidden pins. Fallback: manual posting.",
    apiCost: "Free (Trial sandbox; Standard access reviewed)",
    credentials: ["PINTEREST_ACCESS_TOKEN", "PINTEREST_APP_ID", "PINTEREST_APP_SECRET", "PINTEREST_BOARD_ID"],
  },
  {
    id: "reddit",
    name: "Reddit",
    format: "Useful discussion post (zero promo)",
    wants: "Genuinely useful, zero sales energy. Contribute first. Promo gets you removed.",
    captionFormula: "Honest title / Context / Question to the sub",
    defaultDay: "Wednesday",
    defaultTime: "16:00",
    publishMode: "api",
    publishNote: "API integrated for pre-approved apps only. Recommended: always post manually (free + safest).",
    apiCost: "Approval-gated — manual posting recommended",
    credentials: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_REFRESH_TOKEN", "REDDIT_USERNAME", "REDDIT_PASSWORD"],
  },
];

export function getPlatform(id: string): PlatformSpec | undefined {
  return PLATFORMS.find((p) => p.id === id);
}
