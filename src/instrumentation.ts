// Runs once when the Next.js server starts (dev and production): back up if the last backup is over a day old.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { backupIfStale } = await import("./lib/backup");
  try {
    const written = await backupIfStale();
    if (written) console.log(`[backup] wrote ${written}`);
  } catch (e) {
    console.error("[backup] automatic backup failed:", (e as Error).message);
  }
}
