import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_SECONDS_PER_QUESTION, findUnit, loadContent, questionsForScope, type PoolScope } from "@/lib/content/loader";
import { countByType } from "@/lib/testing";

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
    ...countByType(questionsForScope(course, unit, scope)),
  }));
  const maxMc = Math.max(...scopes.map((s) => s.mc));
  const maxIssue = Math.max(...scopes.map((s) => s.issue));
  const own = countByType(unit.questions);
  const issueMinutes = unit.questions.reduce((n, q) => n + (q.type === "issue" ? q.minutes : 0), 0);

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
              {s.label} <span className="text-gray-500">({s.mc} multiple choice{s.issue > 0 ? `, ${s.issue} issue` : ""})</span>
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend className="mb-1 font-medium">Format</legend>
          <label className="block">
            <input type="radio" name="format" value="mc" defaultChecked className="mr-2" />
            Multiple choice only
          </label>
          <label className="block">
            <input type="radio" name="format" value="issue" disabled={maxIssue === 0} className="mr-2" />
            Issue spotter only <span className="text-gray-500">(timed written answers, self-graded)</span>
          </label>
          <label className="block">
            <input type="radio" name="format" value="mixed" disabled={maxIssue === 0} className="mr-2" />
            Mixed exam <span className="text-gray-500">(multiple choice first, then issue questions, one timer)</span>
          </label>
        </fieldset>

        <label className="block">
          <span className="block font-medium">Multiple-choice questions</span>
          <input type="number" name="count" min={0} max={maxMc} defaultValue={own.mc} className="mt-1 w-32 rounded border border-gray-300 px-2 py-1" />
          <span className="ml-2 text-sm text-gray-500">Capped at what the scope has. Ignored for issue-only.</span>
        </label>

        <label className="block">
          <span className="block font-medium">Seconds per multiple-choice question</span>
          <input type="number" name="seconds" min={5} max={3600} defaultValue={DEFAULT_SECONDS_PER_QUESTION} className="mt-1 w-32 rounded border border-gray-300 px-2 py-1" />
          <span className="ml-2 text-sm text-gray-500">Default 90.</span>
        </label>

        <label className="block">
          <span className="block font-medium">Issue questions</span>
          <input type="number" name="issues" min={0} max={maxIssue} defaultValue={own.issue} className="mt-1 w-32 rounded border border-gray-300 px-2 py-1" />
          <span className="ml-2 text-sm text-gray-500">
            Each brings its own minutes{own.issue > 0 ? ` (this unit's ${own.issue} add up to ${issueMinutes} min)` : ""}. Ignored for multiple choice only.
          </span>
        </label>

        <p className="text-sm text-gray-600">
          Questions are shuffled within each part. Answer choices keep their order. One timer covers the whole test:
          multiple choice × seconds, plus every issue question&apos;s minutes. It starts as soon as the test loads.
        </p>

        <button type="submit" className="rounded bg-blue-700 px-4 py-2 text-white">Begin test</button>
      </form>
    </div>
  );
}
