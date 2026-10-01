import Link from "next/link";
import CourseForm from "@/components/CourseForm";
import { loadContent } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

export default function NewCoursePage() {
  const tree = loadContent();
  const nextOrder = tree.courses.reduce((m, c) => Math.max(m, c.order), 0) + 1;
  return (
    <div className="max-w-xl">
      <p className="mb-1 text-sm text-gray-600"><Link href="/" className="underline">Courses</Link></p>
      <h1 className="mb-1 text-2xl font-semibold">New course</h1>
      <p className="mb-4 text-sm text-gray-600">Creates <code className="font-mono">content/&lt;slug&gt;/course.json</code>. Add units after.</p>
      <CourseForm nextOrder={nextOrder} existingSlugs={tree.courses.map((c) => c.slug)} />
    </div>
  );
}
