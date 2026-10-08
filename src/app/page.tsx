import Link from "next/link";
import { getDb } from "@/lib/db";
import { listCourses, listOutlines } from "@/lib/courses";
import { seedIfEmpty } from "@/lib/seed";
import { createCourseAction } from "./actions";

function daysUntil(date: string | null): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `exam was ${-days} days ago`;
  if (days === 0) return "exam today";
  return `${days} days to the exam`;
}

export default function HomePage() {
  const db = getDb();
  seedIfEmpty(db);
  const courses = listCourses(db);
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="text-xl font-semibold">Courses</h1>
      <p className="mt-1 text-sm text-gray-600">Each course has a full outline, a scratch list, and any attack or midterm outlines you add.</p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {courses.map((course) => {
          const outlines = listOutlines(db, course.id);
          const full = outlines.find((o) => o.isDefault && o.kind === "full") ?? outlines.find((o) => o.kind === "full");
          const countdown = daysUntil(course.examDate);
          return (
            <li key={course.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/courses/${course.slug}`} className="text-base font-medium text-gray-900 hover:underline">
                    {course.title}
                  </Link>
                  <div className="mt-1 text-xs text-gray-500">
                    {outlines.length} outline{outlines.length === 1 ? "" : "s"}
                    {countdown ? ` · ${countdown}` : ""}
                    {course.pageLimit ? ` · ${course.pageLimit}-page limit` : ""}
                  </div>
                </div>
                {full && (
                  <Link href={`/courses/${course.slug}/outlines/${full.id}`} className="btn-primary shrink-0">
                    Open outline
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <section className="card mt-8">
        <h2 className="text-base font-medium">New course</h2>
        <form action={createCourseAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">
              Title
            </label>
            <input id="title" name="title" className="input" required placeholder="Civil Procedure" />
          </div>
          <div>
            <label className="label" htmlFor="examDate">
              Exam date
            </label>
            <input id="examDate" name="examDate" type="date" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="pageLimit">
              Page limit for the printed outline (optional)
            </label>
            <input id="pageLimit" name="pageLimit" type="number" min={1} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="examFormat">
              Exam format notes
            </label>
            <textarea id="examFormat" name="examFormat" className="input" rows={2} placeholder="Three hours, open book, two essays…" />
          </div>
          <div>
            <label className="label" htmlFor="studyCourseSlug">
              Study-app course slug (optional)
            </label>
            <input id="studyCourseSlug" name="studyCourseSlug" className="input" placeholder="property" />
          </div>
          <div>
            <label className="label" htmlFor="syllabusTopics">
              Syllabus topics (one per line)
            </label>
            <textarea id="syllabusTopics" name="syllabusTopics" className="input" rows={2} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">
              Create course
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
