import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/solve",
        destination: "https://ungethe--ratiocine-solve.modal.run/",
      },
      {
        source: "/api/status",
        destination: "https://ungethe--ratiocine-status.modal.run/",
      },
    ];
  },
};

export default nextConfig;
