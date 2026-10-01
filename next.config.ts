import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it out of the bundler.
  serverExternalPackages: ["better-sqlite3"],
  // PDF readings and images are uploaded through server actions; the default cap is 1MB.
  experimental: { serverActions: { bodySizeLimit: "100mb" } },
};

export default nextConfig;
