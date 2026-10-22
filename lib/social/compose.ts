import type { Post } from "../types";

export function cleanTags(tags: string[] = []): string[] {
  return tags
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t.replace(/^#+/, "")}`))
    .map((t) => t.replace(/\s+/g, ""));
}

/** Caption first (that's what followers see), then hashtags. */
export function captionWithTags(post: Post): string {
  const base = (post.caption || post.content || "").trim();
  const tags = cleanTags(post.hashtags).join(" ");
  return [base, tags].filter(Boolean).join("\n\n").trim();
}

/** Body text for text-first platforms (LinkedIn, Threads, Reddit, X fallback). */
export function bodyText(post: Post): string {
  const base = (post.content || post.caption || "").trim();
  const tags = cleanTags(post.hashtags).join(" ");
  return [base, tags].filter(Boolean).join("\n\n").trim();
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, Math.max(0, max - 1));
  const last = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
  return (last > max * 0.6 ? cut.slice(0, last) : cut).trimEnd() + "…";
}

export function titleFor(post: Post, max = 100): string {
  const raw = (post.title || post.hook || (post.content || "").split("\n").find((l) => l.trim()) || "Untitled").trim();
  return truncate(raw.replace(/[<>]/g, ""), max);
}

/** Extract "1/ ... 2/ ..." numbered thread parts from generated X content. */
export function extractNumberedThread(content: string): string[] | null {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const parts: string[] = [];
  for (const line of lines) {
    const m = line.match(/^(\d+)\/\s?(.*)$/);
    if (m && Number(m[1]) === parts.length + 1 && m[2]) parts.push(m[2]);
  }
  return parts.length >= 2 ? parts : null;
}

/** Prefer an explicit "SINGLE POST:" block from generated X content. */
export function extractSinglePost(content: string): string | null {
  const m = content.match(/SINGLE POST:\s*\n([\s\S]*?)(?:\n\s*THREAD:|\n\s*1\/|$)/i);
  return m?.[1]?.trim() ? m[1].trim() : null;
}

/** Split long text into chunks ≤ max chars at sentence / word boundaries. */
export function splitThread(text: string, max = 275): string[] {
  const clean = text.trim().replace(/\n{3,}/g, "\n\n");
  if (clean.length <= max) return [clean];
  const units = clean.split(/(?<=[.!?])\s+|\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const parts: string[] = [];
  let cur = "";
  const flush = () => { if (cur.trim()) parts.push(cur.trim()); cur = ""; };
  for (const u of units) {
    if (u.length > max) {
      flush();
      let rest = u;
      while (rest.length > max) {
        const cut = rest.lastIndexOf(" ", max);
        parts.push(rest.slice(0, cut > 40 ? cut : max).trim());
        rest = rest.slice(cut > 40 ? cut : max).trim();
      }
      cur = rest;
      continue;
    }
    if ((cur ? cur.length + 1 : 0) + u.length <= max) cur = cur ? `${cur} ${u}` : u;
    else { flush(); cur = u; }
  }
  flush();
  return parts;
}

export function mediaList(post: Post): string[] {
  return (post.mediaUrls || []).map((u) => u.trim()).filter(Boolean);
}

export function looksLikeVideo(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(url);
}
export function looksLikeImage(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(url);
}
