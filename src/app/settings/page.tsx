import fs from "node:fs";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { getStudyContentDir } from "@/lib/settings";
import { loadStudyTree } from "@/lib/studyapp";
import { DATA_DIR, DEFAULT_STUDY_CONTENT_DIR } from "@/lib/paths";
import { listCourses } from "@/lib/courses";
import { saveSettingsAction } from "@/app/settings-actions";

export default function SettingsPage() {
  const db = getDb();
  const study = getStudyContentDir(db);
  const exists = fs.existsSync(study.dir);
  const tree = exists ? loadStudyTree(study.dir) : null;
  const courses = listCourses(db);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className="card mt-6">
        <h2 className="text-base font-medium">Study app</h2>
        <p className="mt-1 text-sm text-gray-600">
          The content folder of the study app (its courses, units and notes). Courses linked to a study-app course slug can import units, rule notes, case notes and class notes from it. Import is one-way;
          nothing is written back.
        </p>
        <form action={saveSettingsAction} className="mt-3">
          <label className="label" htmlFor="studyContentDir">
            Content folder
          </label>
          <div className="flex gap-2">
            <input id="studyContentDir" name="studyContentDir" className="input font-mono text-xs" defaultValue={study.dir} placeholder={DEFAULT_STUDY_CONTENT_DIR} />
            <button type="submit" className="btn-primary shrink-0">
              Save
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {study.isDefault ? "Using the default. " : ""}
            {exists ? (
              <span className="text-green-700">Folder found.</span>
            ) : (
              <span className="text-red-700">Folder not found: {study.dir}</span>
            )}{" "}
            Leave empty to go back to the default.
          </p>
        </form>
        {tree && (
          <div className="mt-4 text-sm">
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">Courses in the content folder</h3>
            {tree.courses.length === 0 && <p className="mt-1 text-gray-500">No courses found.</p>}
            <ul className="mt-1 space-y-1">
              {tree.courses.map((c) => {
                const linked = courses.filter((k) => k.studyCourseSlug === c.slug);
                return (
                  <li key={c.slug} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-gray-500">{c.slug}</span>
                    <span>{c.title}</span>
                    <span className="text-xs text-gray-400">
                      {c.units.length} unit{c.units.length === 1 ? "" : "s"}, {c.units.reduce((n, u) => n + u.notes.length, 0)} notes
                    </span>
                    {linked.length > 0 ? (
                      linked.map((k) => (
                        <Link key={k.id} href={`/courses/${k.slug}/import`} className="text-xs text-blue-700 hover:underline">
                          linked to {k.title} → import
                        </Link>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">not linked (set the study-app slug in a course&apos;s settings)</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {tree.errors.length > 0 && (
              <details className="mt-2 text-xs text-gray-500">
                <summary className="cursor-pointer">{tree.errors.length} file(s) skipped</summary>
                <ul className="mt-1 list-disc pl-5">
                  {tree.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="card mt-6 text-sm">
        <h2 className="text-base font-medium">Where things live</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-gray-500">Database and uploads</dt>
          <dd className="font-mono">{DATA_DIR}</dd>
        </dl>
        <p className="mt-2 text-xs text-gray-500">Set LAW_OUTLINES_DATA_DIR before starting the app to use another folder; the Mac app has a settings file for it.</p>
      </section>
    </div>
  );
}
