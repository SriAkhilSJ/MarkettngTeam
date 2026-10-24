const $ = (id) => document.getElementById(id);
let CTX = null;
let LAST = null;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status}`);
  return body;
}

function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ── boot ─────────────────────────────────────────────────────────────── */
async function boot() {
  CTX = await api("/api/project");
  $("brandName").textContent = CTX.brand.name;
  $("tagline").textContent = CTX.brand.tagline + " · " + CTX.brand.url;

  const st = $("status");
  if (CTX.generator === "anthropic") {
    st.textContent = "claude · live";
    st.className = "status live";
  } else {
    st.textContent = "offline drafts";
    st.className = "status offline";
  }
  $("footnote").textContent =
    `${CTX.slug} · ${CTX.generator === "anthropic" ? "model-backed" : "no API key"} · rubric ${CTX.rubric.length} criteria / min ${CTX.min_score}`;

  const sel = $("platform");
  sel.innerHTML = "";
  for (const p of Object.keys(CTX.platform_rules)) {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = `${p} · ${CTX.platform_rules[p].max_chars} chars max`;
    sel.appendChild(o);
  }

  renderPerms();
  loadQueue();
}

function renderPerms() {
  const tb = document.querySelector("#perms tbody");
  tb.innerHTML = "";
  for (const [name, a] of Object.entries(CTX.actions)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><code>${name}</code></td>
      <td><span class="no">${a.scope}</span></td>
      <td class="${a.mutates ? "yes" : "no"}">${a.mutates ? "yes" : "no"}</td>
      <td class="no">${a.why}</td>`;
    tb.appendChild(tr);
  }
  const ul = $("locked");
  ul.innerHTML = "";
  for (const l of CTX.locked) {
    const li = document.createElement("li");
    li.innerHTML = `<b>${l.action}</b> — ${l.why}`;
    ul.appendChild(li);
  }
}

/* ── draft ────────────────────────────────────────────────────────────── */
$("draftBtn").addEventListener("click", async () => {
  const btn = $("draftBtn");
  btn.disabled = true;
  btn.textContent = "drafting…";
  try {
    const d = await api("/api/draft", {
      method: "POST",
      body: JSON.stringify({ platform: $("platform").value, idea: $("idea").value }),
    });
    LAST = d;
    renderScore(d);
  } catch (e) {
    toast("draft failed: " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Draft (agent action)";
  }
});

function renderScore(d) {
  const s = d.score;
  const box = $("scoreBox");
  const findings = s.findings
    .map((f) => `<div class="finding ${f.severity}">${f.severity === "block" ? "✗" : "!"} ${f.message}</div>`)
    .join("");
  const tags = d.hashtags.map((h) => `<span class="tag">${h}</span>`).join("");
  const sig = s.rubric_signals
    .map((r) => {
      const sym = r.signal === true ? "●" : r.signal === "?" ? "○" : "·";
      return `<span class="tag">${sym} ${r.criterion}</span>`;
    })
    .join("");

  box.className = "";
  box.innerHTML = `
    <div class="verdict ${s.verdict}">${s.verdict}</div>
    <p class="meta">${d.platform} · ${s.chars}/${s.max_chars} chars · ${s.hashtags} hashtags · source: ${d.source}</p>
    <pre class="draft-body">${d.body.replace(/</g, "&lt;")}</pre>
    ${tags ? `<div class="tags">${tags}</div>` : ""}
    ${findings || '<p class="meta">no findings — voice gate clean</p>'}
    <p class="meta" style="margin-top:12px">rubric signal</p>
    <div class="tags">${sig}</div>
    ${d.note ? `<p class="meta">${d.note}</p>` : ""}
    <div class="qrow">
      <button class="ghost ok" id="queueBtn" ${s.verdict === "hold" ? "disabled" : ""}>
        ${s.verdict === "hold" ? "blocked by voice gate" : "Queue for approval"}
      </button>
    </div>`;

  const qb = $("queueBtn");
  if (qb && s.verdict !== "hold") qb.addEventListener("click", () => queueDraft(d.id));
}

async function queueDraft(id) {
  try {
    await api("/api/queue", { method: "POST", body: JSON.stringify({ draft_id: id }) });
    toast("queued — waiting for your approval");
    loadQueue();
  } catch (e) {
    toast("blocked: " + e.message);
  }
}

/* ── queue ────────────────────────────────────────────────────────────── */
async function loadQueue() {
  const rows = await api("/api/queue");
  const box = $("queue");
  if (!rows.length) {
    box.className = "empty";
    box.textContent = "Nothing queued.";
    return;
  }
  box.className = "";
  box.innerHTML = "";
  for (const r of rows) {
    const el = document.createElement("div");
    el.className = "qitem";
    const decided = r.status !== "pending";
    el.innerHTML = `
      <div class="qhead">
        <span class="pill ${r.status}">${r.status}</span>
        <span class="meta" style="margin:0">${r.platform} · ${r.source}</span>
      </div>
      <pre class="qbody">${r.body.replace(/</g, "&lt;")}</pre>
      <div class="qrow">
        ${decided
          ? `<span class="meta" style="margin:0">decided by ${r.decided_by} at ${r.decided_at}</span>`
          : `<button class="ghost ok" data-ok="${r.id}">Approve</button>
             <button class="ghost bad" data-no="${r.id}">Reject</button>
             <button class="ghost" data-copy="${r.id}">Copy</button>`}
      </div>`;
    box.appendChild(el);
  }
  box.querySelectorAll("[data-ok]").forEach((b) =>
    b.addEventListener("click", () => decide(b.dataset.ok, "approved")));
  box.querySelectorAll("[data-no]").forEach((b) =>
    b.addEventListener("click", () => decide(b.dataset.no, "rejected")));
  box.querySelectorAll("[data-copy]").forEach((b) =>
    b.addEventListener("click", () => {
      const item = rows.find((x) => String(x.id) === b.dataset.copy);
      navigator.clipboard.writeText(item.body + (item.hashtags ? "\n\n" + JSON.parse(item.hashtags).join(" ") : ""));
      toast("copied — paste it yourself");
    }));
}

async function decide(id, decision) {
  try {
    await api("/api/decision", { method: "POST", body: JSON.stringify({ id, decision }) });
    toast(`marked ${decision}`);
    loadQueue();
  } catch (e) {
    toast("failed: " + e.message);
  }
}

boot().catch((e) => toast("cannot reach panel: " + e.message));
