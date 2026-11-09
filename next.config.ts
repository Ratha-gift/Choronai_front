import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production image (Dockerfile): a self-contained server in .next/standalone.
  output: "standalone",
  // `npm run dev` opened from other devices on the office WiFi (team preview).
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*"],
  devIndicators: false,
};

export default nextConfig;