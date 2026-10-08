import Link from "next/link";
import { getDb } from "@/lib/db";
import { listCourses } from "@/lib/courses";
import { countUnfiled } from "@/lib/attachments";
import { reviewSummary } from "@/lib/cards";
import { CaptureBox } from "./CaptureBox";

/** The top bar on every page, with the capture box. */
export function Header() {
  const db = getDb();
  const courses = listCourses(db).map((c) => ({ id: c.id, title: c.title, slug: c.slug }));
  const unfiled = countUnfiled(db);
  const review = reviewSummary(db);
  return (
    <header className="flex h-11 shrink-0 items-center gap-4 border-b border-gray-200 bg-gray-50 px-4 print:hidden">
      <Link href="/" className="text-sm font-semibold tracking-tight text-gray-900">
        Law Outlines
      </Link>
      <nav className="flex items-center gap-3 text-sm text-gray-600">
        <Link href="/" className="hover:text-gray-900">
          Courses
        </Link>
        <Link href="/review" className="hover:text-gray-900" title="Daily flashcard review">
          Review{review.due > 0 ? ` (${review.due})` : ""}
        </Link>
        <Link href="/settings" className="hover:text-gray-900">
          Settings
        </Link>
      </nav>
      <div className="ml-auto flex items-center">{courses.length > 0 && <CaptureBox courses={courses} unfiled={unfiled} />}</div>
    </header>
  );
}
