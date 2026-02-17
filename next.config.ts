import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    // Allow production builds with pre-existing lint warnings/errors
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
