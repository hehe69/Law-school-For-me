import { notFound } from "next/navigation";
import { getPaperBySlug } from "@/lib/queries/papers";
import { PaperNav } from "@/components/PaperNav";

export const dynamic = "force-dynamic";

export default async function PaperLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const paper = getPaperBySlug(slug);
  if (!paper) notFound();
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-xl">{paper.title}</h1>
          <span className="badge border-gray-300">{paper.status}</span>
          {paper.venue && <span className="text-sm text-gray-600">{paper.venue}</span>}
        </div>
        <PaperNav slug={paper.slug} />
      </div>
      {children}
    </div>
  );
}
