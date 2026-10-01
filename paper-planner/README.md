# Paper Planner

A local, single-user app for planning and organising research for seminar papers,
law review notes, and other long legal writing. One place per paper for a thesis
that changes over time, an argument outline, every source, every extract (quote)
pulled from a source, the links between quotes and the claims they support, and a
log of every citation used. The centre of the app is a visual argument map where
sections, sources, and quotes are linked by dragging.

The app organises. It never writes, summarises, suggests, or ranks. No AI, no
auth, no hosting, no cloud.

## Run it

Requires Node 20 or newer.

```bash
cd paper-planner
npm install
npm run dev
```

Open http://localhost:3000. The first start creates `data/planner.db`, applies the
migrations, seeds one placeholder paper so every page shows something, and writes
a backup.

On a Mac you can also double-click `scripts/launch-mac.command`. It installs
dependencies on first run, starts the server, and opens the browser. Copy it (or
an alias of it) to the Desktop for a one-click launcher; close its Terminal
window to stop the app.

- `npm run build && npm start` runs the production build.
- `npm run lint` runs ESLint; `npm run typecheck` runs `tsc`.
- `npm run seed` re-creates the placeholder paper (the dev server must be running;
  it POSTs to `/api/seed`).
- `package.json` has an `allowScripts` entry approving the install script of
  `better-sqlite3` (native build). npm blocks dependency install scripts unless
  they are listed there; the approval is pinned to an exact version, so after
  upgrading the package run `npm install-scripts approve better-sqlite3` and
  commit the change.

This folder is a standalone Next.js app inside the `Law-school-For-me` repo. The
study app at the repo root is untouched and has its own `npm run dev`.

## Desktop app (Electron, macOS)

The same app can run as a Mac desktop app from the Dock, with no terminal. The
Electron shell starts the production Next.js server inside its own process on a
free localhost port and opens one window on it. Every page and feature is the web
app unchanged.

### Run it in development

```bash
npm run electron:dev
```

This starts `next dev` under your system Node and, once it answers on port 3000,
compiles `electron/` and opens an Electron window on http://localhost:3000. Data
stays in the project's `data/` and `papers/` folders exactly as with `npm run dev`.
Quit the window to stop both.

### Build the .app

```bash
npm run dist
```

This compiles `electron/` to `dist-electron/`, runs `next build`, and runs
electron-builder for the current Mac architecture. Output goes to `release/`:
`release/mac-arm64/Paper Planner.app` (or `release/mac/` on Intel) and a `.dmg`.
Drag the `.app` to Applications or run it from `release/` directly.

The app is not code-signed (`identity: null`). **First launch:** right-click (or
Control-click) the app and choose Open, then Open again in the dialog. macOS only
asks once. If macOS says the app is damaged, it is the quarantine flag on an
unsigned app; run `xattr -dr com.apple.quarantine "/path/to/Paper Planner.app"`.

`asar` is off because Next reads its build output with ordinary file APIs.

`build/after-pack.js` runs after electron-builder copies the app. Turbopack writes
each `serverExternalPackages` entry (better-sqlite3, adm-zip, mammoth, docx) as a
relative symlink under `.next/node_modules/`, and electron-builder skips nested
`node_modules` folders, so the hook recreates those links inside the `.app`.
Without it the packaged server fails on start with "Cannot find module
better-sqlite3-<hash>".

Only macOS targets are configured. (During development the same config was
exercised with `electron-builder --linux dir` to run the packaged app under Xvfb;
that target is not part of `npm run dist`.)

### Where the desktop app keeps data

The packaged app sets `PAPER_PLANNER_HOME` to

```
~/Library/Application Support/Paper Planner/
  planner.db
  papers/<slug>/sources/*.pdf
  papers/<slug>/drafts/*.docx
  window-state.json
```

Exports still go to `~/Documents/paper-exports/` and backups to
`~/Documents/paper-planner-backups/`, and the backup-on-start rule (newest
backup older than a day) still applies. Export and backup success messages show a
**Reveal in Finder** button in the desktop app.

All filesystem locations are decided in `src/lib/paths.ts`:

