import fs from "node:fs";
import os from "node:os";
import { headers } from "next/headers";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { getStudyContentDir, readLauncherSettings } from "@/lib/settings";
import { loadStudyTree } from "@/lib/studyapp";
import { BACKUP_DIR, DATA_DIR, DEFAULT_STUDY_CONTENT_DIR, EXPORT_DIR } from "@/lib/paths";
import { listCourses } from "@/lib/courses";
import { listBackups } from "@/lib/backup";
import { backupNowAction, saveNetworkAction, saveSettingsAction } from "@/app/settings-actions";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** IPv4 addresses of this computer on its local networks, for the "same wifi" links. */
function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}

export default async function SettingsPage() {
  const port = ((await headers()).get("host") ?? "").split(":")[1] ?? process.env.PORT ?? "3000";
  const db = getDb();
  const study = getStudyContentDir(db);
  const exists = fs.existsSync(study.dir);
  const tree = exists ? loadStudyTree(study.dir) : null;
  const courses = listCourses(db);
  const launcher = readLauncherSettings();
  const backups = listBackups().slice(0, 8);

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

      <section className="card mt-6">
        <h2 className="text-base font-medium">Network access</h2>
        <form action={saveNetworkAction} className="mt-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="networkAccess" defaultChecked={launcher.networkAccess} className="mt-1" />
            <span>
              Allow other devices on my wifi to open this app
              <span className="block text-xs text-gray-500">
                Off (the default): the app listens on this computer only. On: it listens on all interfaces, so a phone or laptop on the same wifi can open it at the address the launcher prints. Anyone on
                that network can then open it; there is no login. Takes effect the next time the app starts.
              </span>
            </span>
          </label>
          <button type="submit" className="btn-primary mt-3">
            Save
          </button>
          <span className="ml-3 text-xs text-gray-500">Currently: {launcher.networkAccess ? "on (after the next restart, if it was just changed)" : "off"}</span>
        </form>
        {launcher.networkAccess && (
          <p className="mt-2 text-xs text-gray-600">
            Same wifi:{" "}
            {lanAddresses().length === 0
              ? "no local network address found"
              : lanAddresses().map((a, i) => (
                  <span key={a} className="font-mono">
                    {i > 0 ? " · " : ""}http://{a}:{port}
                  </span>
                ))}
          </p>
        )}
      </section>

      <section className="card mt-6">
        <h2 className="text-base font-medium">Backups</h2>
        <p className="mt-1 text-sm text-gray-600">
          A backup is a zip of the database and the uploads folder in <span className="font-mono text-xs">{BACKUP_DIR}</span>. One is written automatically when the app starts and the newest backup is
          over a day old. To restore, quit the app and put <span className="font-mono text-xs">outlines.db</span> and <span className="font-mono text-xs">uploads/</span> from the zip back into the data
          folder.
        </p>
        <form action={backupNowAction} className="mt-3">
          <button type="submit" className="btn-primary">
            Back up now
          </button>
        </form>
        {backups.length > 0 && (
          <ul className="mt-3 text-xs text-gray-600">
            {backups.map((b) => (
              <li key={b.file} className="flex gap-3 py-0.5">
                <span className="font-mono">{b.file}</span>
                <span className="text-gray-400">{formatBytes(b.bytes)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-6 text-sm">
        <h2 className="text-base font-medium">Where things live</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-gray-500">Database and uploads</dt>
          <dd className="font-mono">{DATA_DIR}</dd>
          <dt className="text-gray-500">Exports</dt>
          <dd className="font-mono">{EXPORT_DIR}</dd>
          <dt className="text-gray-500">Backups</dt>
          <dd className="font-mono">{BACKUP_DIR}</dd>
        </dl>
        <p className="mt-2 text-xs text-gray-500">Set LAW_OUTLINES_DATA_DIR before starting the app to use another data folder; the Mac app has a settings file for it.</p>
      </section>
    </div>
  );
}
