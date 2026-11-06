import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production image (Dockerfile): a self-contained server in .next/standalone.
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
};

export default nextConfig;