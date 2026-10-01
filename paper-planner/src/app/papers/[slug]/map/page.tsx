import { notFound } from "next/navigation";
import { getPaperBySlug } from "@/lib/queries/papers";
import { mapData } from "@/lib/queries/map";
import { ArgumentMap } from "@/components/ArgumentMap";

export default async function MapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const paper = getPaperBySlug(slug);
  if (!paper) notFound();
  return <ArgumentMap slug={paper.slug} initial={mapData(paper)} />;
}
