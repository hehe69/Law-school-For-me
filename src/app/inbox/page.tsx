import Link from "next/link";
import { discardCaptureAction } from "@/app/content-actions";
import { listInbox } from "@/lib/captures";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  const items = listInbox();
  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Inbox</h1>
      <p className="mb-4 text-sm text-gray-600">
        Quick captures waiting to be filed. Use the Capture box in the header from any page to add one.
      </p>
      {items.length === 0 && <p className="rounded border border-gray-200 bg-gray-50 p-4 text-gray-600">Nothing in the inbox.</p>}
      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.id} className="rounded border border-gray-200 p-4">
            <p className="mb-2 text-xs text-gray-500">{formatDate(c.created_at)}</p>
            <p className="mb-3 whitespace-pre-line">{c.text}</p>
            <div className="flex items-center gap-3 text-sm">
              <Link href={`/inbox/${c.id}/file`} className="rounded bg-blue-700 px-3 py-1 text-white">File as note</Link>
              <form action={discardCaptureAction}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="text-gray-500 underline hover:text-red-700">Discard</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
