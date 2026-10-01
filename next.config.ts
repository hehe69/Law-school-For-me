import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Mac app runs the production server from .next/standalone; `npm run package` sets this flag.
  // Plain `next build` / `next start` for the browser version are unchanged.
  ...(process.env.LAW_STUDY_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  // better-sqlite3 is a native module; keep it out of the bundler.
  serverExternalPackages: ["better-sqlite3"],
  // PDF readings and images are uploaded through server actions; the default cap is 1MB.
  experimental: { serverActions: { bodySizeLimit: "100mb" } },
};

export default nextConfig;
