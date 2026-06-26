/* ============================================================
   admin.js — publish to the live site with no backend.

   How it works:
   - You enter a GitHub Personal Access Token (PAT) + repo info once.
     It's saved in THIS browser's localStorage only (never sent anywhere
     except GitHub's API).
   - Each "publish" reads the relevant /data/*.json file from your repo
     via the GitHub Contents API, prepends your new entry, and commits it
     back. GitHub Pages rebuilds automatically → it's live for everyone.
   ============================================================ */

const LS_KEY = "shree_admin_cfg";

const FILES = {
  projects: "data/projects.json",
  now: "data/now.json",
};

/* ---------- config (localStorage) ---------- */
function loadCfg() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch {
    return {};
  }
}
function saveCfg(cfg) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}
function getCfg() {
  const c = loadCfg();
  return {
    owner: c.owner || "shreexc",
    repo: c.repo || "shree",
    branch: c.branch || "main",
    prefix: c.prefix || "", // repo subfolder that maps to the site root, if any
    token: c.token || "",
  };
}

/* ---------- base64 <-> utf8 ---------- */
function utf8ToB64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}

/* ---------- GitHub API ---------- */
function apiBase(cfg) {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/`;
}
function filePath(cfg, type) {
  const p = cfg.prefix ? cfg.prefix.replace(/^\/+|\/+$/g, "") + "/" : "";
  return p + FILES[type];
}
function headers(cfg) {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghGetFile(cfg, type) {
  const url = `${apiBase(cfg)}${filePath(cfg, type)}?ref=${cfg.branch}`;
  const res = await fetch(url, { headers: headers(cfg), cache: "no-store" });
  if (res.status === 404) return { items: [], sha: null }; // file doesn't exist yet
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub GET failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  let items = [];
  try {
    items = JSON.parse(b64ToUtf8(json.content)) || [];
  } catch {
    items = [];
  }
  return { items, sha: json.sha };
}

async function ghPutFile(cfg, type, items, sha, message) {
  const url = `${apiBase(cfg)}${filePath(cfg, type)}`;
  const body = {
    message,
    content: utf8ToB64(JSON.stringify(items, null, 2) + "\n"),
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(cfg), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub PUT failed (${res.status}): ${t.slice(0, 200)}`);
  }
  return res.json();
}

/* publish: read -> prepend -> write */
async function publish(type, entry, message) {
  const cfg = getCfg();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    throw new Error("Set your repo + token in Settings first.");
  }
  const { items, sha } = await ghGetFile(cfg, type);
  entry.id = Date.now();
  items.unshift(entry);
  await ghPutFile(cfg, type, items, sha, message);
  return entry;
}

async function deleteEntry(type, id) {
  const cfg = getCfg();
  const { items, sha } = await ghGetFile(cfg, type);
  const next = items.filter((x) => String(x.id) !== String(id));
  await ghPutFile(cfg, type, next, sha, `Delete ${type} entry ${id}`);
  return next;
}

/* ---------- UI helpers ---------- */
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return [...document.querySelectorAll(sel)]; }