- `PAPER_PLANNER_HOME`: folder holding `planner.db` and `papers/`. Unset means the
  project's `data/planner.db` and `papers/`, so `npm run dev` is unchanged.
- `PAPER_PLANNER_APP_DIR`: folder holding the app's own files (`db/migrations`,
  `.next`). Unset means the working directory. The shell sets it to the packaged
  app folder.

Stored file paths (`sources.pdf_path`, `drafts.file_path`) are relative to that
home, e.g. `papers/<slug>/sources/x.pdf`, so a data folder moves as a unit.

### Data menu

- **Reveal Data Folder in Finder**: opens the folder above with `planner.db` selected.
- **Import Data from Folder…**: pick a folder that contains `planner.db` (or
  `data/planner.db`) and optionally `papers/`. A project checkout such as
  `paper-planner/` from `npm run dev`, or an unzipped backup, both work. After a
  confirmation, the app writes a safety backup of the current data, restarts, and
  copies the chosen files over the current `planner.db` and `papers/` before the
  database is opened. Import is disabled in `electron:dev`, where `next dev` holds
  the database open in another process.
- **Back Up Now**: runs the same backup as the home-page button and offers to
  reveal the zip.

### Window and shell behaviour

Single window that remembers its size and position; a second launch focuses the
existing window. Standard Edit menu shortcuts, View → Back/Forward, Reload and
Toggle Developer Tools. Links to the app's own localhost origin stay in the
window; any other `http(s)` link opens in the default browser. PDFs render in
Chromium's built-in viewer. `contextIsolation` is on and `nodeIntegration` off;
the only bridge exposed to the page is `window.paperPlanner.revealInFinder(path)`,
which accepts paths under the exports, backups, or data folders. On quit the
shell closes the HTTP server, the Next server, and the SQLite connection.

### Native module note

`better-sqlite3` 13 is a Node-API module that ships prebuilt binaries for
`darwin-arm64` and `darwin-x64` in the npm package, and the same binary loads in
Electron's Node, so no Electron-ABI rebuild is needed. The electron-builder config
therefore sets `npmRebuild: false`, which also means building the app needs no
Xcode toolchain. The `postdist` script (`npm rebuild better-sqlite3`) is kept as a
safety net so `node_modules` is always left in the state `npm run dev` expects;
with the prebuilt binary it is a quick no-op. If a future better-sqlite3 drops
Node-API prebuilds, set `npmRebuild` back to `true` and the `postdist` restore
becomes necessary again.

`npm install` on npm 12 needs the install script of `electron` (which downloads
the Electron binary) approved; `package.json` lists `electron@44.5.1` under
`allowScripts` next to the existing `better-sqlite3` approval. `@electron/rebuild`
has no install script. After upgrading Electron, run
`npm install-scripts approve electron` and commit the change.

## Stack

Next.js 16 (App Router, Turbopack) + TypeScript, Tailwind v4 for minimal styling.
SQLite via `better-sqlite3` for all structured data; files on disk under
`papers/<paper-slug>/`. Libraries: `cytoscape` + `cytoscape-dagre` (argument map,
top-down tree layout), `cytoscape-svg` (SVG export), `mammoth` (reads `.docx`
text for word counts), `docx` (writes `.docx` exports), `adm-zip` (backups).
Everything is served from `node_modules`; nothing is loaded from a CDN, so the app
works offline.

## Where things live

```
paper-planner/
  data/planner.db                 SQLite database (gitignored)
  papers/<slug>/sources/*.pdf     uploaded PDFs (gitignored)
  papers/<slug>/drafts/*.docx     uploaded drafts (gitignored)
  db/migrations/NNN_name.sql      numbered migrations, applied on startup
  src/app/                        pages, server actions (actions.ts), route handlers (api/)
  src/components/                 client components (outline tree, map, linker, forms)
  src/lib/queries/                all SQL, one module per area
  src/lib/export.ts               .docx / .md export
  src/lib/backup.ts               zip backup
  src/lib/seed.ts                 placeholder paper
  src/instrumentation.ts          runs once per server start (migrate, seed, backup)
  electron/                       desktop shell: main.ts (server + window), menu.ts, preload.ts
  dist-electron/                  compiled shell (gitignored)
  build/icon.png                  app icon source; electron-builder makes the .icns
  release/                        packaged .app and .dmg (gitignored)
~/Documents/paper-exports/        exports: <slug>-<date>.docx / .md, <slug>-sources-<date>.docx / .md
~/Documents/paper-planner-backups <date-time>.zip containing data/planner.db and papers/
```

