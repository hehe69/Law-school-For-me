import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subfolder of a repo that has its own lockfile; pin the workspace root here.
  turbopack: { root: __dirname },
  // Native modules stay out of the bundler.
  serverExternalPackages: ["better-sqlite3", "adm-zip", "mammoth", "docx"],
  // PDF and .docx uploads go through server actions; the default cap is 1MB.
  experimental: { serverActions: { bodySizeLimit: "200mb" } },
};

export default nextConfig;
