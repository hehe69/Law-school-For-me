import Link from "next/link";
import { notFound } from "next/navigation";
import FlipCard from "@/components/cards/FlipCard";
import { cardsForUnit } from "@/lib/cards";
import { findUnit, loadContent } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

export default async function UnitCardsPage({ params }: PageProps<"/courses/[course]/units/[unit]/cards">) {
  const { course: courseSlug, unit: unitSlug } = await params;
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const cards = cardsForUnit(course, unit);

  return (
    <div className="max-w-2xl">
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / {course.title} /{" "}
        <Link href={`/courses/${course.slug}/units/${unit.slug}`} className="underline">{unit.title}</Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">Flashcards</h1>
      <p className="mb-4 text-sm text-gray-600">
        {cards.length} card{cards.length === 1 ? "" : "s"}, one per rule and case note. Click a card to flip it.{" "}
        <Link href={`/review?course=${course.slug}`} className="underline">Review what&apos;s due</Link>.
      </p>
      {cards.length === 0 && <p className="text-gray-600">No rule or case notes in this unit yet.</p>}
      {cards.map((c) => (
        <FlipCard key={c.key} card={c} />
      ))}
    </div>
  );
}
