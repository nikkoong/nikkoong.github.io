# AGENTS.md

Static personal site: a macOS-style desktop portfolio in vanilla HTML/CSS/JS. No build
step, no package.json, no tests, no lint. GitHub Pages serves the repo directly from
`main` — committing/pushing to `main` is the deploy.

## Layout

- `index.html` — entire app shell: all window markup, inline `<symbol>` SVG icon defs, keyboard-shortcut hints. There is no template layer; this file is the app.
- `styles.css` — single stylesheet; dark tokens by default, light via `:root[data-appearance="light"]`.
- `app.js` — all UI logic (window manager, dock magnification, feed, notes, wallpaper picker, appearance, email copy).
- `assets/catalog.js`, `assets/feed.js`, `assets/notes.js` — content data only ("Data only, no logic"). Edit résumé roles/essays/notes here, not in HTML.
- `wallpapers/*.svg` — wallpaper files; must also be registered in the `WALLPAPERS` array in `app.js`.
- `substack_articles/` — gitignored local source exports; never commit it.
- Subpages are self-contained single-file HTML at repo root, linked from the Projects window with `target="_blank"` (e.g. `bagpipe-explainer.html`). Each has its own inline CSS/JS, opens with a `.top` bar whose brand and "Back to portfolio" links point to `/`, and is expected to stay usable at phone widths (its own `@media(max-width:560px)` rules). No `?v=` bump is needed when only a subpage's own inline code changes.

## Non-obvious conventions

- **Manual cache busting.** `index.html` references `styles.css`, `app.js`, the three `assets/*.js` data files, `favicon.svg`, and `assets/icon.svg` with a shared `?v=YYYYMMDD` query (currently `?v=20260902`). After editing any of those files, bump the shared version string on all seven references or browsers keep serving stale copies.
- **Windows auto-register** from `<section class="window" id="win-<id>">`; `app.js` derives the registry key from the id. A new window also needs a dock button with `data-win="<id>"`; ⌘1–⌘7 order comes from the `CMD_IDS` array, and per-window spawn positions from the `anchors` map in `placeWindow()`.
- **Content markup:** catalog notes support `*metric*` → bold via `rich()`; feed items are escaped with `esc()` so they must be plain text.
- **Theming:** appearance is applied pre-paint by an inline `<head>` script; localStorage keys are `no-appearance` and `no-wallpaper`. Keep both light/dark token sets in sync when adding colors.
- **Motion:** honor `prefers-reduced-motion` (the `reduce` flag); hide surfaces with `hideElement()` so the exit animation contract holds.
- **Fallbacks:** the `sr-only` h1, `noscript` block, and meta/OG descriptions duplicate résumé facts — update them together with About/catalog changes.
- Root files `CNAME`-free SEO/serving assets (`.nojekyll`, `google*.html`, `sitemap.xml`, `site.webmanifest`) must keep their exact names and paths.

## Verifying changes

No automated checks exist. Serve statically and exercise the UI manually:

```
python3 -m http.server 8000
```

Open http://localhost:8000/ and check: dock open/minimize/close, ⌘1–⌘7, Escape, window drag/zoom/resize, experience search, feed shuffle + streaming toggle, notes editing, appearance toggle, wallpaper picker, email copy (clipboard needs localhost/https — `file://` falls back to `execCommand`).
