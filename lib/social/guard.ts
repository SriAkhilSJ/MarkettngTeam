import { timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { env } from "./http";

/**
 * Optional shared-secret gate for state-changing API calls.
 * If PUBLISH_SECRET is set (STRONGLY recommended before deploying publicly),
 * requests must send header: x-publish-secret: <value>.
 * Locally with no secret set, calls are open (single-user localhost use).
 */
export function publishSecretRequired(): boolean {
  return Boolean(env("PUBLISH_SECRET"));
}

export async function assertPublishAllowed(): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const secret = env("PUBLISH_SECRET");
  if (!secret) return { ok: true };
  const h = await headers();
  const given = h.get("x-publish-secret") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  return ok ? { ok: true } : { ok: false, status: 401, error: "Publish secret required or incorrect. Set the same value in the app when prompted (stored only in this browser tab)." };
}
