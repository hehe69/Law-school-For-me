# Law Outlines

A local, single-user outline editor built for law school outlines: deep
hierarchy with legal numbering, typed nodes for rules, elements, cases and
hypos, and views for exam day. It organises what you write; it never writes,
summarises or fills sections for you.

No AI features, no accounts, no hosting. Everything lives in a SQLite
database and an uploads folder on your Mac.

> Build status: **phase 1 of 6** is done (data model, courses and outlines,
> the tree editor with numbering, keyboard, drag and drop, status, skeleton
> mode, autosave and undo, and a sample course). Phases 2–6 add node fields
> and links, the syllabus and imports, exam-day views, drills and progress,
> and printing, exports, snapshots, backups and the packaged Mac app. This
> README grows with each phase.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first start creates the database at
`~/Documents/law-outlines/outlines.db` and seeds one sample course
("Property (sample)") that uses every node type. Delete it from its course
page once you have your own courses.

- `npm run dev` starts the development server (localhost only).
- `npm run build && npm start` runs the production build.
- `npm run lint`, `npm run typecheck` and `npm test` check the code.
- `package.json` has an `allowScripts` entry approving the install scripts
  of `better-sqlite3` (native SQLite), `unrs-resolver` (used by ESLint) and
  `electron` (downloads the Electron binary). npm 12 blocks dependency
  install scripts unless they are listed there. The approvals are pinned to
  exact versions, so after upgrading one of those packages run
  `npm install-scripts approve <package>` and commit the change.

Set `LAW_OUTLINES_DATA_DIR` to keep the database and uploads somewhere
else (the Mac app sets it for you).

## Keyboard shortcuts (editor)

| Keys | What |
| --- | --- |
| Enter | New sibling below (with the caret at the start of a title: above) |
| Shift+Enter | New sibling above |
| ⌘Enter | New child |
| Tab / Shift+Tab | Indent / outdent the selection |
| ⌘↑ / ⌘↓ | Move the node; its children stay where they are |
| ⌘⇧↑ / ⌘⇧↓ | Move the node with its children |
| ↑ / ↓ | Previous / next row |
| ⇧↑ / ⇧↓ | Extend the selection |
| ⌘. | Collapse / expand |
| Backspace on an empty title | Delete the node |
| ⌘Backspace | Delete the selection with children |
| ⌘Z / ⌘⇧Z | Undo / redo (100 steps) |
| ⌘K | Command palette: jump to any node or run any command |
| ⌘F | Search |
| ⌘E | Edit the fields of the active node in the side panel |
| Esc | Back to the tree from any field |
| Shift+click / ⌘click | Select a range / toggle a row |

On Windows or Linux, Ctrl replaces ⌘. The "?" button in the toolbar shows
the same list.

## Data model

Everything structured is in SQLite (`outlines.db`); images and PDFs are
files under `uploads/<course-slug>/` next to it.

- **Course**: title, slug, order, exam date, exam format notes, printed page
  limit (optional), link to the study app's course slug (optional), syllabus
  topics (list).
- **Outline**: course, name ("Full", "Attack", "Midterm"), kind (full /
  attack / scratch), numbering (legal / decimal / bullets), created,
  is-default, options (skeleton mode, exam-mode pins), source outline (for
  attack outlines).
- **Node**: outline, parent (nullable), position, type (heading / rule /
  element / exception / case / statute / policy / hypo / professor-note /
  definition / table / flag / image / free), status (empty / skeleton /
  drafted / final), title, body (markdown), typed fields (JSON, see below),
  tags, collapsed, pinned, flashcard on/off, last edited, linked study-app
  note path, linked element index, and for attack outlines the source node
  and a hash of its content.
- **Link**: from node, to node, kind (see also / conflicts with / exception
  to / modifies / applies / leads to), note.
- **Source**: node, kind (transcript / casebook / statute / handout / other),
  reference text, optional URL.
- **Image**: node, file path under uploads, caption, width hint.
- **Syllabus**: course, PDF path, uploaded date.
- **Snapshot**: outline, date, label, automatic flag, full JSON of the tree,
  word count.
- **Drill result**: node, date, mode (recite / hypo), right or wrong.
- **Capture**: course, text, date, filed flag.
- **Card state / card review**: SM-2 scheduling for nodes with flashcards on.
- **Settings**: key/value (study-app content folder and so on).

### Node types and their fields

| Type | Title means | Fields |
| --- | --- | --- |
| heading | title | — |
| rule | rule name | rule statement, elements (each with an optional definition), exceptions (each optionally tied to an element), Wisconsin / local variation, majority / Restatement position, who bears the burden |
| element | element | text, definition, test or factors, satisfied-when note |
| exception | exception | text, defeats which element, source |
| case | case name | court and year, one-line facts, holding, why it is in the outline, how the professor used it, disposition |
| statute | statute name | cite, quoted text, what it changes, effective note |
| policy | policy | the argument, who makes it, counter |
| hypo | hypo title | facts, question, answer (hidden until revealed), what it turns on |
| professor-note | topic | date, what he said, which rule it modifies |
| definition | term | definition |
| table | table title | grid of columns and rows |
| flag | flag | short text, colour |
| image | image title | caption (the image file is attached to the node) |
| free | title | markdown body |

Every type also has tags, a markdown notes body, and (later phases) links,
sources and attached images.

## Project layout

```
electron/        Mac app shell (main.cjs, paths.cjs, server.cjs)
scripts/         dev.mjs (launcher), package.mjs (builds the Mac app)
src/app/         pages, server actions and API routes (Next.js App Router)
src/components/  the editor and shared components
src/lib/         database, tree operations, numbering, node type definitions
tests/           unit tests (node --test)
```
