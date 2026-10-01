import Link from "next/link";
import type { DiagnosticReport, Rating } from "@/lib/diagnostic";

const RATING_CLASS: Record<Rating, string> = {
  strong: "bg-green-100 text-green-900",
  okay: "bg-amber-100 text-amber-900",
  weak: "bg-red-100 text-red-900",
  untested: "bg-gray-100 text-gray-700",
};

function Badge({ rating }: { rating: Rating }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${RATING_CLASS[rating]}`}>{rating}</span>;
}

function Table({ title, lines, hrefFor }: { title: string; lines: DiagnosticReport["units"]; hrefFor?: (key: string) => string }) {
  return (
    <div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      {lines.length === 0 ? <p className="text-sm text-gray-500">Nothing to show.</p> : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-600">
              <th className="py-1 pr-2 font-medium"></th>
              <th className="py-1 pr-2 text-right font-medium">Seen</th>
              <th className="py-1 pr-2 text-right font-medium">Correct</th>
              <th className="py-1 pr-2 font-medium">Rating</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className="border-b border-gray-200">
                <td className="py-1 pr-2">{hrefFor ? <Link href={hrefFor(l.key)} className="text-blue-700 underline">{l.label}</Link> : l.label}</td>
                <td className="py-1 pr-2 text-right">{l.seen}</td>
                <td className="py-1 pr-2 text-right">{l.correct}</td>
                <td className="py-1 pr-2"><Badge rating={l.rating} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** The saved diagnostic report: per unit, per tag, and a recommended study order. */
export default function DiagnosticReportView({ report, courseSlug }: { report: DiagnosticReport; courseSlug: string }) {
  return (
    <section className="mb-6 rounded border border-gray-300 p-4">
      <h2 className="mb-1 text-xl font-semibold">Diagnostic report</h2>
      <p className="mb-3 text-xs text-gray-600">
        strong ≥ 70% correct · okay ≥ 40% · weak below · untested = no graded questions{report.ungraded > 0 && ` · ${report.ungraded} issue question${report.ungraded === 1 ? "" : "s"} not yet graded (grade below and the report updates)`}
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <Table title="By unit" lines={report.units} hrefFor={(slug) => `/courses/${courseSlug}/units/${slug}`} />
        <Table title="By tag" lines={report.tags} />
      </div>
      <h3 className="mb-1 mt-4 font-semibold">Recommended order</h3>
      <ol className="list-decimal space-y-0.5 pl-5 text-sm">
        {report.recommendedOrder.map((u) => (
          <li key={u.slug}>
            <Link href={`/courses/${courseSlug}/units/${u.slug}`} className="text-blue-700 underline">{u.label}</Link> <Badge rating={u.rating} />
          </li>
        ))}
      </ol>
      <p className="mt-1 text-xs text-gray-500">Weakest units first, then units with no questions.</p>
    </section>
  );
}
