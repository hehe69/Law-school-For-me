// Re-run the seed on demand: `npm run seed`. Requires the TypeScript sources to be compiled by Next,
// so this script simply boots the lib through tsx-free dynamic import of the built server is not
// possible; instead it starts the app's seed through `next`'s own compilation by hitting the API.
// To keep it dependency-free, we ask the running dev server to seed.
const port = process.env.PORT || "3000";
const res = await fetch(`http://localhost:${port}/api/seed`, { method: "POST" }).catch(() => null);
if (!res) {
  console.error(`Could not reach http://localhost:${port}. Start the app with \`npm run dev\` first.`);
  process.exit(1);
}
console.log(await res.text());
