import type { Metrics, Post } from "../types";

export type OAuthProvider =
  | "meta"
  | "threads"
  | "google"
  | "linkedin"
  | "tiktok"
  | "x"
  | "pinterest"
  | "reddit";

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms */
  expiresAt?: number;
  scope?: string;
  accountId?: string;
  accountName?: string;
}

export type TokenBag = Partial<Record<OAuthProvider, StoredToken>>;

export interface PublishOptions {
  /** Validate + show planned payload, but make NO publishing call. */
  dryRun?: boolean;
}

export type PublishState =
  | "published"
  | "processing"
  | "failed"
  | "not_configured"
  | "dry_run";

export interface PublishResult {
  ok: boolean;
  state: PublishState;
  platformId: string;
  provider: string;
  platformPostId?: string;
  platformUrl?: string;
  message: string;
  error?: string;
  warnings: string[];
  /** Redacted summary of what was / would be sent (dry runs). */
  planned?: Record<string, unknown>;
}

export interface ConnectionTestResult {
  platformId: string;
  provider: string;
  configured: boolean;
  ok: boolean;
  missing: string[];
  source?: string;
  account?: string;
  message: string;
  error?: string;
  checkedAt: string;
}

export interface MetricsResult {
  platformId: string;
  ok: boolean;
  metrics?: Metrics;
  message: string;
  error?: string;
}

export interface CredentialCheck {
  configured: boolean;
  missing: string[];
  source?: string;
}

export interface PlatformIntegration {
  check: (bag: TokenBag) => CredentialCheck;
  test: (bag: TokenBag) => Promise<ConnectionTestResult>;
  publish: (post: Post, bag: TokenBag, opts: PublishOptions) => Promise<PublishResult>;
  metrics: (post: Post, bag: TokenBag) => Promise<MetricsResult>;
}
