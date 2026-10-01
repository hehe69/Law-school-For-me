import { runBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

// POST /api/backup writes a backup zip and returns its path. Used by the desktop app's Data menu.
export async function POST() {
  const file = await runBackup();
  return Response.json({ file });
}
