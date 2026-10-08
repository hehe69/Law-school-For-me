import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Mac app runs the production server from .next/standalone; `npm run package` sets this flag.
  // Plain `next build` / `next start` for the browser version are unchanged.
  ...(process.env.LAW_OUTLINES_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  // better-sqlite3 is a native module; keep it out of the bundler.
  serverExternalPackages: ["better-sqlite3", "pdfkit"],
  // Syllabus PDFs and images are uploaded through server actions; the default cap is 1MB.
  experimental: { serverActions: { bodySizeLimit: "100mb" } },
  // Files read from disk at request time that the standalone build's tracer cannot see: pdf.js's worker
  // (served by /pdf-worker) and pdfkit's font metrics (used by the PDF export).
  outputFileTracingIncludes: {
    "/pdf-worker": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"],
    "/courses/[slug]/outlines/[id]/export": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
