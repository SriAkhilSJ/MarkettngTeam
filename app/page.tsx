"use client";

import { useEffect, useMemo, useState } from "react";
import { DAYS, PLATFORMS } from "@/lib/platforms";
import { PROMPTS } from "@/lib/prompts";
import { analyze, engagement, engagementRate, postsToCsv } from "@/lib/analytics";
import type { GenerationResult, Goal, Post, PostStatus } from "@/lib/types";

type Tab = "create" | "board" | "week" | "analytics" | "prompts" | "integrations" | "setup";
const STORAGE_KEY = "auto-marketing-team-v1";
const SECRET_KEY = "auto-publish-secret";
const STATUSES: PostStatus[] = ["DRAFT", "READY", "APPROVED", "SCHEDULED", "PUBLISHED", "FAILED"];

interface Health { provider: string; demoMode: boolean; hint: string; configured: Record<string, boolean>; publishSecretRequired?: boolean; social?: { configuredCount: number; total: number } }
interface SavedState { result: GenerationResult | null; posts: Post[] }
interface IntegrationStatus {
  platformId: string; platformName: string; provider: string; configured: boolean; missing: string[]; source?: string;
  oauth: { provider: string; configured: boolean; missing: string[]; connected: boolean; redirectUri: string };
  docsUrl: string; capabilities: string; media: string; apiCost: string;
}
interface TestResultUi { ok: boolean; message: string; error?: string; account?: string; checkedAt?: string }

