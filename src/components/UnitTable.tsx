import Link from "next/link";
import type { Course } from "@/lib/content/types";
import type { UnitStats } from "@/lib/attempts";
import { formatDate, formatScore } from "@/lib/format";

/** The per-course unit table shared by the home page and the course page. */
export default function UnitTable({ course, stats, showEdit = false }: { course: Course; stats: Map<string, UnitStats>; showEdit?: boolean }) {
  if (course.units.length === 0) return <p className="text-sm text-gray-600">No units yet.</p>;
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-300 text-left text-gray-600">
          <th className="py-1 pr-2 font-medium">#</th>
          <th className="py-1 pr-2 font-medium">Unit</th>
          <th className="py-1 pr-2 text-right font-medium">Notes</th>
          <th className="py-1 pr-2 text-right font-medium">Questions</th>
          <th className="py-1 pr-2 text-right font-medium">Best score</th>
          <th className="py-1 pr-2 font-medium">Last attempt</th>
          {showEdit && <th className="py-1 pr-2 font-medium"></th>}
        </tr>
      </thead>
      <tbody>
        {course.units.map((unit) => {
          const s = stats.get(`${course.slug}/${unit.slug}`);
          const drafts = unit.notes.filter((n) => n.status === "draft").length;
          return (
            <tr key={unit.slug} className="border-b border-gray-200">
              <td className="py-2 pr-2 text-gray-500">{unit.order}</td>
              <td className="py-2 pr-2">
                <Link href={`/courses/${course.slug}/units/${unit.slug}`} className="text-blue-700 underline">
                  {unit.title}
                </Link>
                {unit.errors.length > 0 && <span className="ml-2 text-xs text-red-700">{unit.errors.length} file problem(s)</span>}
              </td>
              <td className="py-2 pr-2 text-right">
                {unit.notes.length}
                {drafts > 0 && <span className="ml-1 text-xs text-yellow-900">({drafts} draft)</span>}
              </td>
              <td className="py-2 pr-2 text-right">{unit.questions.length}</td>
              <td className="py-2 pr-2 text-right">{formatScore(s?.bestScore ?? null)}</td>
              <td className="py-2 pr-2">
                {s ? (
                  <Link href={`/courses/${course.slug}/units/${unit.slug}/history`} className="text-blue-700 underline">
                    {formatDate(s.lastAttemptAt)}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              {showEdit && (
                <td className="py-2 pr-2">
                  <Link href={`/courses/${course.slug}/units/${unit.slug}/edit`} className="text-xs underline">Edit</Link>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
