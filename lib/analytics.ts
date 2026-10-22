import type { Post } from "./types";

/**
 * Free, local analytics (no API, no cost).
 * Rule from the PDF: only use real numbers. Missing = N/A, never invented.
 */

export function engagement(p: Post): number {
  const m = p.metrics || {};
  return (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0) + (m.clicks || 0);
}

export function engagementRate(p: Post): number | null {
  const views = p.metrics?.views;
  if (!views || views <= 0) return null; // N/A — do not guess
  return engagement(p) / views;
}

export interface Analysis {
  trackedCount: number;
  bestPost?: Post;
  bestHook?: string;
  weakestPost?: Post;
  byPlatform: { platform: string; posts: number; totalEngagement: number; avgRate: number | null }[];
  byFormat: { format: string; posts: number; totalEngagement: number }[];
  notes: string[];
  testsNext: string[];
}

export function analyze(posts: Post[]): Analysis {
  const tracked = posts.filter((p) => p.metrics && engagement(p) > 0);
  const notes: string[] = [];

  if (tracked.length === 0) {
    notes.push("No metrics entered yet. Publish posts, then enter real numbers from each platform's free native analytics.");
  } else if (tracked.length < 5) {
    notes.push(`Only ${tracked.length} post(s) tracked — sample is too small for strong conclusions. Treat this as a hint, not proof.`);
  }

  const sorted = [...tracked].sort((a, b) => engagement(b) - engagement(a));
  const bestPost = sorted[0];
  const weakestPost = sorted.length > 1 ? sorted[sorted.length - 1] : undefined;

  const platMap = new Map<string, { posts: number; total: number; rates: number[] }>();
  const fmtMap = new Map<string, { posts: number; total: number }>();
  for (const p of tracked) {
    const e = engagement(p);
    const pl = platMap.get(p.platformName) || { posts: 0, total: 0, rates: [] };
    pl.posts += 1; pl.total += e;
    const r = engagementRate(p); if (r !== null) pl.rates.push(r);
    platMap.set(p.platformName, pl);
    const f = fmtMap.get(p.format) || { posts: 0, total: 0 };
    f.posts += 1; f.total += e;
    fmtMap.set(p.format, f);
  }

  return {
    trackedCount: tracked.length,
    bestPost,
    bestHook: bestPost?.hook,
    weakestPost,
    byPlatform: [...platMap.entries()]
      .map(([platform, v]) => ({
        platform,
        posts: v.posts,
        totalEngagement: v.total,
        avgRate: v.rates.length ? v.rates.reduce((a, b) => a + b, 0) / v.rates.length : null,
      }))
      .sort((a, b) => b.totalEngagement - a.totalEngagement),
    byFormat: [...fmtMap.entries()]
      .map(([format, v]) => ({ format, posts: v.posts, totalEngagement: v.total }))
      .sort((a, b) => b.totalEngagement - a.totalEngagement),
    notes,
    testsNext: bestPost
      ? [
          `Reuse the winning hook style ("${bestPost.hook.slice(0, 60)}…") on a new topic.`,
          "Re-make the best post in the second-best format and compare saves/shares.",
          "Post the weakest format at the best platform's time slot — test if timing was the problem.",
        ]
      : [
          "Publish week 1 and enter metrics before testing anything.",
          "Compare a 'mistake' hook vs a 'shortcut' hook.",
          "Compare carousel vs reel on the same hook (judge by saves).",
        ],
  };
}

export function postsToCsv(posts: Post[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Platform", "Format", "Hook", "Caption", "Status", "Day", "Time", "PublishMode", "ExternalId", "ExternalUrl", "PublishedAt", "Views", "Likes", "Comments", "Shares", "Saves", "Clicks", "WatchTimeSec", "Engagement", "EngagementRate"].join(","),
    ...posts.map((p) => {
      const m = p.metrics || {};
      const na = (n?: number) => (n === undefined ? "N/A" : n);
      const rate = engagementRate(p);
      return [
        esc(p.platformName), esc(p.format), esc(p.hook), esc(p.caption), p.status, p.scheduledDay, p.scheduledTime, p.publishMode,
        esc(p.externalId), esc(p.externalUrl), esc(p.publishedAt),
        na(m.views), na(m.likes), na(m.comments), na(m.shares), na(m.saves), na(m.clicks), na(m.watchTimeSec),
        engagement(p), rate === null ? "N/A" : rate.toFixed(4),
      ].join(",");
    }),
  ];
  return rows.join("\n");
}
