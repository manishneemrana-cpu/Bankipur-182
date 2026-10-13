import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // workspace packages (@ave/shared-types) are transpiled automatically by Next 16
  reactStrictMode: true,
  // video-engine is a workspace nested inside a repo that has its own root Next app (and package-lock.json).
  // Pin the root to this workspace so builds (e.g. on Vercel) never pick up the repo root's src/proxy.ts.
  turbopack: { root: path.join(__dirname, "../..") },
};

export default nextConfig;
