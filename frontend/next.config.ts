import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output mode for Docker deployment (see design §1.3)
  // Generates a self-contained Node.js server at .next/standalone/
  output: "standalone",

  // Disable x-powered-by header for security
  poweredByHeader: false,
};

export default nextConfig;
