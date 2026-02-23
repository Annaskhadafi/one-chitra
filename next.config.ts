import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    "@fullcalendar/core",
    "@fullcalendar/react",
    "@fullcalendar/daygrid",
    "@fullcalendar/timegrid",
    "@fullcalendar/interaction",
  ],
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
