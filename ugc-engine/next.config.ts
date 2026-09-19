import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["fluent-ffmpeg", "bullmq", "ioredis"],
  // This package lives inside the Bankipur-182 monorepo checkout alongside
  // an unrelated sibling app that also has a package-lock.json; pin the
  // workspace root explicitly so Turbopack never resolves "@/*" against the
  // sibling app's src/ directory.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
