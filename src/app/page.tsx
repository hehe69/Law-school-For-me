import Link from "next/link";
import ContentErrors from "@/components/ContentErrors";
import { loadContent } from "@/lib/content/loader";
import { unitStatsMap } from "@/lib/attempts";
import { formatDate, formatScore } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const tree = loadContent();
  const stats = unitStatsMap();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Courses</h1>
      <ContentErrors errors={tree.errors} />

      {tree.courses.length === 0 && (
        <p className="text-gray-600">
          No courses found. Add a folder under <code className="font-mono">content/</code> with a{" "}
          <code className="font-mono">course.json</code>. See the README.
        </p>
      )}

      {tree.courses.map((course) => (
        <section key={course.slug} className="mb-8">
          <h2 className="mb-2 text-xl font-semibold">{course.title}</h2>
          {course.units.length === 0 ? (
            <p className="text-sm text-gray-600">No units yet.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-left text-gray-600">
                  <th className="py-1 pr-2 font-medium">#</th>
                  <th className="py-1 pr-2 font-medium">Unit</th>
                  <th className="py-1 pr-2 text-right font-medium">Notes</th>
                  <th className="py-1 pr-2 text-right font-medium">Questions</th>
                  <th className="py-1 pr-2 text-right font-medium">Best score</th>
                  <th className="py-1 pr-2 font-medium">Last attempt</th>
                </tr>
              </thead>
              <tbody>
                {course.units.map((unit) => {
                  const s = stats.get(`${course.slug}/${unit.slug}`);
                  return (
                    <tr key={unit.slug} className="border-b border-gray-200">
                      <td className="py-2 pr-2 text-gray-500">{unit.order}</td>
                      <td className="py-2 pr-2">
                        <Link href={`/courses/${course.slug}/units/${unit.slug}`} className="text-blue-700 underline">
                          {unit.title}
                        </Link>
                        {unit.errors.length > 0 && (
                          <span className="ml-2 text-xs text-red-700">{unit.errors.length} file problem(s)</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">{unit.notes.length}</td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
