/* ============================================================
   app.js — shared helpers for the public site
   - fetches content from /data/*.json
   - renders projects / now pages dynamically
   - no build step, no framework
   ============================================================ */

const SITE = {
  name: "Shreejal Shah",
  // content pages live one level deep (/projects/, /now/),
  // so data is one level up. relative paths work under any server root.
  data: {
    projects: "../data/projects.json",
    now: "../data/now.json",
  },
};

/* ---------- tiny utils ---------- */
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

async function loadData(url) {
  // cache-bust so freshly published posts show up without a hard refresh
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.json();
}

/* ---------- markdown ----------
   Uses marked if loaded; otherwise a minimal fallback so plain
   text / paragraphs still render readably.                       */
function md(text) {
  if (!text) return "";
  if (window.marked && typeof window.marked.parse === "function") {
    return window.marked.parse(text);
  }
  // fallback: escape + paragraphs + line breaks
  return escapeHtml(text)
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/* sort newest first by date, fallback to id */
function byNewest(a, b) {
  const da = new Date(a.date || 0).getTime();
  const dbb = new Date(b.date || 0).getTime();
  if (dbb !== da) return dbb - da;
  return (b.id || 0) - (a.id || 0);
}

/* ============================================================
   PROJECTS
   ============================================================ */
async function renderProjects(gridEl) {
  try {
    const items = (await loadData(SITE.data.projects)).sort(byNewest);
    if (!items.length) {
      gridEl.innerHTML = `<p class="empty">no projects yet.</p>`;
      return;
    }
    gridEl.innerHTML = items
      .map((p) => {
        const links = [];
        if (p.link) links.push(`<a href="${escapeHtml(p.link)}" target="_blank" rel="noopener">live &rarr;</a>`);
        if (p.repo) links.push(`<a href="${escapeHtml(p.repo)}" target="_blank" rel="noopener">code &rarr;</a>`);
        return `
        <div class="proj">
          ${p.image ? `<img class="proj-thumb" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}">` : ""}
          ${p.status ? `<span class="status">${escapeHtml(p.status)}</span>` : ""}
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.description || "")}</p>
          ${
            (p.tech || []).length
              ? `<div class="tag-row">${p.tech.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>`
              : ""
          }
          ${links.length ? `<div class="proj-links">${links.join("")}</div>` : ""}
        </div>`;
      })
      .join("");
  } catch (e) {
    gridEl.innerHTML = `<p class="empty">couldn't load projects.<br>${escapeHtml(e.message)}</p>`;
  }
}

/* ============================================================
   NOW
   ============================================================ */
async function renderNow(listEl) {
  try {
    const items = (await loadData(SITE.data.now)).sort(byNewest);
    if (!items.length) {
      listEl.innerHTML = `<p class="empty">nothing here yet.</p>`;
      return;
    }
    listEl.innerHTML = items
      .map(
        (u) => `
        <article class="entry">
          <p class="entry-meta"><span>${fmtDate(u.date)}</span></p>
          <div class="entry-body">${md(u.body)}</div>
        </article>`
      )
      .join("");
  } catch (e) {
    listEl.innerHTML = `<p class="empty">couldn't load updates.<br>${escapeHtml(e.message)}</p>`;
  }
}
