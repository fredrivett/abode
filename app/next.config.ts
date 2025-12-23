import type { NextConfig } from "next";
import "./src/env";

const nextConfig: NextConfig = {
  images: {
    // Allow local development images from private IPs
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      // Local Supabase storage
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "55321",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "55321",
        pathname: "/storage/v1/object/public/**",
      },
      // Production Supabase storage
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
