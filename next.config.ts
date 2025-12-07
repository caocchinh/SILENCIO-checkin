import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
