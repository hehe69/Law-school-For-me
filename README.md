# Law Outlines

A local, single-user outline editor built for law school outlines: deep
hierarchy with legal numbering, typed nodes for rules, elements, cases and
hypos, and views for exam day. It organises what you write; it never writes,
summarises or fills sections for you.

No AI features, no accounts, no hosting. Everything lives in a SQLite
database and an uploads folder on your Mac.

Contents: [Run it in a browser](#run-it-in-a-browser) ·
[The Mac app](#the-mac-app) · [Keyboard shortcuts](#keyboard-shortcuts-editor) ·
[The editor](#the-editor) · [Syllabus](#syllabus) ·
[Study-app import](#study-app-import) ·
[Importing and comparing files](#importing-and-comparing-files) ·
[Views](#views) · [Drills, progress, gaps, flashcards](#drills-progress-gaps-flashcards) ·
[Printing](#printing) · [Exporting](#exporting) ·
[Snapshots and history](#snapshots-and-history) · [Backups](#backups) ·
[Network access](#network-access) · [Where files live](#where-files-live) ·
[Data model](#data-model) · [Project layout](#project-layout)

## Run it in a browser

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

## The Mac app

The same app, packaged so it opens from Applications like anything else:
double-click, and it starts its own server on your computer and opens a
window. You build it yourself once (it is not signed with an Apple developer
account, which is why macOS asks you to confirm the first open). The steps
below assume you have used Terminal a handful of times; every command is
typed into Terminal and finished with Return.

### 1. One-time setup

1. **Install Node.js.** Go to https://nodejs.org, download the installer
   marked **LTS** (a `.pkg` file), open it and click through. This gives
   Terminal the `node` and `npm` commands.
2. **Install Apple's command line tools** (they include `git`). Open
   Terminal (press ⌘ Space, type `Terminal`, press Return) and run:

   ```bash
   xcode-select --install
   ```

   Click **Install** in the window that appears and wait for it to finish.
   If Terminal says the tools are already installed, that is fine.
3. Close Terminal and open it again so it notices the new commands.

### 2. Get the code

```bash
cd ~/Documents
git clone --branch claude/awesome-davinci-un1w3e https://github.com/hehe69/Law-school-For-me.git law-outlines-app
cd law-outlines-app
```

This puts the code in `~/Documents/law-outlines-app`. The outline app lives
on its own branch of the repository (the study app is on another), so keep
it in its own folder rather than inside the study app's checkout.

### 3. Build the app

```bash
npm install
npm run package
```

`npm install` downloads the dependencies (a few minutes the first time).
`npm run package` builds the web app, checks that SQLite loads inside
Electron (and rebuilds it if not), and packages everything. When it prints
`Done`, the `dist` folder contains **Law Outlines.app** (inside
`dist/mac-arm64` on an Apple-silicon Mac, `dist/mac` on an Intel Mac) and a
`.dmg` with the same app.

To give the app its own icon, put a 1024 by 1024 PNG at `assets/icon.png`
before packaging; without one it uses Electron's icon.

### 4. Install it

1. Run `open dist` to show the folder in Finder, open `mac-arm64` (or
   `mac`), and drag **Law Outlines** into **Applications**.
2. Open it the first time:
   - On macOS 14 (Sonoma) or earlier: right-click (or Control-click) the
     app, choose **Open**, then **Open** again in the warning.
   - On macOS 15 (Sequoia) or later: double-click it, dismiss the message
     that it cannot be opened, then open **System Settings → Privacy &
     Security**, scroll down to the line about Law Outlines, click **Open
     Anyway** and confirm.

   This is only needed once. Afterwards it opens normally.

### 5. First launch

The app asks you to confirm its data folder, `~/Documents/law-outlines`
(use it, or choose another). That folder holds `outlines.db`, `uploads/`
and `settings.json`, exactly as the browser version does, so the two can
share one set of outlines (do not run both at the same time). The app's own
settings (which data folder to use) are in
`~/Library/Application Support/Law Outlines/settings.json`; the **Law
Outlines** menu has **Open data folder** and **Open settings file**.

The window is an ordinary browser view of the app. Print views open the
system print dialog; links to outside websites open in your browser.

### 6. Update to a newer version

```bash
cd ~/Documents/law-outlines-app
git pull
npm install
npm run package
```

Quit the running app, drag the new **Law Outlines** from `dist/mac-arm64`
(or `dist/mac`) into Applications and choose **Replace**. Your outlines are
not inside the app (they are in `~/Documents/law-outlines`), so nothing is
lost; still, take a backup first (**Settings → Back up now**) to be safe.

### If something goes wrong

- `zsh: command not found: npm` — Node.js is not installed, or Terminal was
  open before you installed it. Install it (step 1) and open a new Terminal
  window.
- `npm install` mentions blocked install scripts, or `npm run package` says
  Electron's binary is missing — run
  `npm install-scripts approve electron` and then `npm install` again.
  (`package.json` already approves the pinned versions; this is needed after
  an upgrade of one of them. `npm run package` also fetches the Electron
  binary itself when it is missing.)
- Errors mentioning `xcrun`, `clang`, `node-gyp` or `python` — the command
  line tools are missing. Run `xcode-select --install` and try again. They
  are only needed when SQLite has to be rebuilt for Electron.
- "Law Outlines cannot start" with a note about the port — another copy of
  the app, or `npm run dev`, is already running. Quit it and open the app
  again.
- "Law Outlines cannot start" with a note about the data folder — the
  folder is not writable. Fix its permissions, or point the app at another
  folder by editing the settings file (**Law Outlines → Open settings
  file**).
- The window is blank or the app quits at once — start it from Terminal to
  see the log:

  ```bash
  "/Applications/Law Outlines.app/Contents/MacOS/Law Outlines"
  ```

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
| ⌘S | Save now (everything autosaves anyway) |
| ⌘⇧H | Turn the text selected in the syllabus pane into headings |
| Esc | Back to the tree from any field |
| Shift+click / ⌘click | Select a range / toggle a row |

On Windows or Linux, Ctrl replaces ⌘. The "?" button in the toolbar shows
the same list. On the print views, ⌘P prints.

## The editor

- **Tree**: every row shows its number, a status dot (grey empty, hollow
  skeleton, blue drafted, green final; click it to cycle), a type badge, the
  title, a one-line summary from the node's fields, small badges for links
  (⇄), sources (§) and images (▣), and up to three tags. Drag the number to
  move a row: the top third drops before, the bottom third after, the middle
  makes it a child.
- **Side panel**: the title, type, status, tags, the typed fields of the
  type, a markdown notes body with a preview toggle, attached images (with
  caption and a width slider), links with their backlinks, and sources.
  Changing the type keeps any fields the new type also has.
- **Skeleton mode** (toolbar toggle, remembered per outline): the tree shows
  titles only and new nodes start with the "skeleton" status, for building
  the structure from a syllabus before filling anything in.
- **Numbering** is per outline: legal (I. A. 1. a. i. (1) (a) (i)), decimal
  (1. 1.1 1.1.1) or bullets.
- **Images**: paste an image anywhere in the editor to attach it to the
  selected node, drop one on a row, or use "Add image" in the panel. Files
  go to `uploads/<course-slug>/` and are served from `/files/…`.
- **Links**: "Add link" picks another node and a kind (see also, conflicts
  with, exception to, modifies, applies, leads to). Both ends show a chip;
  clicking jumps to the other node.
- **Scratch outline**: every course has one, a loose bullet list for things
  not yet placed. "Move to…" in the panel (or the palette) sends a node with
  its children into any outline of the course under a chosen parent.
- **Capture and inbox**: the box in the header saves a line to the chosen
  course's inbox with the date. The inbox page files each capture as a node
  (pick type, status, outline and parent) and opens the editor on it.
- Everything autosaves a moment after each change ("Saved" in the toolbar);
  ⌘S saves at once. Undo covers tree and field edits; links, sources and
  images save immediately and are not undoable.

## Syllabus

Each course page has a **Syllabus** page: upload the syllabus PDF (stored as
`uploads/<course-slug>/syllabus.pdf`; re-uploading replaces the file and
keeps the topics) and edit the course's **syllabus topics**, one per line.
Topics are offered as tags on every node and drive the gaps view.

In the editor, **Syllabus** in the toolbar opens the PDF in a split pane
beside the tree (rendered with pdf.js, so the text is selectable). Select
text in the pane and press ⌘⇧H, or click "Selection → heading", to create a
heading at the current level (a sibling after the selected row). A
selection spanning several lines makes one heading per line. With skeleton
mode on, the new headings start as "skeleton".

## Study-app import

**Settings** holds the path to the study app's content folder (default
`~/Documents/law-school-for-me/content`) and lists the courses it finds.
Link a course by setting its *study-app course slug* in the course settings;
the course's **Import** page then lists the study app's units with their
rule, case and class notes.

- A **rule note** becomes a rule node (rule statement, elements with their
  definitions, exceptions tied to elements, the Wisconsin variation, the
  note's body as notes). A **case note** becomes a case node (facts,
  holding, why it matters; issue and rule go into the notes). A **class
  note** becomes a professor note (date, what he said), and its
  `modifiesRule` is resolved to the imported rule node.
- A **whole unit** imports as a heading with its notes beneath; the unit's
  `syllabusTopics` can be added to the course's topics.
- Imported nodes keep a link to their note (⛓ in the tree, the path in the
  panel) and a hash of the note. The Import page's **Linked nodes** list
  shows which notes changed since the import ("check for changes", also in
  the ⌘K palette); **Refresh from note** re-reads the note and overwrites
  the node's title, fields and body while keeping its status, tags,
  children and links. Running an import again skips notes that already have
  nodes. Nothing is ever written back to the study app.
- The palette command **Expand elements into child nodes** turns a rule's
  elements into element nodes under it (each remembers its element number).

## Importing and comparing files

- **Import a .docx or .md file** (Import page) creates a new full outline:
  headings give the levels, list items nest by indentation under the
  nearest heading, and paragraphs become the notes of the node above them.
  Word files are read through mammoth, so Word's heading styles and lists
  carry over. You can then rearrange the result.
- **Compare…** in the editor toolbar loads a friend's .docx or .md outline
  into a read-only pane beside the tree, with a filter box. It is never
  saved or merged.

## Views

The editor's **Views ▾** menu and the course page link to these. Every
document view renders nodes the same way: number, title, the typed fields
(elements as a numbered list, holdings, hypo answers folded away, tables,
flags as chips), the notes, attached images with captions, and sources in a
compact line under the node.

- **Attack outline** (Views → Generate attack outline…, from a full
  outline): options are titles only or titles plus rule statements and
  elements, the top N levels, only nodes with chosen tags (ancestors come
  along for structure), and only "final" nodes. The result is a separate
  editable outline of kind "attack"; each line remembers its source node.
  **Regenerate from source** (Views menu in the attack outline) keeps your
  edited lines where the source is unchanged, rewrites untouched lines
  whose source changed, adds lines for new sources, and flags lines whose
  source changed or disappeared (⚠ in the tree; the panel offers "Update
  from source" or "Keep mine").
- **Issue checklist**: every heading and rule as a tickable list grouped by
  top-level section. Ticks are kept in the browser per outline (Reset
  clears them); Print lays it out in two columns on one sheet.
- **Exam mode**: the whole outline as a large read-only document over the
  full screen (the Full screen button uses the browser's own full screen).
  Instant search with a results list, ⌘K to jump to any node, up to five
  sections pinned in the sidebar (remembered per outline), a split view
  with any second section, "Only" to show one section, and a dark / light
  toggle remembered in the browser.
- **Flowchart** (Views → Flowchart for the selected branch, or the
  course's Flowcharts page to pick a rule): a rule drawn as a decision
  tree: the elements in order with a "no" branch for each, the exceptions
  that defeat an element, the Wisconsin variation attached to the element
  it changes, and hypos hanging off the element they test (a hypo under an
  element node, linked to it, or whose "turns on" names it). Export SVG,
  Export PNG, Print.
- **Glossary**: every definition node of the course, alphabetised, linking
  back to the node. Wherever the outline is rendered as a document, defined
  terms get a dotted underline with the definition as a hover tooltip.
- **Reading mode**: one branch at a time as a clean document in large type,
  with previous / next branch, the parent, and the outline's sections in a
  sidebar.
- **Print…**, **Export file…** and **Snapshots and history** are described
  in their own sections below.

## Drills, progress, gaps, flashcards

- **Drills** (Views → Drills, or the course page): pick a branch or the
  whole outline. **Recite**: each rule's statement and elements are hidden;
  say them out loud, reveal the statement and then one element at a time
  (or all), mark right or wrong; a timer runs per rule. **Hypos**: facts
  and question, write your answer, reveal the model answer and what it
  turns on, mark right or wrong. Every result is stored. The tree shows a
  coloured left edge from the last three results of a node: green "know it
  cold" (at least two tries, all right), amber "shaky" (any wrong), nothing
  for untested; hover the row for the counts.
- **Progress** (per course, per outline): nodes, percent final, words and
  the estimated printed pages; counts and percent by status overall and per
  top-level section; a word-count timeline over snapshots; stale sections
  with no edit in 14 or more days.
- **Gaps**: syllabus topics with no node tagged with them, rules with no
  elements, headings with nothing under them, hypos with no answer, and
  rules, cases, statutes, elements, exceptions, policies and professor
  notes with no source. Attack outlines are not counted.
- **Page-limit mode**: when a course has a printed page limit, the editor
  toolbar shows "~N / limit pages" for the outline being edited, updated as
  you type (green, amber above 90 percent, red over the limit), and the
  course page shows the estimate for every full and attack outline. The
  estimate assumes single-spaced 11-point text: about 380 words per page,
  plus a line per node and a share of a page per image.
- **Flashcards**: off by default. On a rule or element node, tick
  "Flashcard" in the panel. The front is the title; the back is the rule
  statement with its elements (or the element's text, definition and
  "satisfied when"). **Review** in the header shows how many cards are due
  and opens the daily review (all courses, or one), with the same SM-2
  scheduling as the study app: Again, Hard, Good, Easy. Attack outlines
  never make cards.

## Printing

**Views → Print…** (or **Print** on the course page) opens the outline as a
print document, then ⌘P or the **Print** button prints it or saves it as a
PDF through the system dialog. The same page serves full outlines, attack
outlines and single sections:

- The toolbar at the top is not printed. It picks the **section** (whole
  outline or any top-level section), how **sources** appear (inline under
  each node, as numbered footnotes collected at the end, or left out), and
  whether **hypo answers** are shown; a hidden answer prints as its label
  only.
- The full outline starts with a **table of contents** of the top two
  levels, on its own page. A single section prints without one.
- Page numbers sit at the bottom right of every page. (They come from the
  CSS `@page` rule, which Chrome and the Mac app honour; Safari and Firefox
  print the document without them.)
- Nodes keep their title with their content across page breaks; images
  print with their captions; defined terms lose their dotted underline.
- The **issue checklist** prints in two columns, and a **flowchart** prints
  on its own, both from their own Print buttons.

## Exporting

**Views → Export file…** (or **Export** on the course page) writes a file to
`~/Documents/law-outlines-export/`, named
`<course>-<outline>-<date>.docx`, `.pdf` or `.md` (a single section adds
the section name). The page shows the full path when it is done. Options
are the same as for printing: whole outline or one section, sources inline,
as footnotes or left out, and whether hypo answers are included.

- **Word (.docx)**: real Word heading styles (Heading 1 to 6 by depth, so
  Word's navigation pane, collapsing and "Table of Contents" all work), a
  table of contents field at the top (Word asks whether to update fields
  when the file opens; answer Yes to fill it in), page numbers in the
  footer, footnotes as real Word footnotes, tables as Word tables, elements
  and exceptions as lists, notes with bold, italic, code, links and lists
  carried over, and PNG or JPEG images embedded with their captions (other
  formats are noted by name). Opens in Word, Pages and Google Docs.
- **PDF**: US Letter, a contents page with page numbers for the top two
  levels, page numbers at the bottom right, images embedded, footnotes
  collected on a final "Sources" page. The inline formatting of notes is
  flattened to plain text.
- **Markdown (.md)**: headings for every node (with the numbering and the
  node type), fields as labelled paragraphs, elements as numbered lists,
  tables as pipe tables, hidden hypo answers as `<details>` blocks, sources
  as footnotes (`[^1]`) or inline, your notes exactly as written, and the
  images copied into a folder next to the file so it stands on its own.

## Snapshots and history

A snapshot is the whole outline (nodes, links, sources, image records) at
one moment. One is taken **automatically** once a day when you open an
outline that changed since the last snapshot; take one **by hand**, with a
label, from **Views → Snapshots and history** before any big reorganisation.

- The snapshots page lists every snapshot with its date, label and word
  count. Pick any two as **A** and **B** to see them side by side with
  nodes highlighted as added (green), removed (red), changed (amber, naming
  the changed fields: title, notes, status, tags or a typed field) or moved
  (blue). "Changed nodes in detail" shows the old and new value of each
  changed field.
- **Restore as new outline** creates a new outline of the course with the
  snapshot's content (fresh ids, links remapped). It never overwrites the
  current outline: compare the two, move pieces across with "Move to…",
  and delete whichever you do not want from the course page.

## Backups

A backup is a zip of the database (copied through SQLite's backup API, so
it is consistent even while the app runs) plus the uploads folder, written
to `~/Documents/law-outlines-backups/<date-time>.zip`.

- **Settings → Back up now** writes one immediately and lists the recent
  ones.
- One is written automatically when the app starts and the newest backup is
  more than a day old.
- To restore, quit the app, unzip the file, and put `outlines.db` and
  `uploads/` into the data folder in place of the current ones (keep the
  old ones somewhere until you have checked the result).

## Network access

Off by default: the app listens on this computer only (`localhost`).
**Settings → Network access** turns on listening on all interfaces so a
phone or laptop on the same wifi can open the app. Saving the switch writes
`networkAccess` into `settings.json` in the data folder; the change takes
effect the next time the app starts, and the Settings page then shows the
"same wifi" addresses to type into the other device. There is no login, so
anyone on that network can open and edit your outlines while it is on;
turn it off again when you are done. The Mac app and `npm run dev` read the
same switch.

## Where files live

| What | Where |
| --- | --- |
| Database | `~/Documents/law-outlines/outlines.db` |
| Images and syllabus PDFs | `~/Documents/law-outlines/uploads/<course-slug>/` |
| Launcher settings (network switch) | `~/Documents/law-outlines/settings.json` |
| Exports | `~/Documents/law-outlines-export/` |
| Backups | `~/Documents/law-outlines-backups/` |
| Mac app settings (data folder) | `~/Library/Application Support/Law Outlines/settings.json` |
| Study-app content folder (read only) | `~/Documents/law-school-for-me/content` (changeable in Settings) |

`LAW_OUTLINES_DATA_DIR` moves the first three; the Mac app sets it from its
settings file.

## Data model

Everything structured is in SQLite (`outlines.db`); images and PDFs are
files under `uploads/<course-slug>/` next to it. The schema is created and
migrated by `src/lib/db.ts` (`PRAGMA user_version`), with foreign keys on
and WAL mode.

- **Course**: id, title, slug, order, exam date, exam format notes, printed
  page limit (optional), link to the study app's course slug (optional),
  syllabus topics (list), created.
- **Outline**: id, course, name ("Full", "Attack", "Midterm"), kind (full /
  attack / scratch), numbering (legal / decimal / bullets), is-default,
  source outline (for attack outlines), options (skeleton mode, attack
  options, exam-mode pins), created, updated.
- **Node**: id, outline, parent (nullable), position, type (heading / rule /
  element / exception / case / statute / policy / hypo / professor-note /
  definition / table / flag / image / free), status (empty / skeleton /
  drafted / final), title, body (markdown), typed fields (JSON, see below),
  tags, collapsed, pinned, flashcard on/off, linked study-app note path,
  linked element index and note hash, and for attack outlines the source
  node and a hash of its content; created, updated.
- **Link**: id, from node, to node, kind (see also / conflicts with /
  exception to / modifies / applies / leads to), note, created.
- **Source**: id, node, kind (transcript / casebook / statute / handout /
  other), reference text, optional URL, position.
- **Image**: id, node, file path under uploads, caption, width hint,
  position, created.
- **Syllabus**: course, PDF path, uploaded date.
- **Snapshot**: id, outline, date, label, automatic flag, full JSON of the
  tree (nodes, links, sources, images), word count.
- **Drill result**: id, node, date, mode (recite / hypo), right or wrong,
  seconds.
- **Capture**: id, course, text, date, filed flag.
- **Card state / card review**: SM-2 scheduling (interval, ease,
  repetitions, due date) and the review log for nodes with flashcards on.
- **Settings**: key/value in the database (`studyContentDir`); the launcher
  switch (`networkAccess`) is in `settings.json` so it can be read before
  the server starts.

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

Every type also has tags, a markdown notes body, links, sources and
attached images.

## Project layout

```
electron/            Mac app shell (main.cjs, paths.cjs, server.cjs)
scripts/             dev.mjs (launcher), package.mjs (builds the Mac app)
src/app/             pages, server actions and API routes (Next.js App Router)
src/components/      the editor, document renderer, views and shared components
src/lib/             database, tree operations, numbering, node types, importers,
                     exporters, snapshots, backups
src/instrumentation.ts  runs the automatic backup when the server starts
tests/               unit tests (node --test)
```
