# Law Outlines

A local, single-user outline editor built for law school outlines: deep
hierarchy with legal numbering, typed nodes for rules, elements, cases and
hypos, and views for exam day. It organises what you write; it never writes,
summarises or fills sections for you.

No AI features, no accounts, no hosting. Everything lives in a SQLite
database and an uploads folder on your Mac.

> Build status: **phases 1 to 4 of 6** are done (data model, courses and
> outlines, the tree editor, node fields in the side panel, images, links
> and backlinks, sources, tags, the scratch outline with "move to", the
> capture box with the inbox, the syllabus PDF pane, study-app import with
> linked nodes, .docx / .md import, the comparison pane, attack outlines,
> the issue checklist, exam mode, flowcharts, the glossary and reading
> mode). Phases 5 and 6 add drills and progress, and printing, exports,
> snapshots, backups and the packaged Mac app. This README grows with each
> phase.

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
