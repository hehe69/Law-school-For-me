import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCourseBySlug, listOutlines } from "@/lib/courses";
import { getStudyContentDir } from "@/lib/settings";
import { findLinkedNode, linkedNodeStatuses, loadStudyTree } from "@/lib/studyapp";
import { loadNodes } from "@/lib/nodes";
import { flatten } from "@/lib/tree";
import type { NodeMap } from "@/lib/types";
import { importFileAction, importFromStudyAppAction, importTopicsAction, refreshLinkedNodeAction } from "@/app/import-actions";
import { ImportForm } from "@/components/ImportForm";

export default async function ImportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const query = await searchParams;
  const db = getDb();
  const course = getCourseBySlug(db, slug);
  if (!course) notFound();
  const outlines = listOutlines(db, course.id).map((o) => {
    const map: NodeMap = {};
    for (const n of loadNodes(db, o.id)) map[n.id] = n;
    return { id: o.id, name: o.name, kind: o.kind, isDefault: o.isDefault, nodes: flatten(map, false).map((r) => ({ id: r.node.id, title: r.node.title, type: r.node.type, depth: r.depth })) };
  });
  const { dir } = getStudyContentDir(db);
  const tree = course.studyCourseSlug ? loadStudyTree(dir) : null;
  const studyCourse = tree?.courses.find((c) => c.slug === course.studyCourseSlug) ?? null;
  const linked = course.studyCourseSlug ? linkedNodeStatuses(db, course.id, dir) : [];
  const importedPaths = new Set(linked.map((l) => l.node.linkedNotePath).filter((p): p is string => p !== null));
  const error = typeof query.error === "string" ? query.error : null;
  const created = typeof query.created === "string" ? Number(query.created) : null;
  const skipped = typeof query.skipped === "string" ? Number(query.skipped) : 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Import · {course.title}</h1>
        <Link href={`/courses/${course.slug}`} className="text-sm text-gray-500 hover:text-gray-900">
          Course page
        </Link>
      </div>
      {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {created !== null && (
        <p className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Imported {created} node{created === 1 ? "" : "s"}
          {skipped ? `; ${skipped} already imported and skipped` : ""}.
        </p>
      )}

      <section className="card mt-6">
        <h2 className="text-base font-medium">From the study app</h2>
        {!course.studyCourseSlug ? (
          <p className="mt-1 text-sm text-gray-600">
            This course is not linked to a study-app course. Set the <em>study-app course slug</em> in the course settings, and the content folder in{" "}
            <Link href="/settings" className="text-blue-700 hover:underline">
              Settings
            </Link>
            .
          </p>
        ) : !tree?.exists ? (
          <p className="mt-1 text-sm text-red-700">
            The content folder was not found: <span className="font-mono text-xs">{dir}</span>. Fix it in{" "}
            <Link href="/settings" className="text-blue-700 hover:underline">
              Settings
            </Link>
            .
          </p>
        ) : !studyCourse ? (
          <p className="mt-1 text-sm text-red-700">
            No course with the slug <span className="font-mono text-xs">{course.studyCourseSlug}</span> in {dir}. Available: {tree.courses.map((c) => c.slug).join(", ") || "none"}.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-600">
              Linked to <strong>{studyCourse.title}</strong> ({studyCourse.units.length} units). Tick whole units (a heading with the unit&apos;s notes beneath) or single notes, choose where they go, and
              import. Rule notes become rule nodes with their elements and exceptions, case notes become case nodes, class notes become professor notes. Imported nodes keep a link to their note.
            </p>
            <ImportForm courseId={course.id} units={studyCourse.units} importedPaths={Array.from(importedPaths)} outlines={outlines} action={importFromStudyAppAction} />
            <form action={importTopicsAction} className="mt-3 border-t border-gray-200 pt-3 text-sm">
              <input type="hidden" name="courseId" value={course.id} />
              <button type="submit" className="btn">
                Add the units&apos; syllabus topics to this course
              </button>
              <span className="ml-2 text-xs text-gray-500">
                {Array.from(new Set(studyCourse.units.flatMap((u) => u.syllabusTopics))).join(", ") || "the units list no topics"}
              </span>
            </form>
          </>
        )}
      </section>

      {linked.length > 0 && (
        <section className="card mt-6">
          <h2 className="text-base font-medium">Linked nodes</h2>
          <p className="mt-1 text-sm text-gray-600">Nodes imported from study-app notes. &quot;Changed&quot; means the note was edited since the import; refreshing overwrites the node&apos;s fields and body (status, tags, children and links stay).</p>
          <ul className="mt-3 divide-y divide-gray-200 text-sm">
            {linked.map((l) => (
              <li key={l.node.id} className="flex flex-wrap items-center gap-3 py-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${l.status === "unchanged" ? "bg-gray-100 text-gray-600" : l.status === "changed" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}
                >
                  {l.status}
                </span>
                <Link href={`/courses/${course.slug}/outlines/${l.node.outlineId}?node=${l.node.id}`} className="font-medium hover:underline">
                  {l.node.title || "(untitled)"}
                </Link>
                <span className="text-xs text-gray-400">{l.outlineName}</span>
                <span className="font-mono text-xs text-gray-400">{l.node.linkedNotePath}</span>
                {l.status === "changed" && (
                  <form action={refreshLinkedNodeAction} className="ml-auto">
                    <input type="hidden" name="nodeId" value={l.node.id} />
                    <button type="submit" className="btn">
                      Refresh from note
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-6">
        <h2 className="text-base font-medium">From a .docx or .md file</h2>
        <p className="mt-1 text-sm text-gray-600">Imports an existing outline into a new outline of this course, keeping the hierarchy from headings and list indentation. You can then rearrange it.</p>
        <form action={importFileAction} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="courseId" value={course.id} />
          <div>
            <label className="label" htmlFor="file">
              File
            </label>
            <input id="file" name="file" type="file" accept=".docx,.md,.markdown,.txt" className="text-sm" required />
          </div>
          <div>
            <label className="label" htmlFor="name">
              New outline name (optional)
            </label>
            <input id="name" name="name" className="input w-56" placeholder="the file name" />
          </div>
          <button type="submit" className="btn-primary">
            Import into a new outline
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-500">To compare a friend&apos;s outline without importing it, open an outline and use &quot;Compare with a file&quot; in the toolbar.</p>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";

// Keep the unused import linter quiet when the course is not linked: findLinkedNode is used by the actions.
void findLinkedNode;
