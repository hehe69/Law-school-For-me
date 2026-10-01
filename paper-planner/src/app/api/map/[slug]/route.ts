import { getPaperBySlug } from "@/lib/queries/papers";
import { mapData } from "@/lib/queries/map";

export const dynamic = "force-dynamic";

// The argument map re-fetches its data from here after a drag-to-link.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const paper = getPaperBySlug(slug);
  if (!paper) return new Response("Not found", { status: 404 });
  return Response.json(mapData(paper));
}
