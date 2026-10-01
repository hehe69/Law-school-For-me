import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_SECONDS_PER_QUESTION, findUnit, loadContent, questionsForScope, type PoolScope } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

const POOL_LABELS: Record<PoolScope, string> = {
  unit: "This unit",
  upto: "All units up to this one",
  course: "Whole course",
};

export default async function TestSetupPage({ params }: PageProps<"/courses/[course]/units/[unit]/test">) {
  const { course: courseSlug, unit: unitSlug } = await params;
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const base = `/courses/${course.slug}/units/${unit.slug}`;
  const scopes = (["unit", "upto", "course"] as PoolScope[]).map((scope) => ({
    scope,
    label: POOL_LABELS[scope],
    count: questionsForScope(course, unit, scope).length,
  }));
  const maxCount = Math.max(...scopes.map((s) => s.count));

  return (
    <div className="max-w-xl">
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / {course.title} /{" "}
        <Link href={base} className="underline">{unit.title}</Link>
      </p>
      <h1 className="mb-4 text-2xl font-semibold">Test setup</h1>

      <form action={`${base}/test/run`} method="get" className="space-y-5">
        <fieldset>
          <legend className="mb-1 font-medium">Scope</legend>
          {scopes.map((s) => (
            <label key={s.scope} className="block">
              <input type="radio" name="scope" value={s.scope} defaultChecked={s.scope === "unit"} className="mr-2" />
              {s.label} <span className="text-gray-500">({s.count} available)</span>
            </label>
          ))}
        </fieldset>

        <label className="block">
          <span className="block font-medium">Number of questions</span>
          <input type="number" name="count" min={1} max={maxCount} defaultValue={unit.questions.length} className="mt-1 w-32 rounded border border-gray-300 px-2 py-1" />
          <span className="ml-2 text-sm text-gray-500">Leave blank for all in scope. Capped at what the scope has.</span>
        </label>

        <label className="block">
          <span className="block font-medium">Seconds per question</span>
          <input type="number" name="seconds" min={5} max={3600} defaultValue={DEFAULT_SECONDS_PER_QUESTION} className="mt-1 w-32 rounded border border-gray-300 px-2 py-1" />
          <span className="ml-2 text-sm text-gray-500">Total time = questions × this. Default 90.</span>
        </label>

        <p className="text-sm text-gray-600">Questions are shuffled. Answer choices keep their order. The timer starts as soon as the test loads.</p>

        <button type="submit" className="rounded bg-blue-700 px-4 py-2 text-white">Begin test</button>
      </form>
    </div>
  );
}
