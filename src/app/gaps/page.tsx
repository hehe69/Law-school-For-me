import Link from "next/link";
import ContentErrors from "@/components/ContentErrors";
import { loadContent } from "@/lib/content/loader";
import { computeGaps, STALE_DAYS } from "@/lib/gaps";
import { formatDate } from "@/lib/format";
import type { Unit } from "@/lib/content/types";

export const dynamic = "force-dynamic";

function UnitLink({ courseSlug, unit }: { courseSlug: string; unit: Unit }) {
  return (
    <Link href={`/courses/${courseSlug}/units/${unit.slug}`} className="text-blue-700 underline">
      {unit.order}. {unit.title}
    </Link>
  );
}

export default function GapsPage() {
  const tree = loadContent();
  const gaps = computeGaps(tree);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Gaps</h1>
      <p className="mb-4 text-sm text-gray-600">
        What each course is missing. Topics come from unit.json; a note covers a topic when its frontmatter lists it under{" "}
        <code className="font-mono">topics</code>.
      </p>
      <ContentErrors errors={tree.errors} />
      {gaps.length === 0 && <p className="text-gray-600">No courses yet.</p>}

      {gaps.map(({ course, uncoveredTopics, unknownTopics, unitsWithoutQuestions, staleUnits }) => (
        <section key={course.slug} className="mb-8">
          <h2 className="mb-3 border-b border-gray-300 pb-1 text-xl font-semibold">{course.title}</h2>

          <h3 className="mb-1 font-semibold">
            Syllabus topics with no notes <span className="font-normal text-gray-500">({uncoveredTopics.length})</span>
            {uncoveredTopics.length > 0 && (
              <Link href={`/courses/${course.slug}/map?highlight=${encodeURIComponent([...new Set(uncoveredTopics.map((t) => t.topic))].join(","))}`} className="ml-3 text-sm font-normal text-blue-700 underline">
                show on the map
              </Link>
            )}
          </h3>
          {uncoveredTopics.length === 0 ? (
            <p className="mb-4 text-sm text-gray-600">Every syllabus topic has at least one note.</p>
          ) : (
            <ul className="mb-4 list-disc pl-5 text-sm">
              {uncoveredTopics.map(({ unit, topic }) => (
                <li key={`${unit.slug}/${topic}`}>
                  <span className="font-medium">{topic}</span> <span className="text-gray-500">in</span>{" "}
                  <UnitLink courseSlug={course.slug} unit={unit} />
                </li>
              ))}
            </ul>
          )}

          {unknownTopics.length > 0 && (
            <>
              <h3 className="mb-1 font-semibold">
                Note topics not in the syllabus <span className="font-normal text-gray-500">({unknownTopics.length})</span>
              </h3>
              <ul className="mb-4 list-disc pl-5 text-sm">
                {unknownTopics.map(({ unit, notePath, topic }) => (
                  <li key={`${notePath}/${topic}`}>
                    <span className="font-medium">{topic}</span> <span className="text-gray-500">in</span>{" "}
                    <code className="font-mono">content/{notePath}</code> <span className="text-gray-500">(unit {unit.order}: add it to unit.json or fix the spelling)</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3 className="mb-1 font-semibold">
            Units with no questions <span className="font-normal text-gray-500">({unitsWithoutQuestions.length})</span>
          </h3>
          {unitsWithoutQuestions.length === 0 ? (
            <p className="mb-4 text-sm text-gray-600">Every unit has questions.</p>
          ) : (
            <ul className="mb-4 list-disc pl-5 text-sm">
              {unitsWithoutQuestions.map((unit) => (
                <li key={unit.slug}><UnitLink courseSlug={course.slug} unit={unit} /></li>
              ))}
            </ul>
          )}

          <h3 className="mb-1 font-semibold">
            No review or test in {STALE_DAYS}+ days <span className="font-normal text-gray-500">({staleUnits.length})</span>
          </h3>
          {staleUnits.length === 0 ? (
            <p className="mb-4 text-sm text-gray-600">Every unit was reviewed or tested in the last {STALE_DAYS} days.</p>
          ) : (
            <ul className="mb-4 list-disc pl-5 text-sm">
              {staleUnits.map(({ unit, lastActivityAt, daysSince }) => (
                <li key={unit.slug}>
                  <UnitLink courseSlug={course.slug} unit={unit} />{" "}
                  <span className="text-gray-500">
                    {lastActivityAt === null ? "never studied" : `last activity ${daysSince} days ago (${formatDate(lastActivityAt)})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
