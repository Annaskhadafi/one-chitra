import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    // Allow production builds with pre-existing lint warnings/errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds with pre-existing type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
