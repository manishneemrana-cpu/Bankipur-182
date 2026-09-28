import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // White-label rule: never advertise the framework on public responses.
  poweredByHeader: false,
  // This app sits inside a repo with another Next app at its root; pin the
  // workspace root so that app's files (e.g. its proxy.ts) are never picked up.
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
