# shreejalshah.com.np

My personal site. Static (GitHub Pages), no backend, no build step — but with a
self-serve **admin panel** that publishes new content with one click.

## Pages

| Page | Path | What it is |
|------|------|-----------|
| Home | `/` | Landing page + social links + nav |
| Blog | `/blog/` | Posts (Markdown). `?post=slug` shows a single post |
| Projects | `/projects/` | Project cards |
| Now | `/now/` | Running log of what I'm up to |
| Admin | `/admin/` | Write + publish content (not linked in nav) |

## How publishing works

Content lives in JSON files under `/data/` (`blog.json`, `projects.json`,
`now.json`). The pages fetch those files and render them in the browser.

The **admin panel** uses the GitHub API to commit changes to those JSON files
directly from the browser. When you hit *publish*:

1. it reads the current `data/*.json` from this repo,
2. prepends your new entry,
3. commits it back to the repo,
4. GitHub Pages rebuilds automatically → live in ~30–60 seconds.

No server required. The whole "BOOM it's posted" flow is just a GitHub commit.

## One-time setup (do this once)

1. **Create a GitHub token** (so the admin can commit for you):
   - Go to **GitHub → Settings → Developer settings → Personal access tokens →
     Fine-grained tokens → Generate new token**.
   - **Repository access:** Only select repositories → pick `shreexc/shree`.
   - **Permissions:** Repository permissions → **Contents: Read and write**.
   - Generate, copy the token (starts with `github_pat_…`).

2. **Open `/admin/` → Settings tab** and fill in:
   - Owner: `shreexc`  (pre-filled)
   - Repo: `shree`  (pre-filled)
   - Branch: `main`  (pre-filled)
   - Repo subfolder: *(leave blank — site files are at the repo root)*
   - Token: *(paste your token)*

   Click **Save settings**, then **Test connection** — you should see
   “Connected to shreexc/shree ✓”.

3. Done. Use the **blog / project / now** tabs to publish. Use **manage** to delete.

> Security: the token is stored only in your browser's `localStorage` and is
> sent only to `api.github.com`. The `/admin/` page is marked `noindex`. For
> extra safety, use a fine-grained token scoped to just this repo. If a token
> ever leaks, revoke it on GitHub and create a new one.

## Local preview

All asset paths are **relative**, so the site works whether it's served from the
repo root or from a parent folder (e.g. VS Code Live Server rooted at the
workspace). You must use a local server though — `fetch()` won't load the JSON
when opening files via `file://`.

```bash
# from inside the repo folder (the one with index.html)
python -m http.server 8000
# then visit http://localhost:8000

# or from the workspace root → visit http://localhost:8000/shree/
```

Tip: if styling ever looks missing, open DevTools → Network and check that
`style.css` returns 200, not 404 — a 404 means the server root is wrong.

(Publishing still commits to the live repo — local preview is for layout only.)

## Files

```
/index.html          home
/blog/index.html     blog (list + single post)
/projects/index.html projects
/now/index.html      now
/admin/index.html    admin panel
/style.css           shared styles
/assets/app.js       public rendering
/assets/admin.js     admin + GitHub publishing
/data/*.json         content
/CNAME               custom domain
```