function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("create");
  const [health, setHealth] = useState<Health | null>(null);

  // Idea form
  const [topic, setTopic] = useState("3 AI automations that save time");
  const [audience, setAudience] = useState("Creators and entrepreneurs");
  const [goal, setGoal] = useState<Goal>("educate");
  const [cta, setCta] = useState('Comment "AUTO"');
  const [tone, setTone] = useState("direct and punchy");
  const [selected, setSelected] = useState<string[]>(PLATFORMS.map((p) => p.id));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [testResults, setTestResults] = useState<Record<string, TestResultUi>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  function loadIntegrations() {
    fetch("/api/integrations").then((r) => r.json()).then((d) => setIntegrations(d.integrations || [])).catch(() => setIntegrations([]));
  }

  // Load saved work + provider status (+ handle OAuth return / ?tab= deep links)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedState;
        if (saved.result) setResult(saved.result);
        if (Array.isArray(saved.posts)) setPosts(saved.posts);
      }
    } catch { /* ignore corrupt storage */ }
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
    loadIntegrations();
    const q = new URLSearchParams(window.location.search);
    const t = q.get("tab");
    if (t === "integrations" || t === "board" || t === "create" || t === "week" || t === "analytics" || t === "setup") setTab(t);
    if (q.get("connected")) setNotice(`Connected ${q.get("connected")} ✅ — now run Test Connection below.`);
    if (q.get("oauthError")) setError(q.get("oauthError") || "OAuth failed");
    if (t || q.get("connected") || q.get("oauthError")) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // Save automatically (free, no database needed)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ result, posts } satisfies SavedState)); } catch { /* full/blocked */ }
  }, [result, posts]);

  const analysis = useMemo(() => analyze(posts), [posts]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of posts) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [posts]);

  function togglePlatform(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function generate() {
    setError(""); setNotice(""); setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience, goal, cta, tone, platforms: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const gen = data as GenerationResult;
      setResult(gen);
      setPosts(gen.posts);
      setTab("board");
      setNotice(gen.mode === "demo"
        ? "Generated in FREE demo mode (templates). Edit the [EDIT ME] parts — or add a free Gemini/Groq key for real AI (Setup tab)."
        : `Generated with AI (${gen.provider}). Review every post before approving.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setLoading(false); }
  }

  function updatePost(id: string, patch: Partial<Post>) {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function updateMetric(id: string, key: string, value: string) {
    const num = value === "" ? undefined : Number(value);
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, metrics: { ...(p.metrics || {}), [key]: Number.isNaN(num) ? undefined : num } } : p)));
  }

  async function copyText(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setNotice(`Copied: ${label}`); }
    catch { setError("Copy failed — select the text and copy manually."); }
  }

  function copyForPosting(p: Post) {
    const text = [p.content, p.caption, p.hashtags.join(" ")].filter(Boolean).join("\n\n");
    copyText(text, `${p.platformName} post — paste it into the platform / its free native scheduler`);
  }

  function integFor(platformId: string): IntegrationStatus | undefined {
    return integrations.find((i) => i.platformId === platformId);
  }

  /** Fetch wrapper that supplies the optional publish secret (session only, never saved to disk by us). */
  async function guardedFetch(url: string, body: Record<string, unknown>): Promise<{ res: Response; data: Record<string, unknown> }> {
    const doFetch = (secret?: string | null) => fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(secret ? { "x-publish-secret": secret } : {}) },
      body: JSON.stringify(body),
    });
    let res = await doFetch(sessionStorage.getItem(SECRET_KEY));
    if (res.status === 401) {
      const entered = window.prompt("This deployment requires the publish secret (PUBLISH_SECRET). Enter it:");
      if (entered) {
        sessionStorage.setItem(SECRET_KEY, entered);
        res = await doFetch(entered);
      }
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { res, data };
  }

  async function publishViaApi(p: Post, dryRun: boolean) {
    if (!dryRun && !window.confirm(`Publish LIVE to ${p.platformName}?\n\n"${p.hook.slice(0, 120)}"\n\nThis posts to your real account via the official API. There is no undo here (delete on the platform if needed).`)) return;
    setBusy((b) => ({ ...b, [p.id]: true })); setError(""); setNotice("");
    try {
      const { res, data } = await guardedFetch("/api/publish", { post: p, dryRun });
      if (!res.ok) throw new Error((data.error as string) || `Publish request failed (${res.status})`);
      const result = data.result as Record<string, unknown>;
      const patch = (data.postPatch || {}) as Partial<Post>;
      if (Object.keys(patch).length) updatePost(p.id, patch);
      const msg = String(result.message || "Done");
      const warnings = Array.isArray(result.warnings) ? (result.warnings as string[]) : [];
      if (result.ok) setNotice([msg, ...warnings].join(" "));
      else setError([msg, result.error ? String(result.error) : "", ...warnings].filter(Boolean).join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally { setBusy((b) => ({ ...b, [p.id]: false })); }
  }

  /** Render a storyboard/text post into branded carousel PNGs (hosted on S3 when creds exist). */
  function canRender(p: Post): boolean {
    return p.platformId === "instagram-carousel" || p.platformId === "pinterest";
  }
  async function renderSlides(p: Post) {
    setBusy((b) => ({ ...b, [p.id]: true })); setError("");
    try {
      const { res, data } = await guardedFetch("/api/render", { id: p.id, post: p });
      if (!res.ok) throw new Error((data.error as string) || `Render failed (${res.status})`);
      const urls = (data.urls as string[]) || [];
      updatePost(p.id, { mediaUrls: urls });
      const parts = [`${urls.length} slide(s) rendered`];
      if (data.hosted) parts.push("and uploaded to S3 ✅ — ready to publish");
      else parts.push("locally — fine for preview/Dry run; for live publishing either add S3 creds or host images publicly");
      setNotice(parts.join(" — "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Render failed");
    } finally { setBusy((b) => ({ ...b, [p.id]: false })); }
  }

  async function publishAllApproved() {
    const due = posts.filter((p) => p.status === "APPROVED" || p.status === "SCHEDULED");
    if (!due.length) { setError("No APPROVED/SCHEDULED posts to publish."); return; }
    if (!window.confirm(`Publish ${due.length} approved post(s) LIVE via their APIs, one by one?\nUnconfigured platforms will fail cleanly (nothing is faked).`)) return;
    for (const p of due) {
      // sequential on purpose: rate limits + clear errors
      await publishViaApi({ ...p, status: "APPROVED" }, false);
    }
    setNotice("Bulk publish finished — check each post's status below. Failures are marked FAILED with the platform's reason.");
  }

  async function testConn(platformId: string) {
    setBusy((b) => ({ ...b, [`test-${platformId}`]: true })); setError("");
    try {
      const { res, data } = await guardedFetch("/api/integrations/test", { platformId });
      if (!res.ok) throw new Error((data.error as string) || `Test failed (${res.status})`);
      const result = data.result as TestResultUi;
      setTestResults((tr) => ({ ...tr, [platformId]: result }));
      loadIntegrations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection test failed");
    } finally { setBusy((b) => ({ ...b, [`test-${platformId}`]: false })); }
  }

  async function fetchPostMetrics(p: Post) {
    setBusy((b) => ({ ...b, [`metrics-${p.id}`]: true })); setError(""); setNotice("");
    try {
      const { res, data } = await guardedFetch("/api/metrics", { post: p });
      if (!res.ok) throw new Error((data.error as string) || `Metrics request failed (${res.status})`);
      const result = data.result as Record<string, unknown>;
      if (result.ok && result.metrics && typeof result.metrics === "object") {
        updatePost(p.id, { metrics: { ...(p.metrics || {}), ...(result.metrics as Post["metrics"]) } });
        setNotice(String(result.message || "Metrics updated"));
        setTab("analytics");
      } else {
        setError([String(result.message || "No metrics"), result.error ? String(result.error) : ""].filter(Boolean).join(" "));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Metrics fetch failed");
    } finally { setBusy((b) => ({ ...b, [`metrics-${p.id}`]: false })); }
  }

  async function disconnect(provider: string) {
    if (!window.confirm(`Disconnect ${provider}? This removes the OAuth token stored for this browser (env-var tokens are unaffected).`)) return;
    const secret = sessionStorage.getItem(SECRET_KEY);
    const res = await fetch(`/api/oauth/${provider}/disconnect`, { method: "POST", headers: { ...(secret ? { "x-publish-secret": secret } : {}) } }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as Record<string, unknown> | undefined;
    if (res?.ok) { setNotice(String(data?.message || "Disconnected")); loadIntegrations(); }
    else setError(String(data?.error || "Disconnect failed"));
  }

  function importJson(file: File) {
    file.text().then((t) => {
      try {
        const data = JSON.parse(t) as SavedState;
        if (!Array.isArray(data.posts)) throw new Error("No posts in file");
        setResult(data.result || null); setPosts(data.posts);
        setNotice(`Imported ${data.posts.length} posts.`); setTab("board");
      } catch { setError("Import failed: invalid backup file."); }
    });
  }

  return (
    <div>
      <header className="hero">
        <div className="hero-inner">
          <div className="kicker">Codeword: AUTO · Marketing Team</div>
          <h1>One idea in. Every platform out.</h1>
          <p>Give one idea → get a full week of ready-to-review content for Instagram, TikTok, YouTube, LinkedIn, X, Threads, Pinterest &amp; Reddit. You always approve before anything is posted.</p>
          <div className="flow">
            <span>IDEA</span><i>→</i><span>WRITE</span><i>→</i><span>ADAPT</span><i>→</i><span>CAPTIONS</span><i>→</i><span>APPROVE (YOU)</span><i>→</i><span>SCHEDULE</span><i>→</i><span>POST</span><i>→</i><span>TRACK</span>
          </div>
          {health && (
            <div className={`mode-pill ${health.demoMode ? "mode-demo" : "mode-ai"}`}>
              {health.demoMode ? "🆓 FREE DEMO MODE — no API key needed" : `🤖 AI MODE — ${health.provider}`}
            </div>
          )}
        </div>
      </header>

      <main className="wrap">
        <nav className="tabs">
          {([["create", "1 · Create"], ["board", `2 · Review & Publish (${posts.length})`], ["week", "3 · Week Plan"], ["analytics", "4 · Track & Learn"], ["prompts", "Prompts"], ["integrations", `🔌 Connections (${integrations.filter((i) => i.configured).length}/${integrations.length || 9})`], ["setup", "⚙️ Setup & Keys"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>
          ))}
          <span className="spacer" />
          {posts.length > 0 && (
            <>
              <button className="btn ghost small" onClick={() => download("content-tracker.csv", postsToCsv(posts), "text/csv")}>⬇ CSV Tracker</button>
              <button className="btn ghost small" onClick={() => download("auto-backup.json", JSON.stringify({ result, posts }, null, 2), "application/json")}>⬇ Backup JSON</button>
            </>
          )}
        </nav>

        {error && <div className="alert err">⚠ {error}</div>}
        {notice && <div className="alert ok">✅ {notice}</div>}
        {result?.warnings?.length ? <div className="alert warn">{result.warnings.map((w, i) => <div key={i}>• {w}</div>)}</div> : null}

        {/* ---------------- CREATE ---------------- */}
        {tab === "create" && (
          <section className="card">
            <h2>Step 1 — Give one idea</h2>
            <p className="sub">Four lines in. A week of content out. Works free right now in demo mode — no sign-up, no key.</p>
            <div className="grid2">
              <label className="f"><span>TOPIC *</span><input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. 3 AI automations that save time" /></label>
              <label className="f"><span>AUDIENCE</span><input type="text" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Who is this for?" /></label>
              <label className="f"><span>GOAL</span>
                <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
                  <option value="educate">Educate</option><option value="engage">Engage</option><option value="sell">Sell</option><option value="grow">Grow</option>
                </select></label>
              <label className="f"><span>CTA <small>(one ask only)</small></span><input type="text" value={cta} onChange={(e) => setCta(e.target.value)} placeholder='e.g. Comment "AUTO"' /></label>
              <label className="f"><span>TONE</span>
                <select value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option>direct and punchy</option><option>warm and friendly</option><option>dry and funny</option><option>bold and opinionated</option><option>calm and expert</option>
                </select></label>
            </div>

            <h3>Platforms <small style={{ color: "var(--muted)", fontWeight: 400 }}>(tick only the ones you actually post on)</small></h3>
            <div className="platforms">
              {PLATFORMS.map((p) => (
                <label key={p.id} className={`plat ${selected.includes(p.id) ? "on" : ""}`}>
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={() => togglePlatform(p.id)} />
                  <span><b>{p.name}</b><small>{p.format} · {p.defaultDay} {p.defaultTime}</small><small>{p.publishNote}</small></span>
                </label>
              ))}
            </div>

            <div className="row">
              <button className="btn primary" disabled={loading || !topic.trim() || selected.length === 0} onClick={generate}>
                {loading ? "Writing your week…" : `✨ Generate my week (${selected.length} posts)`}
              </button>
              <span className="note">Human approval is built in — nothing auto-posts. Ever.</span>
            </div>

            {result && (
              <>
                <h3>Sharpened angle</h3><p>{result.angle}</p>
                <h3>Master version (Hook / Body / Value / CTA)</h3>
                <p className="sub"><b>Hook options:</b></p>
                <ol>{result.master.hooks.map((h, i) => <li key={i}>{h}</li>)}</ol>
                <pre className="body">{result.master.body}</pre>
                <p><b>Value (do today):</b> {result.master.value}</p>
                <p><b>CTA:</b> {result.master.cta}</p>
                <button className="btn ghost small" onClick={() => setTab("board")}>Go review the {posts.length} posts →</button>
              </>
            )}
          </section>
        )}

        {/* ---------------- BOARD ---------------- */}
        {tab === "board" && (
          <>
            <section className="card">
              <h2>Step 2 — Review &amp; approve (you)</h2>
              <p className="sub">Read every post. Edit anything. Only <b>APPROVED</b> posts should be scheduled. Mark <b>PUBLISHED</b> only after you confirm it is actually live.</p>
              <div className="row">
                {STATUSES.map((s) => <span key={s} className={`badge status-${s}`}>{s}: {counts[s] || 0}</span>)}
                <span className="spacer" />
                <label className="btn ghost small">⬆ Import backup<input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} /></label>
                {posts.length > 0 && <button className="btn ghost small" onClick={() => { if (confirm("Clear all posts and metrics on this device?")) { setPosts([]); setResult(null); } }}>Clear all</button>}
              </div>
            </section>
            {posts.length === 0 && <div className="empty">No posts yet.<br /><button className="btn primary" style={{ marginTop: 12 }} onClick={() => setTab("create")}>Create your first week →</button></div>}
            {posts.map((p) => {
              const integ = integFor(p.platformId);
              const canPublish = p.status === "APPROVED" || p.status === "SCHEDULED";
              return (
              <article className="card" key={p.id}>
                <div className="post-head">
                  <span className="badge">{p.platformName}</span>
                  <span className="badge mode">{p.format}</span>
                  <span className={`badge status-${p.status}`}>{p.status}</span>
                  <span className="badge mode">{integ?.configured ? `🔌 API connected${integ.source ? ` (${integ.source})` : ""}` : "✋ Manual / not connected"}</span>
                  <span className="spacer" />
                  <button className="btn ghost small" onClick={() => copyForPosting(p)}>📋 Copy</button>
                  {canRender(p) && <button className="btn ghost small" disabled={busy[p.id]} title="Turn this post into branded carousel PNGs and attach them as Media URLs" onClick={() => renderSlides(p)}>🎨 Render slides</button>}
                  <button className="btn ghost small" disabled={busy[p.id]} onClick={() => publishViaApi(p, true)}>🧪 Dry run</button>
                  <button className="btn small" disabled={busy[p.id] || !canPublish} title={canPublish ? "Publish live via official API" : "Set status to APPROVED first"} onClick={() => publishViaApi(p, false)}>🚀 Publish via API</button>
                </div>
                <div className="hook">{p.hook}</div>
                <label className="f"><span>Content</span><textarea value={p.content} onChange={(e) => updatePost(p.id, { content: e.target.value })} rows={7} /></label>
                <label className="f"><span>Caption</span><textarea value={p.caption} onChange={(e) => updatePost(p.id, { caption: e.target.value })} rows={3} placeholder="(no separate caption for this platform)" /></label>
                {p.hashtags.length > 0 && <p className="tags">{p.hashtags.join(" ")}</p>}
                {p.notes && <p className="note">📝 {p.notes}</p>}
                <div className="grid2">
                  <label className="f"><span>Title <small>(YouTube / Pinterest / Reddit — blank = hook)</small></span><input type="text" value={p.title || ""} onChange={(e) => updatePost(p.id, { title: e.target.value })} placeholder={p.hook.slice(0, 80)} /></label>
                  <label className="f"><span>Link URL <small>(Pinterest destination / Reddit link post)</small></span><input type="text" value={p.linkUrl || ""} onChange={(e) => updatePost(p.id, { linkUrl: e.target.value })} placeholder="https://…" /></label>
                </div>
                <label className="f"><span>Media URLs <small>(one public https:// URL per line — required for Instagram / TikTok / YouTube / Pinterest{integ ? `: ${integ.media}` : ""})</small></span>
                  <textarea value={(p.mediaUrls || []).join("\n")} onChange={(e) => updatePost(p.id, { mediaUrls: e.target.value.split("\n") })} rows={2} placeholder={"https://your-cdn.example/video.mp4\nhttps://your-cdn.example/slide1.jpg"} /></label>
                {(p.platformId === "reddit" || p.platformId === "pinterest") && (
                  <div className="grid2">
                    {p.platformId === "reddit" && <label className="f"><span>Subreddit <small>(without r/ — only where you participate)</small></span><input type="text" value={p.subreddit || ""} onChange={(e) => updatePost(p.id, { subreddit: e.target.value })} placeholder="e.g. Entrepreneurs" /></label>}
                    {p.platformId === "pinterest" && <label className="f"><span>Board ID <small>(blank = env PINTEREST_BOARD_ID or your first board)</small></span><input type="text" value={p.boardId || ""} onChange={(e) => updatePost(p.id, { boardId: e.target.value })} placeholder="numeric board id" /></label>}
                  </div>
                )}
                {integ && !integ.configured && <p className="note">🔌 API not connected — missing: {integ.missing.join("; ")}. <button className="btn ghost small" onClick={() => setTab("integrations")}>Open Connections</button></p>}
                {p.publishError && <div className="alert err" style={{ marginTop: 8 }}>Last publish error: {p.publishError}</div>}
                {p.externalId && <p className="note">🔗 Platform id: <code>{p.externalId}</code>{p.externalUrl && <> · <a href={p.externalUrl} target="_blank" rel="noreferrer">View live post</a></>}{p.publishedAt && <> · {new Date(p.publishedAt).toLocaleString()}</>}</p>}
                <div className="grid2">
                  <label className="f"><span>Day</span><select value={p.scheduledDay} onChange={(e) => updatePost(p.id, { scheduledDay: e.target.value })}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select></label>
                  <label className="f"><span>Time</span><input type="time" value={p.scheduledTime} onChange={(e) => updatePost(p.id, { scheduledTime: e.target.value })} /></label>
                </div>
                <div className="row">
                  <span className="note"><b>Status:</b></span>
                  {STATUSES.map((s) => (
                    <button key={s} className={`btn small ${p.status === s ? "" : "ghost"}`} onClick={() => updatePost(p.id, { status: s })}>{s}</button>
                  ))}
                  <span className="spacer" />
                  {p.externalId && <button className="btn ghost small" disabled={busy[`metrics-${p.id}`]} onClick={() => fetchPostMetrics(p)}>📊 Fetch real metrics</button>}
                </div>
              </article>
              );
            })}
          </>
        )}

        {/* ---------------- WEEK ---------------- */}
        {tab === "week" && (
          <>
            <section className="card"><h2>Step 3 — Your week plan</h2><p className="sub">Mon–Fri posting, weekend off (only reply to comments). Change days in the Review tab. Post free using each platform&apos;s own scheduler — or copy-paste manually.</p></section>
            {posts.length === 0 ? <div className="empty">Generate a week first.</div> : (
              <div className="week">
                {DAYS.map((day) => {
                  const dayPosts = posts.filter((p) => p.scheduledDay === day).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
                  return (
                    <div className="daycol" key={day}>
                      <h3>{day}</h3>
                      {dayPosts.length === 0 && <p className="note">{day === "Saturday" || day === "Sunday" ? "Off 🎉 (reply to comments only)" : "—"}</p>}
                      {dayPosts.map((p) => (
                        <div className="mini" key={p.id}>
                          <b>{p.scheduledTime} · {p.platformName}</b>
                          {p.hook.slice(0, 90)}{p.hook.length > 90 ? "…" : ""}
                          <div className="row" style={{ marginTop: 6 }}><span className={`badge status-${p.status}`}>{p.status}</span><button className="btn ghost small" onClick={() => copyForPosting(p)}>📋 Copy</button></div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
            <section className="card" style={{ marginTop: 16 }}>
              <h3>Friday rule</h3><p className="sub" style={{ margin: 0 }}>Repost your best performer of the week to Stories. That&apos;s the whole Friday job.</p>
            </section>
          </>
        )}

        {/* ---------------- ANALYTICS ---------------- */}
        {tab === "analytics" && (
          <>
            <section className="card">
              <h2>Step 4 — Track &amp; learn</h2>
              <p className="sub">After posting, type the <b>real</b> numbers from each platform&apos;s free native analytics. Leave blank = <b>N/A</b>. Never guess — the system learns only from real data.</p>
              <div className="kpis">
                <div className="kpi"><b>{posts.length}</b><span>Posts planned</span></div>
                <div className="kpi"><b>{counts.PUBLISHED || 0}</b><span>Published</span></div>
                <div className="kpi"><b>{analysis.trackedCount}</b><span>With metrics</span></div>
                <div className="kpi"><b>{analysis.byPlatform[0]?.platform || "—"}</b><span>Best platform so far</span></div>
              </div>
              {analysis.notes.map((n, i) => <div className="alert warn" key={i}>{n}</div>)}
              {analysis.bestPost && <p>🏆 <b>Best post:</b> {analysis.bestPost.platformName} — “{analysis.bestPost.hook}” ({engagement(analysis.bestPost)} engagements)</p>}
              {analysis.weakestPost && <p>📉 <b>Weakest:</b> {analysis.weakestPost.platformName} — “{analysis.weakestPost.hook}” ({engagement(analysis.weakestPost)})</p>}
              <h3>What to test next</h3>
              <ul>{[...(result?.testsNext || []), ...analysis.testsNext].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5).map((t, i) => <li key={i}>{t}</li>)}</ul>
              <div className="row">
                <button className="btn ghost small" onClick={() => download("content-tracker.csv", postsToCsv(posts), "text/csv")}>⬇ Export tracker CSV (open in Google Sheets)</button>
                <span className="note">Loop: POST → TRACK → LEARN → IMPROVE. Every 2 weeks, paste this CSV into Prompt 5.</span>
              </div>
            </section>
            <section className="card tablewrap">
              <table>
                <thead><tr><th>Post</th><th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th><th>Saves</th><th>Clicks</th><th>Watch (sec)</th><th>Eng.</th><th>Rate</th></tr></thead>
                <tbody>
                  {posts.map((p) => {
                    const m = p.metrics || {}; const rate = engagementRate(p);
                    const cell = (k: keyof typeof m) => <input type="number" min={0} value={m[k] ?? ""} placeholder="N/A" onChange={(e) => updateMetric(p.id, k, e.target.value)} />;
                    return (
                      <tr key={p.id}>
                        <td><b>{p.platformName}</b><br /><small>{p.hook.slice(0, 60)}…</small><br /><span className={`badge status-${p.status}`}>{p.status}</span></td>
                        <td>{cell("views")}</td><td>{cell("likes")}</td><td>{cell("comments")}</td><td>{cell("shares")}</td><td>{cell("saves")}</td><td>{cell("clicks")}</td><td>{cell("watchTimeSec")}</td>
                        <td><b>{engagement(p)}</b></td><td>{rate === null ? "N/A" : `${(rate * 100).toFixed(1)}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {posts.length === 0 && <div className="empty">Generate and publish posts first.</div>}
            </section>
            {analysis.byPlatform.length > 0 && (
              <section className="card tablewrap"><h3>By platform (real numbers only)</h3>
                <table><thead><tr><th>Platform</th><th>Posts</th><th>Total engagement</th><th>Avg rate</th></tr></thead>
                  <tbody>{analysis.byPlatform.map((r) => <tr key={r.platform}><td>{r.platform}</td><td>{r.posts}</td><td>{r.totalEngagement}</td><td>{r.avgRate === null ? "N/A" : `${(r.avgRate * 100).toFixed(1)}%`}</td></tr>)}</tbody></table>
              </section>
            )}
          </>
        )}

        {/* ---------------- PROMPTS ---------------- */}
        {tab === "prompts" && (
          <section>
            <div className="card"><h2>The 6 prompts (from the PDF)</h2><p className="sub">Use these in ChatGPT/Claude for free, or let this app run them for you. The Master Prompt does everything in one paste.</p></div>
            {PROMPTS.map((pr) => (
              <details key={pr.id}>
                <summary>{pr.name} — <span className="note">{pr.job}</span></summary>
                <div className="prompt-body">{pr.body}</div>
                <div className="row" style={{ marginTop: 8 }}><button className="btn small" onClick={() => copyText(pr.body, pr.name)}>📋 Copy prompt</button></div>
              </details>
            ))}
          </section>
        )}

        {/* ---------------- SETUP ---------------- */}
        {tab === "setup" && (
          <section className="card">
            <h2>⚙️ Setup &amp; credentials — free as possible</h2>
            <p className="sub">Full step-by-step: <b>CREDENTIALS.md</b> in the repo. Short version below.</p>
            {health && <div className={`alert ${health.demoMode ? "warn" : "ok"}`}>{health.hint}</div>}
            <h3>✅ Needed NOW: nothing (₹0 / $0)</h3>
            <p>The app already works in demo mode. Your posts save in this browser. Posting = copy-paste + each platform&apos;s free built-in scheduler (Meta Business Suite, YouTube Studio, LinkedIn, etc.).</p>
            <h3>🤖 For real AI writing: add ONE free key (2 minutes)</h3>
            <div className="tablewrap"><table>
              <thead><tr><th>Option</th><th>Cost</th><th>Get key</th><th>Env var</th><th>Status</th></tr></thead>
              <tbody>
                <tr><td><b>A · Google Gemini (recommended)</b></td><td>Free tier</td><td>aistudio.google.com/apikey</td><td><code>GEMINI_API_KEY</code></td><td>{health?.configured.gemini ? "✅ set" : "—"}</td></tr>
                <tr><td><b>B · Groq</b></td><td>Free, no card</td><td>console.groq.com/keys</td><td><code>GROQ_API_KEY</code></td><td>{health?.configured.groq ? "✅ set" : "—"}</td></tr>
                <tr><td>C · OpenRouter</td><td>Free models (:free)</td><td>openrouter.ai/keys</td><td><code>OPENROUTER_API_KEY</code></td><td>{health?.configured.openrouter ? "✅ set" : "—"}</td></tr>
                <tr><td>D · OpenAI</td><td>Paid (skip for now)</td><td>platform.openai.com</td><td><code>OPENAI_API_KEY</code></td><td>{health?.configured.openai ? "✅ set" : "—"}</td></tr>
              </tbody></table></div>
            <p className="note">Steps: copy <code>.env.example</code> → <code>.env.local</code>, paste ONE key, restart the app. On Vercel: Project → Settings → Environment Variables. <b>Never share keys in chat or commit them to GitHub.</b></p>
            <h3>🌐 To deploy free</h3>
            <p>GitHub (you have it) → <b>Vercel Hobby (free)</b>: vercel.com → “Add New Project” → pick this repo → Deploy. No credit card. No database needed.</p>
            <h3>🔌 Social APIs: fully integrated ✅</h3>
            <p className="sub">All 9 publishers are wired (official APIs). Add credentials <b>one platform at a time</b>, then use <b>🔌 Connections → Test Connection</b>. Step-by-step for your end-testing: <b>TESTING.md</b>. Manual + native schedulers remain free fallbacks forever.</p>
            <p className="note">Before deploying publicly also set <code>SESSION_SECRET</code> (encrypts OAuth tokens) and <code>PUBLISH_SECRET</code> (locks Publish/Test endpoints).</p>
            <div className="tablewrap"><table>
              <thead><tr><th>Platform</th><th>API cost</th><th>Credentials you&apos;ll need</th><th>Free alternative</th></tr></thead>
              <tbody>{PLATFORMS.map((p) => <tr key={p.id}><td><b>{p.name}</b></td><td>{p.apiCost}</td><td><code>{p.credentials.join(", ")}</code></td><td>{p.publishNote}</td></tr>)}</tbody>
            </table></div>
            <div className="alert warn">⚠ <b>X (Twitter) API is NOT free</b> anymore (pay-per-use). Post to X manually = $0. Same advice for Reddit (manual is safest). Never use browser-automation bots on logged-in accounts — that gets accounts restricted.</div>
          </section>
        )}

        <footer className="footer">
          AUTO · Marketing Team — One idea in. Every platform out.<br />
          AI writes. You approve. You reply to comments. That human part builds the audience.
        </footer>
      </main>
    </div>
  );
}
