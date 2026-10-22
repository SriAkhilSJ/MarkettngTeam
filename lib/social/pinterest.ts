import { looksLikeImage, mediaList, titleFor, truncate } from "./compose";
import { checkCredentials, resolveToken } from "./credentials";
import { SocialApiError, asRecord, basicAuth, env, envBase, errMessage, fetchJson, form, str } from "./http";
import type { PlatformIntegration, TokenBag } from "./types";

/* Official docs:
 * Create pin: https://developers.pinterest.com/docs/api/v5/pins-create/ (POST /v5/pins)
 * Scopes: boards:read, boards:write, pins:read, pins:write, user_accounts:read.
 * Trial access uses the sandbox host (pins are hidden) — set PINTEREST_ENV=sandbox
 * or PINTEREST_API_BASE=https://api-sandbox.pinterest.com
 */

const PROVIDER = "pinterest";

function base(): string {
  if ((env("PINTEREST_ENV") || "").toLowerCase() === "sandbox" && !env("PINTEREST_API_BASE")) {
    return "https://api-sandbox.pinterest.com";
  }
  return envBase("PINTEREST_API_BASE", "https://api.pinterest.com");
}

export async function pinterestAccessToken(bag: TokenBag): Promise<string> {
  const t = resolveToken(bag, "pinterest", ["PINTEREST_ACCESS_TOKEN"], ["PINTEREST_REFRESH_TOKEN"]);
  if (t.token && !(bag.pinterest?.expiresAt && bag.pinterest.expiresAt < Date.now() + 60_000 && t.refreshToken)) return t.token;
  if (t.refreshToken) {
    const id = env("PINTEREST_APP_ID");
    const secret = env("PINTEREST_APP_SECRET");
    if (!id || !secret) throw new SocialApiError(PROVIDER, 400, "PINTEREST_APP_ID/SECRET required to refresh a Pinterest token.");
    const { data } = await fetchJson(`${base()}/v5/oauth/token`, {
      method: "POST", provider: PROVIDER,
      headers: { Authorization: basicAuth(id, secret), "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ grant_type: "refresh_token", refresh_token: t.refreshToken }),
    });
    const access = str(data.access_token);
    if (!access) throw new SocialApiError(PROVIDER, 502, "Pinterest refresh returned no access token.");
    return access;
  }
  throw new SocialApiError(PROVIDER, 401, "No Pinterest token. Add PINTEREST_ACCESS_TOKEN or Connect Pinterest.");
}

async function pinFetch(token: string, method: string, path: string, body?: Record<string, unknown>) {
  return fetchJson(`${base()}${path}`, {
    method, provider: PROVIDER,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function resolveBoardId(token: string, postBoardId?: string): Promise<string> {
  const fromPost = postBoardId?.trim();
  if (fromPost) return fromPost;
  const fromEnv = env("PINTEREST_BOARD_ID");
  if (fromEnv) return fromEnv;
  const { data } = await pinFetch(token, "GET", "/v5/boards?page_size=25");
  const items = Array.isArray(data.items) ? data.items : [];
  const first = str(asRecord(items[0]).id);
  if (!first) throw new SocialApiError(PROVIDER, 400, "No Pinterest board found. Create a board on Pinterest first (or set PINTEREST_BOARD_ID).");
  return first;
}

export const pinterestIntegration: PlatformIntegration = {
  check: (bag) => checkCredentials("pinterest", bag),
  test: async (bag) => {
    const check = checkCredentials("pinterest", bag);
    const out = { platformId: "pinterest", provider: PROVIDER, configured: check.configured, missing: check.missing, source: check.source, checkedAt: new Date().toISOString() };
    if (!check.configured) return { ...out, ok: false, message: "Add a Pinterest token (or Connect), then test again." };
    try {
      const token = await pinterestAccessToken(bag);
      const { data } = await pinFetch(token, "GET", "/v5/user_account");
      const sandbox = base().includes("sandbox");
      return { ...out, ok: true, account: str(data.username) || str(data.id), message: `Pinterest connection OK${sandbox ? " (SANDBOX — pins stay hidden)" : ""}.` };
    } catch (err) {
      return { ...out, ok: false, message: "Pinterest rejected the test call (check scopes + app access tier).", error: errMessage(err) };
    }
  },
  publish: async (post, bag, opts) => {
    const check = checkCredentials(post.platformId, bag);
    if (!check.configured) {
      return { ok: false, state: "not_configured", platformId: post.platformId, provider: PROVIDER, message: `Not configured. Missing: ${check.missing.join("; ")} — meanwhile post pins manually (free).`, error: `Missing: ${check.missing.join(", ")}`, warnings: [] };
    }
    const media = mediaList(post);
    const images = media.filter((u) => looksLikeImage(u));
    if (images.length === 0) {
      return { ok: false, state: "failed", platformId: post.platformId, provider: PROVIDER, message: "Pinterest needs an image. Design one in Canva (free), host it publicly, paste the URL in Media URLs.", error: "IMAGE_REQUIRED", warnings: [] };
    }
    const title = truncate(titleFor(post), 100);
    const description = truncate((post.caption || post.content || "").trim(), 800);
    const link = post.linkUrl?.trim() || undefined;
    if (opts.dryRun) {
      return { ok: true, state: "dry_run", platformId: post.platformId, provider: PROVIDER, message: "Dry run OK — nothing was posted.", warnings: base().includes("sandbox") ? ["Sandbox mode: a real publish would create a HIDDEN pin."] : [], planned: { title, description: description.slice(0, 200), link, images, boardId: post.boardId || env("PINTEREST_BOARD_ID") || "(first board)" } };
    }
    try {
      const token = await pinterestAccessToken(bag);
      const boardId = await resolveBoardId(token, post.boardId);
      const mediaSource =
        images.length > 1
          ? { source_type: "multiple_image_urls", items: images.slice(0, 5).map((url) => ({ url })) }
          : { source_type: "image_url", url: images[0] };
      const { data } = await pinFetch(token, "POST", "/v5/pins", {
        board_id: boardId,
        title,
        description,
        ...(link ? { link } : {}),
        media_source: mediaSource,
      });
      const pinId = str(data.id);
      if (!pinId) throw new SocialApiError(PROVIDER, 502, "Pinterest returned no pin id — NOT marking published. Check Pinterest before re-posting.");
      return {
        ok: true, state: "published", platformId: post.platformId, provider: PROVIDER,
        platformPostId: pinId, platformUrl: `https://www.pinterest.com/pin/${pinId}/`,
        message: `Pin created ✅${base().includes("sandbox") ? " (sandbox — hidden from public)" : ""}`,
        warnings: [],
      };
    } catch (err) {
      return { ok: false, state: "failed", platformId: post.platformId, provider: PROVIDER, message: "Pinterest publish failed. Post was NOT marked published.", error: errMessage(err), warnings: [] };
    }
  },
  metrics: async (post, bag) => {
    if (!post.externalId) return { platformId: post.platformId, ok: false, message: "Needs a published pin id." };
    try {
      const token = await pinterestAccessToken(bag);
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 89 * 86400_000).toISOString().slice(0, 10);
      const { data } = await pinFetch(token, "GET", `/v5/pins/${encodeURIComponent(post.externalId)}/analytics?start_date=${start}&end_date=${end}&metric_types=PIn_CLICK,IMPRESSION,SAVE,OUTBOUND_CLICK`.replace("PIn_CLICK", "PIN_CLICK"));
      const all = asRecord(asRecord(data.all).summary) as Record<string, unknown>;
      const summary = Object.keys(all).length ? all : asRecord(data.summary);
      const metrics: Record<string, number> = {};
      const impression = summary.IMPRESSION ?? summary.impression;
      const clicks = summary.PIN_CLICK ?? summary.pin_click;
      const saves = summary.SAVE ?? summary.save;
      if (typeof impression === "number") metrics.views = impression;
      if (typeof clicks === "number") metrics.clicks = clicks;
      if (typeof saves === "number") metrics.saves = saves;
      if (Object.keys(metrics).length === 0) return { platformId: post.platformId, ok: false, message: "Pinterest returned no analytics yet (new pins take time; sandbox pins have none). Use Pinterest Analytics manually." };
      return { platformId: post.platformId, ok: true, metrics, message: "Pinterest metrics fetched (90-day summary)." };
    } catch (err) {
      return { platformId: post.platformId, ok: false, message: "Pinterest analytics fetch failed — enter numbers from Pinterest Analytics instead.", error: errMessage(err) };
    }
  },
};
