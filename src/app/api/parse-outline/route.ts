import type { NextRequest } from "next/server";
import { countImported, parseOutlineFile } from "@/lib/importers";

/** The "compare with a file" pane: a .docx or .md is parsed into a tree and returned; nothing is stored. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "choose a .docx or .md file" }, { status: 400 });
  try {
    const tree = await parseOutlineFile(file.name, Buffer.from(await file.arrayBuffer()));
    return Response.json({ name: file.name, tree, count: countImported(tree) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
