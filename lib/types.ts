export type Goal = "educate" | "engage" | "sell" | "grow";

export type PostStatus =
  | "DRAFT"
  | "READY"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

export type PublishMode = "api" | "scheduler" | "manual";

export interface IdeaInput {
  topic: string;
  audience: string;
  goal: Goal;
  cta: string;
  tone: string;
  platforms: string[]; // platform ids from lib/platforms.ts
}

export interface MasterContent {
  hooks: string[]; // 3 options
  body: string;
  value: string;
  cta: string;
}

export interface Post {
  id: string;
  platformId: string;
  platformName: string;
  format: string;
  hook: string;
  content: string;
  caption: string;
  hashtags: string[];
  scheduledDay: string; // Monday..Sunday
  scheduledTime: string; // HH:MM
  publishMode: PublishMode;
  status: PostStatus;
  notes?: string;
  // ---- publishing inputs (Phase 4 integrations) ----
  /** Optional explicit title (YouTube/Pinterest/Reddit). Falls back to hook. */
  title?: string;
  /** Public https:// URLs of images/videos for media platforms. */
  mediaUrls?: string[];
  /** Destination link (Pinterest pin link, Reddit link post). */
  linkUrl?: string;
  /** Reddit only: subreddit name without r/ */
  subreddit?: string;
  /** Pinterest only: board id (else env/first board is used). */
  boardId?: string;
  // ---- publishing results — set ONLY on confirmed API success ----
  externalId?: string;
  externalUrl?: string;
  publishedAt?: string; // ISO
  publishError?: string;
  lastPublishAttemptAt?: string; // ISO
  // analytics (undefined = N/A, never guessed)
  metrics?: Metrics;
}

export interface Metrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  watchTimeSec?: number;
}

export interface GenerationResult {
  mode: "ai" | "demo";
  provider: string;
  angle: string;
  master: MasterContent;
  posts: Post[];
  testsNext: string[];
  warnings: string[];
}
