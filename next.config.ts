import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src', 'app'], // Only lint these directories during build
  },
  redirects() {
    return Promise.resolve([
      {
        source: "/admin",
        destination: "/admin/online",
        permanent: true,
      },
    ]);
  },
};

export default nextConfig;
