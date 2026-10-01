// Runs once per server start: apply migrations, seed the placeholder paper on first run,
// and take a backup if the last one is more than a day old.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb } = await import("./lib/db");
  getDb();
  const { seedIfEmpty } = await import("./lib/seed");
  await seedIfEmpty();
  const { backupIfStale } = await import("./lib/backup");
  try {
    const file = await backupIfStale();
    if (file) console.log(`[paper-planner] backup written: ${file}`);
  } catch (err) {
    console.error("[paper-planner] backup failed:", err);
  }
}
