import fs from "node:fs";
import path from "node:path";
import { getDraft } from "@/lib/queries/drafts";
import { resolveStored } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = getDraft(parseInt(id, 10));
  if (!draft) return new Response("Not found", { status: 404 });
  let abs: string;
  try {
    abs = resolveStored(draft.file_path);
  } catch {
    return new Response("Bad path", { status: 400 });
  }
  if (!fs.existsSync(abs)) return new Response("File missing", { status: 404 });
  const bytes = fs.readFileSync(abs);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${path.basename(abs)}"`,
    },
  });
}
