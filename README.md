# Law Study

A local, single-user study app: a unit-based digital textbook with LSAC-style
timed practice tests, auto-generated flashcards with spaced repetition, and a
gaps view. Content lives on disk as markdown and JSON that you edit directly.
Test attempts and flashcard progress are stored in a local SQLite file.

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
the file to wipe all attempt history and flashcard progress.

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

## Flashcards

There is no card authoring. Cards are generated from notes on every request:

| Note type | Front       | Back                                                      |
| --------- | ----------- | --------------------------------------------------------- |
| `rule`    | `name`      | `ruleStatement`, `elements`, `exceptions`, `wisconsinVariation` |
| `case`    | `name`      | `rule`, `holding`                                         |

Class notes do not make cards. Each unit page links to "Flashcards (N)", a
browse page where you click a card to flip it.

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

## Not built yet (schema left open)

Quick-capture inbox, weak-tags report (per-question tags are already stored
for it), essay questions, file upload UI, search, auth, deployment.

## Project layout

```
content/                  your notes and questions
data/study.db             attempts (created on first run, gitignored)
src/lib/content/          types, validators, loader (reads content/ per request)
src/lib/db.ts             SQLite connection + schema
src/lib/attempts.ts       attempt queries
src/lib/cards.ts          flashcards derived from notes
src/lib/sm2.ts            SM-2 scheduling (pure functions)
src/lib/reviews.ts        due queue and card state persistence
src/lib/gaps.ts           gaps computation
src/app/                  pages (server components) and the server actions
src/components/notes/     one template per note type
src/components/cards/     flashcard back, flip card, review card
src/components/test/      the client-side test engine
```
