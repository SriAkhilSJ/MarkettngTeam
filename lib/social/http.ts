/**
 * Small HTTP helpers for official social APIs. Server-side only.
 * - Timeouts on every call
 * - Errors surfaced honestly (status + truncated body), secrets redacted
 * - SSRF guard for user-supplied media URLs we download ourselves
 */

export class SocialApiError extends Error {
  status: number;
  provider: string;
  details?: string;
  constructor(provider: string, status: number, message: string, details?: string) {
    super(message);
    this.provider = provider;
    this.status = status;
    this.details = details;
  }
}

export function env(name: string): string | undefined {
  const v = process.env[name];
  const t = v?.trim();
  return t ? t : undefined;
}

export function envBase(name: string, fallback: string): string {
  return (env(name) || fallback).replace(/\/+$/, "");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Hide secrets that platforms echo back in error bodies / URLs. */
export function redact(text: string): string {
  return text
    .replace(/(access_token|refresh_token|client_secret|code|password|assertion)=([^&\s"']+)/gi, "$1=***")
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g, "$1 ***")
    .slice(0, 1200);
}

export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
export function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : v !== undefined && v !== null && typeof v !== "object" ? String(v) : undefined;
}
export function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

interface FetchJsonOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | URLSearchParams | Uint8Array | undefined;
  timeoutMs?: number;
  provider: string;
  /** Treat these statuses as success (e.g. YouTube 308). */
  okStatuses?: number[];
}

export interface FetchJsonResult {
  status: number;
  data: Record<string, unknown>;
  raw: string;
  headers: Headers;
}

export async function fetchJson(url: string, opts: FetchJsonOptions): Promise<FetchJsonResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || "GET",
      headers: opts.headers,
      body: opts.body as BodyInit | undefined,
      signal: ctrl.signal,
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? (err.name === "AbortError" ? "Request timed out" : err.message) : "Network error";
    throw new SocialApiError(opts.provider, 0, `${opts.provider} network error: ${msg}`);
  }
  clearTimeout(timer);
  const raw = await res.text().catch(() => "");
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  const ok = res.ok || (opts.okStatuses || []).includes(res.status);
  if (!ok) {
    const errObj = asRecord(data.error);
    const apiMsg =
      str(errObj.message) || str(data.error_description) || str(data.message) || str(data.title) || raw.slice(0, 300);
    throw new SocialApiError(
      opts.provider,
      res.status,
      `${opts.provider} API ${res.status}: ${redact(apiMsg || res.statusText)}`,
      redact(raw)
    );
  }
  return { status: res.status, data, raw, headers: res.headers };
}

export function form(params: Record<string, string | number | boolean | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) u.set(k, String(v));
  }
  return u.toString();
}

export function basicAuth(id: string, secret: string): string {
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

/* ---------------- Media URL safety + download ---------------- */

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h === "::1" || h === "[::1]") return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return true;
  }
  return false;
}

/** Validate a user-supplied media URL that OUR server will fetch. */
export function assertPublicMediaUrl(rawUrl: string, provider: string): URL {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new SocialApiError(provider, 400, `Invalid media URL: ${rawUrl.slice(0, 120)}`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new SocialApiError(provider, 400, "Media URL must start with http:// or https://");
  }
  const allowPrivate = env("ALLOW_PRIVATE_MEDIA_URLS") === "1" || env("ALLOW_PRIVATE_MEDIA_URLS") === "true";
  if (!allowPrivate && isPrivateHost(u.hostname)) {
    throw new SocialApiError(provider, 400, "Media URL points to a private/local address — use a publicly hosted file.");
  }
  return u;
}

export interface DownloadedMedia {
  bytes: Uint8Array;
  contentType: string;
}

export async function downloadMedia(rawUrl: string, provider: string, maxMb = 100): Promise<DownloadedMedia> {
  const u = assertPublicMediaUrl(rawUrl, provider);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(u, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new SocialApiError(provider, res.status, `Could not download media (${res.status}) from ${u.hostname}`);
    const len = Number(res.headers.get("content-length") || 0);
    if (len > maxMb * 1024 * 1024) throw new SocialApiError(provider, 413, `Media file too large (>${maxMb} MB). Upload it manually or use a smaller file.`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxMb * 1024 * 1024) throw new SocialApiError(provider, 413, `Media file too large (>${maxMb} MB).`);
    return { bytes: buf, contentType: res.headers.get("content-type") || "application/octet-stream" };
  } catch (err) {
    if (err instanceof SocialApiError) throw err;
    throw new SocialApiError(provider, 0, `Media download failed: ${err instanceof Error ? err.message : "unknown error"}`);
  } finally {
    clearTimeout(timer);
  }
}

export function errMessage(err: unknown): string {
  if (err instanceof SocialApiError) {
    // Append provider's raw error body when it adds info the user needs
    // (e.g. Google's invalid_grant description, LinkedIn's blocked details).
    if (err.details && !err.message.includes(err.details.slice(0, 80))) {
      return `${err.message} — details: ${err.details}`;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Unknown error";
}

export function pollSettings(): { attempts: number; intervalMs: number } {
  return {
    attempts: Math.max(1, Number(env("SOCIAL_POLL_ATTEMPTS") || 10)),
    intervalMs: Math.max(0, Number(env("SOCIAL_POLL_INTERVAL_MS") || 4000)),
  };
}
