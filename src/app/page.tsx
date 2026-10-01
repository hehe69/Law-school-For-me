import Link from "next/link";
import ContentErrors from "@/components/ContentErrors";
import { loadContent } from "@/lib/content/loader";
import { unitStatsMap } from "@/lib/attempts";
import { dueByCourse } from "@/lib/reviews";
import { formatDate } from "@/lib/format";
import { lastBackup } from "@/lib/backup";
import { backupAction } from "@/app/content-actions";
import UnitTable from "@/components/UnitTable";
import { examPlan } from "@/lib/exam";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const tree = loadContent();
  const stats = unitStatsMap();
  const due = dueByCourse(tree);
  const totalDue = [...due.values()].reduce((n, d) => n + d.due, 0);
  const last = lastBackup();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Courses</h1>
        <Link href="/courses/new" className="rounded border border-gray-300 px-3 py-1 text-sm">New course</Link>
        <form action={backupAction} className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-gray-600">
            {last ? `Last backup ${formatDate(last.mtime.toISOString())}` : "No backup yet"}
          </span>
          <button type="submit" className="rounded border border-gray-300 px-3 py-1">Back up now</button>
        </form>
      </div>

      {sp.backup === "ok" && typeof sp.file === "string" && (
        <p className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Backup written to <code className="font-mono">{sp.file}</code>
        </p>
      )}
      {sp.backup === "error" && (
        <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          Backup failed: {typeof sp.message === "string" ? sp.message : "unknown error"}
        </p>
      )}

      <ContentErrors errors={tree.errors} />

      {tree.courses.length > 0 && (
        <div className="mb-6 rounded border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="mb-1 font-semibold">Flashcards due today: {totalDue}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {tree.courses.map((course) => {
              const d = due.get(course.slug) ?? { due: 0, total: 0, newCards: 0 };
              return (
                <li key={course.slug}>
                  {course.title}: <strong>{d.due}</strong> due of {d.total}
                  {d.newCards > 0 && <span className="text-gray-500"> ({d.newCards} new)</span>}
                  {d.due > 0 && (
                    <>
                      {" "}
                      <Link href={`/review?course=${course.slug}`} className="text-blue-700 underline">review</Link>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tree.courses.length === 0 && (
        <p className="text-gray-600">
          No courses yet. <Link href="/courses/new" className="underline">Create one</Link>, or add a folder under{" "}
          <code className="font-mono">content/</code> with a <code className="font-mono">course.json</code>. See the README.
        </p>
      )}

      {tree.courses.map((course) => {
        const plan = examPlan(course, stats);
        return (
        <section key={course.slug} className="mb-8">
          <h2 className="mb-2 flex items-baseline gap-3 text-xl font-semibold">
            <Link href={`/courses/${course.slug}`} className="hover:underline">{course.title}</Link>
            <Link href={`/courses/${course.slug}/units/new`} className="text-sm font-normal text-blue-700 underline">New unit</Link>
            <Link href={`/courses/${course.slug}/weak-tags`} className="text-sm font-normal text-blue-700 underline">Weak tags</Link>
            <Link href={`/courses/${course.slug}/outline`} className="text-sm font-normal text-blue-700 underline">Outline</Link>
          </h2>
          {plan && (
            <p className={`mb-2 text-sm ${plan.daysRemaining >= 0 && plan.daysRemaining <= 7 ? "text-red-700" : "text-gray-700"}`}>
              Exam {plan.examDate}:{" "}
              {plan.daysRemaining > 0 ? `${plan.daysRemaining} day${plan.daysRemaining === 1 ? "" : "s"} remaining` : plan.daysRemaining === 0 ? "today" : `${-plan.daysRemaining} day${plan.daysRemaining === -1 ? "" : "s"} ago`}
              {plan.unitsPerWeek !== null && (
                <> · <strong>{plan.unitsPerWeek}</strong> unit{plan.unitsPerWeek === 1 ? "" : "s"} per week to finish ({plan.unitsRemaining} with no attempts)</>
              )}
              {plan.daysRemaining > 0 && plan.unitsRemaining === 0 && " · every unit has been tested"}
            </p>
          )}
          <UnitTable course={course} stats={stats} />
        </section>
        );
      })}
    </div>
  );
}