function notify(msg, kind = "info") {
  const el = $("#notice");
  el.className = `notice ${kind}`;
  el.innerHTML = msg;
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function clearNotice() { $("#notice").classList.add("hidden"); }

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function splitList(s) {
  return (s || "").split(",").map((x) => x.trim()).filter(Boolean);
}

/* ---------- init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const cfg = getCfg();

  // hydrate settings form
  $("#cfg-owner").value = cfg.owner;
  $("#cfg-repo").value = cfg.repo;
  $("#cfg-branch").value = cfg.branch;
  $("#cfg-prefix").value = cfg.prefix;
  $("#cfg-token").value = cfg.token;

  // default dates
  $("#proj-date").value = todayISO();
  $("#now-date").value = todayISO();

  // tabs
  $all(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $all(".tab").forEach((t) => t.classList.remove("active"));
      $all(".panel").forEach((p) => p.classList.add("hidden"));
      tab.classList.add("active");
      $(`#panel-${tab.dataset.panel}`).classList.remove("hidden");
      clearNotice();
      if (tab.dataset.panel === "manage") loadManage();
    });
  });

  // save settings
  $("#cfg-save").addEventListener("click", () => {
    const next = {
      owner: $("#cfg-owner").value.trim(),
      repo: $("#cfg-repo").value.trim(),
      branch: $("#cfg-branch").value.trim() || "main",
      prefix: $("#cfg-prefix").value.trim(),
      token: $("#cfg-token").value.trim(),
    };
    saveCfg(next);
    notify("Settings saved to this browser. ✓", "ok");
  });

  // test connection
  $("#cfg-test").addEventListener("click", async () => {
    const c = getCfg();
    saveCfg({
      owner: $("#cfg-owner").value.trim(),
      repo: $("#cfg-repo").value.trim(),
      branch: $("#cfg-branch").value.trim() || "main",
      prefix: $("#cfg-prefix").value.trim(),
      token: $("#cfg-token").value.trim(),
    });
    notify("Testing…", "info");
    try {
      const cfg2 = getCfg();
      const res = await fetch(`https://api.github.com/repos/${cfg2.owner}/${cfg2.repo}`, {
        headers: headers(cfg2),
      });
      if (!res.ok) throw new Error(`${res.status} — check owner/repo/token (token needs "Contents: read & write").`);
      const j = await res.json();
      notify(`Connected to <b>${j.full_name}</b> (default branch: ${j.default_branch}). ✓`, "ok");
    } catch (e) {
      notify("Connection failed: " + e.message, "err");
    }
  });

  // ---- publish: project ----
  $("#proj-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("#proj-title").value.trim();
    if (!title) return notify("Title required.", "err");
    const entry = {
      title,
      date: $("#proj-date").value || todayISO(),
      description: $("#proj-desc").value.trim(),
      tech: splitList($("#proj-tech").value),
      status: $("#proj-status").value.trim(),
      link: $("#proj-link").value.trim(),
      repo: $("#proj-repo").value.trim(),
      image: $("#proj-image").value.trim(),
    };
    await runPublish("projects", entry, `Add project: ${title}`, e.submitter, () => {
      e.target.reset();
      $("#proj-date").value = todayISO();
    });
  });

  // ---- publish: now ----
  $("#now-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = $("#now-body").value.trim();
    if (!body) return notify("Write something first.", "err");
    const entry = { date: $("#now-date").value || todayISO(), body };
    await runPublish("now", entry, "Add now update", e.submitter, () => {
      e.target.reset();
      $("#now-date").value = todayISO();
    });
  });
});

async function runPublish(type, entry, message, btn, onDone) {
  const label = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = "publishing…"; }
  notify("Publishing to GitHub…", "info");
  try {
    await publish(type, entry, message);
    notify(
      "Published! 🎉 GitHub Pages is rebuilding — your post will be live in ~30–60s.",
      "ok"
    );
    onDone && onDone();
  } catch (e) {
    notify("Failed: " + e.message, "err");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

/* ---------- manage / delete ---------- */
async function loadManage() {
  const box = $("#manage-list");
  box.innerHTML = `<p class="loading">loading…</p>`;
  const cfg = getCfg();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    box.innerHTML = `<p class="empty">Set your repo + token in Settings first.</p>`;
    return;
  }
  try {
    const sections = [];
    for (const type of ["projects", "now"]) {
      const { items } = await ghGetFile(cfg, type);
      const rows = items
        .map(
          (it) => `
        <div class="manage-item">
          <span>${escapeHtmlA(it.title || it.body || "(untitled)").slice(0, 70)}<br>
            <small style="color:var(--muted)">${type} · ${it.date || ""}</small></span>
          <button class="del" data-type="${type}" data-id="${it.id}">delete</button>
        </div>`
        )
        .join("");
      sections.push(
        `<h3 style="margin:24px 0 4px">${type} (${items.length})</h3>${
          rows || '<p class="empty" style="padding:16px 0">none yet</p>'
        }`
      );
    }
    box.innerHTML = sections.join("");
    $all(".del").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this entry? This commits to your repo.")) return;
        b.disabled = true;
        b.textContent = "deleting…";
        try {
          await deleteEntry(b.dataset.type, b.dataset.id);
          notify("Deleted. Site will update in ~30–60s.", "ok");
          loadManage();
        } catch (e) {
          notify("Delete failed: " + e.message, "err");
          b.disabled = false;
          b.textContent = "delete";
        }
      })
    );
  } catch (e) {
    box.innerHTML = `<p class="empty">couldn't load: ${escapeHtmlA(e.message)}</p>`;
  }
}

function escapeHtmlA(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
