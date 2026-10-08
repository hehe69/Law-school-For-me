import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCourseBySlug } from "@/lib/courses";
import { listCaptures } from "@/lib/attachments";
import { getNode } from "@/lib/nodes";
import { discardCaptureAction, unfileCaptureAction } from "@/app/capture-actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

export default async function InboxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const course = getCourseBySlug(db, slug);
  if (!course) notFound();
  const captures = listCaptures(db, course.id);
  const unfiled = captures.filter((c) => !c.filed);
  const filed = captures.filter((c) => c.filed);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Inbox · {course.title}</h1>
        <Link href={`/courses/${course.slug}`} className="text-sm text-gray-500 hover:text-gray-900">
          Course page
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-600">Captured thoughts not yet placed in an outline. File each one as a node, or discard it.</p>

      {unfiled.length === 0 && <p className="card mt-6 text-sm text-gray-500">Nothing waiting. Use the capture box in the header to add something.</p>}
      <ul className="mt-6 space-y-3">
        {unfiled.map((c) => (
          <li key={c.id} className="card">
            <div className="whitespace-pre-wrap text-sm">{c.text}</div>
            <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
              <span>{new Date(c.createdAt).toLocaleString()}</span>
              <Link href={`/courses/${course.slug}/inbox/${c.id}/file`} className="btn-primary ml-auto">
                File as node
              </Link>
              <form action={discardCaptureAction}>
                <input type="hidden" name="captureId" value={c.id} />
                <ConfirmSubmit message="Discard this capture?">Discard</ConfirmSubmit>
              </form>
            </div>
          </li>
        ))}
      </ul>

      {filed.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-gray-600">Filed ({filed.length})</summary>
          <ul className="mt-3 space-y-2">
            {filed.map((c) => {
              const node = c.filedNodeId ? getNode(db, c.filedNodeId) : null;
              return (
                <li key={c.id} className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-600">
                  <div className="line-clamp-2 whitespace-pre-wrap">{c.text}</div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                    {node ? (
                      <Link href={`/courses/${course.slug}/outlines/${node.outlineId}?node=${node.id}`} className="text-blue-700 hover:underline">
                        Open node: {node.title || "(untitled)"}
                      </Link>
                    ) : (
                      <span>node no longer exists</span>
                    )}
                    <form action={unfileCaptureAction} className="ml-auto">
                      <input type="hidden" name="captureId" value={c.id} />
                      <button type="submit" className="hover:text-gray-700">
                        Back to inbox
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
