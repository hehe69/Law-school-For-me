# Law Study

A local, single-user study app: a unit-based digital textbook with LSAC-style
timed practice tests. Content lives on disk as markdown and JSON that you edit
directly. Test attempts are stored in a local SQLite file.

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

The database is created automatically at `data/study.db` (gitignored). Delete
the file to wipe all attempt history.

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

### Add a course

Create `content/<course-slug>/course.json`:

```json
{ "title": "Property", "order": 1 }
```

`order` controls the order on the home page. Ties sort by title.

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

### Add a note

Create `content/<course>/<unit>/notes/<anything>.md`. Every note has YAML
frontmatter with a `type` and the fixed fields for that type. Text below the
frontmatter is optional free-form markdown.

All fields are required. Lists may be empty (`[]`). Notes are grouped by type
on the unit page (Rules, Cases, Class notes) and sorted by filename within a
group, so prefix filenames if you care about order.

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

Multiple choice only for now.

### Malformed files

The loader validates every file. A malformed file is skipped and listed in a red
box on the home page (all problems) and on its unit page (that unit's
problems), with the path and the exact issue. Nothing crashes. Individual bad
questions are skipped without dropping the rest of the file.

## Tests

From a unit page, "Start test" opens setup:

- **Scope**: this unit, all units up to this one (by `order`), or the whole
  course.
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

## Not built yet (schema left open)

Flashcards, spaced repetition, quick-capture inbox, gaps/weak-tags view, essay
questions, file upload UI, search, auth, deployment.

## Project layout

```
content/                  your notes and questions
data/study.db             attempts (created on first run, gitignored)
src/lib/content/          types, validators, loader (reads content/ per request)
src/lib/db.ts             SQLite connection + schema
src/lib/attempts.ts       attempt queries
src/app/                  pages (server components) and the submit action
src/components/notes/     one template per note type
src/components/test/      the client-side test engine
```