Paths under `~` are resolved with `os.homedir()`.

## Pages

| URL | What it is |
| --- | --- |
| `/` | Papers with status, next milestone and days to it, counts of unread sources, unlinked sources, unlinked extracts, unsupported sections. New paper form. Backup button. |
| `/papers/<slug>` | Dashboard: four attention lists (sources linked to no section, extracts linked to no section, sections with no support, log entries missing a pin cite or unverified), milestones, open questions, thesis with revise form and collapsed history, latest draft word count against the limit, paper settings. |
| `/papers/<slug>/outline` | The section tree. Drag the handle to reorder or re-parent (drop on a section to nest; ↑ ↓ ← → buttons do the same). Click a heading or claim to edit inline. Status and role per section, support count, counterargument/response pairing with a "responds to" picker. Expand a section to see and add source links and extracts, and to add a child section. |
| `/papers/<slug>/sources` | Table sortable by type, year, read status, tag; filter by tag. Add form with optional PDF upload. |
| `/papers/<slug>/sources/<id>` | Split view: PDF on the left in an iframe (served by `/api/sources/<id>/pdf`), or the URL and citation if there is no PDF; extract capture on the right. Below: extracts, section links with "what this proves" notes, link-to-section form, edit, delete, copy to another paper. |
| `/papers/<slug>/quotes` | Quote bank with filters (kind, section, source, tag, unlinked only) and FTS5 full-text search over text and notes. `?mode=linker` is the two-column linker: click a quote then a section, or drag a quote onto a section. |
| `/papers/<slug>/citations` | Citation log. Sort by outline order, source, or date; filter unverified or missing pin cite. Inline edit of pin cite, used in, note; verified checkbox; manual add. Rows show which extract or link they came from. |
| `/papers/<slug>/drafts` | Upload a `.docx` to log it. Word count computed with mammoth (raw text split on whitespace). Download links. |
| `/papers/<slug>/map` | Argument map. Filters, re-layout, fit, SVG and PNG export. |
| `/papers/<slug>/export` | Whole paper or bare source list to `.docx` or `.md`. |

### Argument map

Thesis at the root, sections as a top-down dagre tree, sources and extracts hanging
off the sections they are linked to, and a dashed "staging" box at the right edge
with every unlinked source and extract. Section colour by role, source colour by
read status, extract nodes small and labelled with short cite + pin cite.
Sections with zero support have a dashed red border. A counterargument and its
response are joined by a dashed red arrow.

Drag a source or extract node (from staging or from another section) and drop it
on a section to link it. An extract links immediately. A source opens a small
form for purpose and the required "what this proves" note. Both write a citation
log row. Click a node to open its page. Dropping anywhere else snaps the node back.

## Data model

All tables are in `db/migrations/001_init.sql`. Foreign keys are on. Dates are
SQLite `datetime('now')` (UTC) unless noted.

