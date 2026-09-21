import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  turbopack: {
    // This app lives inside a larger git repo alongside an unrelated Next.js
    // project (../src). Without pinning the root, Next's workspace-root
    // inference can pick up the sibling project's files instead of this one.
    root: path.join(__dirname),
  },
};

export default nextConfig;
