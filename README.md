# Law Study

A local, single-user study app: a unit-based digital textbook with LSAC-style
timed practice tests, auto-generated flashcards with spaced repetition, a gaps
view, and weak-tag tracking. Content lives on disk as markdown and JSON that
you can edit directly or through the in-app forms. Test attempts and flashcard
progress are stored in a local SQLite file.

No auth, no hosting, no AI features.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

- `npm run dev` re-reads `content/` on every request, so add or edit files and
  just reload the page. No restart needed.
- `npm run build && npm start` runs the production build. Content is still read
  at request time.
- `npm run lint` runs ESLint.
- `package.json` has an `allowScripts` entry approving the install scripts
  of `better-sqlite3` (native build) and `unrs-resolver` (used by ESLint).
  npm 12 blocks dependency install scripts unless they are listed there. The
  approvals are pinned to exact versions, so after upgrading either package
  run `npm install-scripts approve <package>` and commit the change.

The database is created automatically at `data/study.db` (gitignored). Delete
the file to wipe all attempt history, flashcard progress, and the inbox.

On every server start the app checks `~/Documents/law-school-backups/` and
writes a fresh backup if the newest one is more than a day old (see
**Backups**).

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind for minimal styling,
`better-sqlite3` for attempts, `gray-matter` for note frontmatter,
`react-markdown` for note bodies.

## Content layout

```
content/
  <course-slug>/
    course.json
    <unit-slug>/
      unit.json
      notes/
        *.md
      questions.json
```

Folder names are the slugs and appear in URLs, so keep them lowercase with
hyphens. Folders starting with `.` or `_` are ignored.

You can create courses and units from the app as well as by hand; the app
writes exactly the files described below.

### Add a course

Create `content/<course-slug>/course.json`:

```json
{ "title": "Property", "order": 1 }
```

`order` controls the order on the home page. Ties sort by title.

Or click **New course** on the home page: enter a title and order, and the
folder name is derived from the title ("Contracts: Offer & Acceptance" becomes
`contracts-offer-and-acceptance`). The form warns if that folder exists.

### Add a unit

Create `content/<course-slug>/<unit-slug>/unit.json`:

```json
{
  "title": "Adverse Possession",
  "order": 3,
  "syllabusTopics": ["elements", "tacking", "Wisconsin statute"]
}
```

`order` is the unit's place in the syllabus. It also drives the "all units up
to this one" test scope. `syllabusTopics` is optional.

Or click **New unit** on a course page (or next to the course title on the
home page): title, order (defaults to last + 1), and syllabus topics added one
at a time. This creates the folder, `unit.json`, and an empty `notes/`.
**Edit** next to a unit on the course page changes its title, order, and
syllabus topics in `unit.json` only; the folder name, notes, questions, and
any other keys such as `emphasis` are untouched.

An optional `"emphasis"` string holds what the professor stressed for the
unit. The unit page shows it in a callout above the notes and has a box to
edit it, which writes back to `unit.json` keeping every other key.

### Add a note

Create `content/<course>/<unit>/notes/<anything>.md`. Every note has YAML
frontmatter with a `type` and the fixed fields for that type. Text below the
frontmatter is optional free-form markdown.

Every type has fixed fields (listed below). Lists may be empty (`[]`). A note
whose fields are all present is **complete**. A note with a field missing or
empty is loaded as a **draft**: it still shows on the unit page with a yellow
"Draft" badge and the names of the missing fields, but it makes no flashcard.
A field of the wrong shape (for example `elements: "text"` instead of a list)
is still a content error and the file is skipped.

Notes are grouped by type on the unit page (Rules, Cases, Class notes) and
sorted by filename within a group, so prefix filenames if you care about order.

You can also create and edit notes in the app: "New note" on a unit page, and
"Edit" on every note card. See **Note form** below.