| Table | Columns |
| --- | --- |
| `papers` | id, title, slug (unique, generated from title, editable), venue, word_limit, status (planning / researching / drafting / revising / submitted), thesis, created_at |
| `thesis_versions` | id, paper_id, text, note, created_at. One row per revision; the paper's `thesis` column holds the current text. |
| `milestones` | id, paper_id, name, due_date (YYYY-MM-DD or null), done, sort_order. Six defaults per paper. |
| `tags` | id, paper_id, name (unique per paper, case-insensitive on lookup) |
| `sections` | id, paper_id, parent_id (null = top level), sort_order, heading, claim, status (empty / notes / drafted / revised), word_target, role (argument / counterargument / response / background), responds_to (only when role = response; must be a counterargument in the same paper), created_at |
| `sources` | id, paper_id, type (case / statute / regulation / article / book / treatise / website / other), citation, short_cite, year, publisher, url, pdf_path (relative to the app folder), read_status (unread / skimmed / read), relevance, created_at |
| `source_tags` | source_id, tag_id |
| `extracts` | id, source_id, pin_cite (required), text, note, kind (support / counter / background / definition), created_at |
| `extract_tags` | extract_id, tag_id |
| `extract_sections` | extract_id, section_id, created_at. An extract with no row here is "unlinked". |
| `section_sources` | id, section_id, source_id, purpose (support / counter / background), note (required), created_at. Unique per (section, source). |
| `citation_log` | id, paper_id, source_id, pin_cite (nullable), section_id (nullable), extract_id (nullable), used_in, verified, note, origin (manual / extract_link / source_link), created_at |
| `open_questions` | id, paper_id, section_id (nullable), text, resolved, created_at |
| `drafts` | id, paper_id, file_path, word_count, note, created_at |
| `extracts_fts` | FTS5 virtual table over `extracts(text, note)` kept in sync by triggers |
| `schema_version` | version, name, applied_at |
| `meta` | key, value (currently only `seeded`) |

"Support" for a section = count of its `section_sources` rows + count of its
`extract_sections` rows. Support 0 means "unsupported".

## Decisions

- **Unlinked source** means a source with no `section_sources` row. An extract
  linked to a section does not by itself make its source "linked"; the source
  hangs off a section on the map only through a direct section–source link. This
  keeps the two kinds of link (source-level and quote-level) independent, as the
  spec separates them.
- **Citation log rows are a log.** Linking an extract to a section writes a row
  with the pin cite copied in; a section–source link writes a row with an empty
  pin cite. Unlinking, deleting an extract, or deleting a section never deletes a
  log row (`section_id` / `extract_id` become null). Deleting a source does
  delete its log rows, because a row must point at a source.
- **Deleting a section** moves its children up to its parent, in place. Its
  source links and extract links are removed. Responses that pointed at a deleted
  counterargument get `responds_to = null`. Changing a section's role away from
  `response` clears `responds_to`; changing a counterargument to another role
  clears every response that pointed at it.
- **Slugs** are generated from the title and made unique with a numeric suffix.
  Editing the slug changes the URL only; files already under `papers/<old-slug>/`
  stay where they are (paths are stored per file).
- **Copy to another paper** copies the source row, its tag names (creating tags in
  the target paper), and its PDF file. Extracts, links, and log rows are not
  copied.
- **FTS queries** are sanitised: each whitespace-separated term is double-quoted,
  so punctuation in the search box never produces an FTS5 syntax error.
- **Exports** never reformat citations. The `.docx` and `.md` writers consume the
  same block list, so the content and order are identical. If a file for today
  already exists, a `-2`, `-3`… suffix is added instead of overwriting.
- **Backups** copy the live database with SQLite's online backup API (so WAL
  contents are included) before zipping. On every server start, a backup runs if
  the newest file in the backup folder is older than 24 hours.
- **Seeding** runs once, on the first start with an empty database, and is
  recorded in `meta.seeded`. Deleting the placeholder paper does not bring it
  back; `npm run seed` does.
- **Mutations** are Next.js server actions. The app is local and single-user, so
  every action calls `revalidatePath("/", "layout")` and pages read straight from
  SQLite on each request (`force-dynamic`). Edit-in-place forms are keyed on the
  value they edit so React's post-action form reset always shows the saved value.
- **Drag and drop** in the outline and the linker uses native HTML5 drag events
  (no extra library). The map uses cytoscape's own node dragging and detects a
  drop by checking whether the dropped node's centre is inside a section node.
- **PDF viewing** relies on the browser's built-in PDF viewer in an iframe. The
  route handler sends `Content-Type: application/pdf` and `inline`.

## Not built, on purpose

Citation formatting or checking against Bluebook, summarising, drafting, AI of any
kind, suggested links, auto-tagging, reading-order or priority recommendations,
draft diffs, web clipping, Westlaw/Lexis integration, collaboration, cloud sync.
