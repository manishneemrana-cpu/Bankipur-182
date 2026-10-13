import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // workspace packages (@ave/shared-types) are transpiled automatically by Next 16
  reactStrictMode: true,
};

export default nextConfig;
