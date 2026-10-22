import type { Post, PostStatus } from "../types";

const STATUSES: PostStatus[] = ["DRAFT", "READY", "APPROVED", "SCHEDULED", "PUBLISHED", "FAILED"];

function s(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function sa(v: unknown, maxItems: number, itemMax: number): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => (x as string).slice(0, itemMax)).slice(0, maxItems) : [];
}

/** Build a safe Post from untrusted request JSON. Returns null if unusable. */
export function sanitizePost(raw: unknown): Post | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const platformId = s(b.platformId, 60);
  if (!platformId) return null;
  return {
    id: s(b.id, 120) || "post",
    platformId,
    platformName: s(b.platformName, 120),
    format: s(b.format, 200),
    hook: s(b.hook, 2000),
    content: s(b.content, 30000),
    caption: s(b.caption, 10000),
    hashtags: sa(b.hashtags, 50, 100),
    scheduledDay: s(b.scheduledDay, 20),
    scheduledTime: s(b.scheduledTime, 10),
    publishMode: b.publishMode === "manual" || b.publishMode === "scheduler" ? b.publishMode : "api",
    status: STATUSES.includes(b.status as PostStatus) ? (b.status as PostStatus) : "DRAFT",
    notes: s(b.notes, 2000),
    title: s(b.title, 500),
    mediaUrls: sa(b.mediaUrls, 20, 2000),
    linkUrl: s(b.linkUrl, 2000),
    subreddit: s(b.subreddit, 100),
    boardId: s(b.boardId, 100),
    externalId: s(b.externalId, 300),
    externalUrl: s(b.externalUrl, 2000),
  };
}
