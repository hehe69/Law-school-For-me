import { revalidatePath } from "next/cache";
import { seed } from "@/lib/seed";

export const dynamic = "force-dynamic";

// POST /api/seed re-creates the placeholder paper (used by `npm run seed`).
export async function POST() {
  const paper = await seed();
  revalidatePath("/", "layout");
  return new Response(`Seeded placeholder paper at /papers/${paper.slug}\n`);
}