Any note type may also carry an optional `topics` list naming the syllabus
topics (from the unit's `unit.json`) that the note covers. The Gaps view uses
it. Matching ignores case.

```yaml
topics: ["elements", "Wisconsin statute"]
```

**type: case**

```markdown
---
type: case
name: "Van Valkenburgh v. Lutz"
facts: "..."
issue: "..."
rule: "..."
holding: "..."
whyItMatters: "..."
---
Optional markdown body.
```

**type: rule**

```markdown
---
type: rule
name: "Elements of adverse possession"
ruleStatement: "..."
elements:
  - "Actual"
  - "Open and notorious"
exceptions:
  - "Government land"
wisconsinVariation: "..."
---
```

**type: class**

```markdown
---
type: class
date: 2026-09-15
topic: "Tacking and privity"
professorPoint: "..."
modifiesRule: "..."
---
```

`date` must be `YYYY-MM-DD`, quoted or unquoted.

YAML tip: quote any value that contains a colon, `#`, or starts with a special
character. Multi-line text works with `|`:

```yaml
facts: |
  First paragraph.

  Second paragraph.
```

### Add questions

Create `content/<course>/<unit>/questions.json` as a JSON array:

```json
[
  {
    "id": "ap-001",
    "stem": "...",
    "choices": ["A", "B", "C", "D", "E"],
    "answer": 2,
    "explanation": "...",
    "tags": ["tacking", "wisconsin"]
  }
]
```

- `answer` is the 0-based index into `choices` (so `2` is choice C).
- `choices` needs at least 2 entries. Choice order is never shuffled.
- `tags` is optional and defaults to `[]`.
- `id` must be unique within the course, because course-wide tests pool
  questions from every unit. Attempts store the id, so do not reuse an id for a
  different question later.

Multiple choice only for now. Hand-written files may have 2 or more choices;
the in-app importer insists on exactly 5 (see **Importing questions**).

### Malformed files

The loader validates every file. A malformed file is skipped and listed in a red
box on the home page (all problems) and on its unit page (that unit's
problems), with the path and the exact issue. Nothing crashes. Individual bad
questions are skipped without dropping the rest of the file.

## Tests

From a unit page, "Start test" opens setup:

- **Scope**: this unit, all units up to this one (by `order`), or the whole
  course. Two more scopes exist that are not chosen here: "Weakest tags" and
  "Retry missed" (see below).
- **Number of questions**: defaults to all in scope, capped at what the scope
  has.
- **Seconds per question**: default 90. Total time = count × seconds.

Questions are shuffled each time a test starts. The timer starts when the test
page loads and is always visible. At zero the test auto-submits with whatever is
answered. Click a selected choice again to clear it. Flag questions, move with
Previous/Next, or jump from the navigator grid. Submit asks for confirmation
and shows how many are unanswered.

Nothing is saved until you submit. Leaving the page mid-test discards it (the
browser will warn you).

## Attempts

Each attempt stores: scope, the unit it was started from, every question id in
the order shown, your answer, the correct answer, whether it was right, the
flag, a snapshot of the question's tags, time limit, time used, whether time
ran out, and the score.

- `/attempts/<id>` is the results page with a "wrong only" filter. Unanswered
  counts as wrong.
- Each unit has an attempt history page. "Best score" and "last attempt" on the
  home page come from attempts started from that unit, whatever their scope.

Grading uses the content on disk at submit time. If you delete a question from
content after taking a test, its results still show your answer and the correct
letter but not the text.

### Database schema

```sql
attempts (
  id, course_slug, unit_slug, scope, started_at, finished_at,
  time_limit_seconds, time_used_seconds, auto_submitted,
  question_count, correct_count, score_percent
)
attempt_questions (
  attempt_id, position, course_slug, unit_slug, question_id,
  selected, correct_answer, is_correct, flagged, tags   -- tags is a JSON array
)
```

Per-question correctness and tags are stored so weak-tag reports can be
computed later without re-reading old content.

## Importing questions

"Import questions" on a unit page opens a textarea. Paste a JSON array in the
question schema above and choose what happens on success:

- **Append** adds the questions to the unit's existing `questions.json`.
- **Replace** overwrites `questions.json` with just the pasted questions (the
  current ones are deleted).

The importer checks every question and lists each problem with its index in the
paste (`[2] "answer" is 5; it must be from 0 to 4`). Rules:

- `id`, `stem`, `explanation` are non-empty text.
- `choices` has exactly 5 non-empty strings.
- `answer` is a whole number from 0 to 4.
- `tags`, if present, is a list of strings.
- `id` is new within the whole course (in Replace mode the unit's own current
  ids may be reused) and not repeated inside the paste.

Nothing is written unless every question passes and the resulting file would
load cleanly. In Append mode, if the existing file has invalid entries the
import refuses rather than appending onto a broken file. The textarea keeps
your paste when there are errors.

## Note form

"New note" on a unit page opens a form. Pick the type (case, rule, class) and
the fields switch to match. Elements and exceptions are entered one per line.
Topics is a checklist of the unit's `syllabusTopics`. The body is optional
markdown.

The filename is derived from the name: "Van Valkenburgh v. Lutz" becomes
`notes/van-valkenburgh-v-lutz.md`. Class notes use the date and topic, giving
`notes/2026-09-15-tacking-and-privity.md`. The form shows the filename as you
type and warns if it already exists; saving over an existing note from "New
note" is refused.

"Edit" on a note card opens the same form prefilled. Editing never renames the
file (that would reset the note's flashcard progress), and any extra frontmatter
keys you wrote by hand are kept.

Fields may be left empty. The note is written with `""` for those fields and
shows as a draft until you fill them in, either in the form or in the file.

## Weak tags

"Weak tags" (linked from the home page and every unit page) lists, per course,
every tag seen in your attempts with how many times questions carrying it were
seen, missed, and the miss rate. Unanswered counts as missed. Tags come from
the snapshot stored with each attempt, so renaming a tag in content starts a
new row. The table also shows how many questions currently carry each tag.

"Test weakest tags" starts a test from every question in the course carrying
any of the three worst tags (highest miss rate, ties broken by misses then
seen; tags no longer used by any question are skipped). The test uses all
matching questions at 90 seconds each. Its attempts belong to the course rather
than a unit, so they appear on the weak-tags page under "Recent weak-tag
tests" and not in any unit's history or home-page stats.

## Retry missed

- On any results page, **Retry wrong (N)** starts a new test from the questions
  you missed in that attempt.
- On a unit page, **Retry all missed (N)** starts a test from every question in
  that unit you have ever missed, in any attempt.

Both use all matching questions at 90 seconds each and are stored with scope
"Retry missed". A retry started from a unit page or from a unit's results shows
in that unit's history. Questions removed from content since are skipped.

## Backups

**Back up now** on the home page zips the whole `content/` folder and a
consistent snapshot of the database into
`~/Documents/law-school-backups/<YYYY-MM-DD_HH-MM-SS>.zip` and shows the path.
The home page always shows when the last backup was made.

The same backup runs automatically when the server starts (`npm run dev` or
`npm start`) if the newest zip is more than 24 hours old or there is none. It
is logged as `[backup] wrote …`. A failed automatic backup is logged and does
not stop the app.

To restore, unzip over the project: the archive holds `content/…` and
`data/study.db`. Stop the app first so the database file is not in use.

## Quick capture and inbox

The **Capture** box in the header is on every page. Type raw in-class notes
and press "Save to inbox" (or Ctrl/⌘+Enter). Each capture is stored in the
database with a timestamp and belongs to no unit. The header shows how many
are waiting.

The **Inbox** page lists them, newest first. **File as note** opens the note
form with the capture text in the body and lets you pick the course, unit, and
note type; the topics checklist follows the chosen unit, and for a class note
the date defaults to the capture's date. Saving writes the note file and marks
the capture filed, which removes it from the inbox. **Discard** removes a
capture without filing it. Nothing is deleted from the database either way;
filed and discarded rows keep their timestamps.

## Flashcards

There is no card authoring. Cards are generated from notes on every request:

| Note type | Front       | Back                                                      |
| --------- | ----------- | --------------------------------------------------------- |
| `rule`    | `name`      | `ruleStatement`, `elements`, `exceptions`, `wisconsinVariation` |
| `case`    | `name`      | `rule`, `holding`                                         |

Class notes and draft notes do not make cards. Each unit page links to
"Flashcards (N)", a browse page where you click a card to flip it.

A card's identity is the note's path under `content/`, for example
`property/adverse-possession/notes/elements.md`. Renaming or moving a note
file resets that card's review progress (the old state row stays in the
database but is ignored). Editing the note's text does not.

## Daily review (spaced repetition)

The **Review** page (header link, or `/review?course=<slug>` for one course)
shows the queue of cards due today: every card never reviewed, plus every card
whose due date is today or earlier. Overdue cards come first, then new cards.
You see the front, click **Reveal**, then rate it 1 to 4:

| Rating | Meaning          | Effect                                          |
| ------ | ---------------- | ----------------------------------------------- |
| 1      | Again (forgot)   | Progress resets; the card stays in today's queue (moved to the back) |
| 2      | Hard             | Next interval is half the normal step, at least 1 day |
| 3      | Good             | Normal SM-2 step                                 |
| 4      | Easy             | Normal step with a bigger ease increase          |

Scheduling is SM-2: the first successful review schedules 1 day out, the
second 6 days, and each one after that multiplies the previous interval by the
card's ease factor (starts 2.5, floor 1.3, adjusted by every rating). Ratings
1 to 4 map onto SM-2's 0 to 5 quality scale as 1, 3, 4, 5. Due dates are
calendar days in the machine's local time zone, so a card scheduled for
tomorrow is due at midnight.

The home page shows "Flashcards due today" per course with a review link.

### Database schema (inbox)

```sql
captures (
  id, text, created_at,
  filed_at, filed_note_path,   -- set when filed as a note
  discarded_at                 -- set when discarded
)
```

### Database schema (flashcards)

```sql
card_states (
  card_key PRIMARY KEY,   -- note path under content/
  course_slug, unit_slug, ease, interval_days, repetitions,
  due_on,                 -- YYYY-MM-DD
  last_reviewed_at, last_rating
)
card_reviews (            -- one row per rating ever given
  id, card_key, course_slug, unit_slug, reviewed_at, rating, interval_days, ease
)
```

## Gaps

The **Gaps** page lists, per course:

1. **Syllabus topics with no notes.** Every `syllabusTopics` entry in a
   `unit.json` that no note in that unit lists under `topics`. Until you tag
   notes, every topic shows here. It also lists note topics that match nothing
   in the unit's syllabus, which usually means a typo on one side.
2. **Units with no questions.** Units with no `questions.json` or an empty one.
3. **No review or test in 7+ days.** Units whose most recent activity (a test
   attempt started from that unit, or a flashcard review of a card from that
   unit) is 7 or more days ago, or that have never been studied.

## Decisions made while building

- **Time limit is entered as seconds per question**, not a total, so the
  default scales with the question count using a plain HTML form. The total is
  shown on the results page.
- **All frontmatter fields are required.** A missing field is an error rather
  than a blank, so a half-written note is obvious. Use `""` or `[]` to leave
  something intentionally empty.
- **Note frontmatter fields render as plain text** (line breaks preserved). Only
  the body below the frontmatter is rendered as markdown.
- **Question ids are unique per course**, not globally, since courses never mix
  in one test.
- **Answers and explanations are not sent to the browser** during a test.
  Grading happens on the server when you submit.
- **Deselecting** an answer is allowed (click the chosen choice again).
- **URLs**: `/courses/<course>/units/<unit>`, `.../test`, `.../history`,
  `/attempts/<id>`.
- **Sample content** under `content/sample-property/` is placeholder text
  marked as such. Delete the folder when you add your real course.
- **Topic coverage is explicit.** A note covers a syllabus topic only when its
  `topics` frontmatter says so. Guessing from note text would hide real gaps.
  This adds one optional frontmatter field; the folder layout is unchanged.
- **Class notes are not flashcards.** Only rule and case notes have a natural
  question/answer split. Class notes still count toward topic coverage.
- **"Again" keeps the card in today's queue** rather than scheduling it for
  tomorrow, so a forgotten card gets re-tested in the same session.
- **New cards are due immediately** with no daily cap. If a big import makes
  the queue too long, review by course.
- **Review ratings are plain form posts** to a server action. The only client
  state on the review page is whether the back is revealed.
- **Stale-unit activity counts both tests and reviews.** A unit with cards
  reviewed recently is not stale even if it has not been tested.
- **The importer is stricter than the loader.** Hand-written files with 4
  choices still load; pasted questions must have exactly 5, as asked. The
  loader's leniency keeps files you have already written working.
- **Drafts are not errors.** Missing or empty fields make a draft; a field of
  the wrong shape is still an error, since that usually means a YAML mistake.
- **Drafts still count toward topic coverage** in the Gaps view. A draft is a
  note that exists; the badge is the reminder to finish it.
- **Edit never renames a note file.** Flashcard progress is keyed by path.
- **Every in-app write is atomic** (temp file + rename) and paths are built only
  from validated slugs, so a crash mid-write cannot leave a half file.
- **Form line endings are normalised to LF** before writing, since browsers
  submit CRLF.
- **Weak-tag tests belong to the course, not a unit.** They are listed on the
  weak-tags page instead of a unit's history.
- **"Retry all missed" means this unit's questions**, missed in any attempt,
  including course-wide tests started from another unit.
- **Retry and weak-tag tests go straight to the test** with all matching
  questions and 90 seconds each. Add `&count=N` or `&seconds=S` to the URL to
  change that.
- **Course and unit slugs come from the title** with the same slugify rule as
  note filenames, and creation refuses to touch an existing folder.
- **Editing a unit also lets you change its order**, since it lives in the
  same `unit.json` and the form would be odd without it.
- **Backups snapshot the database through SQLite's backup API** rather than
  copying the file, because WAL mode can leave recent writes in a side file.
- **Backup staleness is judged by the newest zip's modification time** in the
  backup folder, so a zip you copy in by hand counts.
- **Filing or discarding a capture never deletes the row.** The inbox shows
  only rows with neither `filed_at` nor `discarded_at`.
- **Discard was added to the inbox** even though it was not asked for, since
  an inbox with no way to drop a stray capture only grows.
- **The capture box saves without leaving the page**; the header count
  refreshes in place.

## Not built yet (schema left open)

Essay questions, file upload UI, search, auth, deployment.

## Project layout

```
content/                  your notes and questions
data/study.db             attempts (created on first run, gitignored)
src/lib/content/          types, validators, loader (reads content/ per request),
                          writer (all disk writes), importer (paste validation)
src/lib/slug.ts           slugify (pure, used by the note form in the browser)
src/lib/weakTags.ts       tag miss rates and missed-question queries
src/lib/captures.ts       quick-capture inbox queries
src/lib/backup.ts         zip backups of content/ and the database
src/instrumentation.ts    runs the stale-backup check at server start
src/lib/testing.ts        shuffle and question-stripping for test runs
src/lib/db.ts             SQLite connection + schema
src/lib/attempts.ts       attempt queries
src/lib/cards.ts          flashcards derived from notes
src/lib/sm2.ts            SM-2 scheduling (pure functions)
src/lib/reviews.ts        due queue and card state persistence
src/lib/gaps.ts           gaps computation
src/app/                  pages (server components) and the server actions
                          (actions.ts for tests/review, content-actions.ts for writes)
src/components/notes/     note card, one field template per type, note form
src/components/            ImportForm, EmphasisForm, CourseForm, UnitForm,
                          TopicList, QuickCapture, UnitTable
src/components/cards/     flashcard back, flip card, review card
src/components/test/      the client-side test engine
```
